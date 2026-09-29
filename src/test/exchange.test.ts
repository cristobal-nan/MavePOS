import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SalesService } from '../main/services/salesService'
import { CashService } from '../main/services/cashService'
import { ProductService } from '../main/services/productService'
import { calculateExchangeBalance, isExchangePeriodExceeded } from '../shared/finance'
import { CompleteSaleInput, ExchangeInfo } from '../shared/types'

describe('Sistema de Cambios de Producto (Product Exchange Flow)', () => {
  describe('Lógica Financiera de Dominio de Cambio', () => {
    it('detecta cambio exacto cuando los nuevos productos igualan el crédito por cambio', () => {
      const res = calculateExchangeBalance(10000, 10000)
      expect(res.canComplete).toBe(true)
      expect(res.differenceToPay).toBe(0)
      expect(res.remainingCredit).toBe(0)
      expect(res.status).toBe('exact')
    })

    it('calcula la diferencia a pagar cuando los nuevos productos superan el crédito', () => {
      const res = calculateExchangeBalance(10000, 15500)
      expect(res.canComplete).toBe(true)
      expect(res.differenceToPay).toBe(5500)
      expect(res.remainingCredit).toBe(0)
      expect(res.status).toBe('due')
    })

    it('bloquea la finalización si los nuevos productos son de menor valor (no se entrega dinero en efectivo)', () => {
      const res = calculateExchangeBalance(10000, 7000)
      expect(res.canComplete).toBe(false)
      expect(res.differenceToPay).toBe(0)
      expect(res.remainingCredit).toBe(3000)
      expect(res.status).toBe('insufficient')
    })

    it('evalúa la ventana de 30 días emitiendo advertencia informativa', () => {
      const now = new Date('2026-09-29T12:00:00.000Z')
      // 10 días atrás
      const recentSale = '2026-09-19T12:00:00.000Z'
      const recentCheck = isExchangePeriodExceeded(recentSale, 30, now)
      expect(recentCheck.isExceeded).toBe(false)
      expect(recentCheck.daysDiff).toBe(10)

      // 45 días atrás (> 30 días)
      const oldSale = '2026-08-15T12:00:00.000Z'
      const oldCheck = isExchangePeriodExceeded(oldSale, 30, now)
      expect(oldCheck.isExceeded).toBe(true)
      expect(oldCheck.daysDiff).toBe(45)
    })
  })

  describe('Transaccionalidad en Base de Datos e Inventario (completeSale con exchangeInfo)', () => {
    let db: Database.Database
    let salesService: SalesService
    let cashService: CashService
    let productService: ProductService
    let sessionId: number

    beforeEach(() => {
      db = new Database(':memory:')
      db.pragma('foreign_keys = ON')
      runMigrations(db)

      salesService = new SalesService(db)
      cashService = new CashService(db)
      productService = new ProductService(db)

      const session = cashService.openSession(50000)
      sessionId = session.id

      // Crear productos para pruebas
      productService.upsertProduct({
        code: 'PROD-A',
        name: 'Lana Merino Azul',
        sale_price: 5000,
        stock: 10
      })

      productService.upsertProduct({
        code: 'PROD-B',
        name: 'Palillo Bambú 5mm',
        sale_price: 3000,
        stock: 10
      })

      productService.upsertProduct({
        code: 'PROD-C',
        name: 'Lana Seda Premium',
        sale_price: 8000,
        stock: 5
      })
    })

    afterEach(() => {
      if (db) db.close()
    })

    it('procesa un cambio de producto reponiendo stock devuelto y cobrando la diferencia', () => {
      // 1. Realizar venta original: 2 un PROD-A ($ 10.000)
      const originalSale = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'PROD-A', name: 'Lana Merino Azul', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      expect(originalSale.sale.folio).toBe(1)
      // Stock de PROD-A bajó de 10 a 8
      expect(productService.getProductByCode('PROD-A')?.stock).toBe(8)

      // 2. Cliente devuelve 1 un de PROD-A ($ 5.000 crédito) y lleva 1 un de PROD-C ($ 8.000)
      // Diferencia a pagar: 8.000 - 5.000 = 3.000
      const exchangeInfo: ExchangeInfo = {
        originalSaleId: originalSale.sale.id,
        originalFolio: originalSale.sale.folio,
        originalDate: originalSale.sale.completed_at || originalSale.sale.created_at,
        returnedItems: [
          { product_code: 'PROD-A', name: 'Lana Merino Azul', unit_price: 5000, quantity: 1 }
        ],
        exchangeCredit: 5000
      }

      const exchangeSaleInput: CompleteSaleInput = {
        cashSessionId: sessionId,
        items: [{ product_code: 'PROD-C', name: 'Lana Seda Premium', unit_price: 8000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3000 }],
        exchangeInfo
      }

      const exchangeResult = salesService.completeSale(exchangeSaleInput)

      // 3. Verificaciones
      // Folio global único nuevo para el cambio
      expect(exchangeResult.sale.folio).toBe(2)
      expect(exchangeResult.sale.total).toBe(8000)
      expect(exchangeResult.payments).toHaveLength(1)
      expect(exchangeResult.payments[0].amount).toBe(3000)

      // Stock de PROD-A devuelto se repuso: 8 + 1 = 9
      expect(productService.getProductByCode('PROD-A')?.stock).toBe(9)

      // Stock de PROD-C nuevo disminuyó: 5 - 1 = 4
      expect(productService.getProductByCode('PROD-C')?.stock).toBe(4)

      // Venta original tiene returned_qty = 1 en PROD-A
      const origDetail = salesService.getSaleDetail(originalSale.sale.id)
      const returnedItem = origDetail?.items.find((i) => i.product_code === 'PROD-A')
      expect(returnedItem?.returned_qty).toBe(1)

      // Auditoría en inventory_movements
      const movements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ? ORDER BY id DESC')
        .all('PROD-A') as any[]
      expect(movements[0].type).toBe('devolucion')
      expect(movements[0].delta).toBe(1)
      expect(movements[0].reason).toContain('Cambio por venta Folio #2')
    })

    it('procesa un cambio exacto sin pagos en dinero ($0 a pagar)', () => {
      // Venta original: 1 un PROD-C ($ 8.000)
      const originalSale = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'PROD-C', name: 'Lana Seda Premium', unit_price: 8000, quantity: 1 }],
        payments: [{ method: 'card', amount: 8000 }]
      })

      // Cliente devuelve 1 un PROD-C ($ 8.000) y lleva 1 un PROD-A ($ 5.000) + 1 un PROD-B ($ 3.000) = $ 8.000
      const exchangeInfo: ExchangeInfo = {
        originalSaleId: originalSale.sale.id,
        originalFolio: originalSale.sale.folio,
        originalDate: originalSale.sale.created_at,
        returnedItems: [
          { product_code: 'PROD-C', name: 'Lana Seda Premium', unit_price: 8000, quantity: 1 }
        ],
        exchangeCredit: 8000
      }

      const exchangeResult = salesService.completeSale({
        cashSessionId: sessionId,
        items: [
          { product_code: 'PROD-A', name: 'Lana Merino Azul', unit_price: 5000, quantity: 1 },
          { product_code: 'PROD-B', name: 'Palillo Bambú 5mm', unit_price: 3000, quantity: 1 }
        ],
        payments: [], // $ 0 por pagar
        exchangeInfo
      })

      expect(exchangeResult.sale.folio).toBe(2)
      expect(exchangeResult.sale.total).toBe(8000)
      expect(exchangeResult.sale.exchange_parent_id).toBe(originalSale.sale.id)
      expect(exchangeResult.sale.exchange_parent_folio).toBe(originalSale.sale.folio)
      expect(exchangeResult.payments).toHaveLength(0)

      // Stock de PROD-C devuelto se repuso de 4 a 5
      expect(productService.getProductByCode('PROD-C')?.stock).toBe(5)

      // Trazabilidad en getSalesHistory
      const history = salesService.getSalesHistory()
      const exchangeHistorySale = history.find((s) => s.id === exchangeResult.sale.id)
      expect(exchangeHistorySale?.exchange_parent_id).toBe(originalSale.sale.id)
      expect(exchangeHistorySale?.exchange_parent_folio).toBe(originalSale.sale.folio)

      // Trazabilidad en getSaleDetail de la venta hija (cambio)
      const childDetail = salesService.getSaleDetail(exchangeResult.sale.id)
      expect(childDetail?.exchange_parent_id).toBe(originalSale.sale.id)
      expect(childDetail?.exchange_parent_folio).toBe(originalSale.sale.folio)

      // Trazabilidad en getSaleDetail de la venta padre (origen)
      const parentDetail = salesService.getSaleDetail(originalSale.sale.id)
      expect(parentDetail?.child_exchanges).toBeDefined()
      expect(parentDetail?.child_exchanges).toHaveLength(1)
      expect(parentDetail?.child_exchanges?.[0].folio).toBe(exchangeResult.sale.folio)
    })

    it('rechaza el cambio si los nuevos productos son de menor valor que el crédito', () => {
      const originalSale = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'PROD-A', name: 'Lana Merino Azul', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      const exchangeInfo: ExchangeInfo = {
        originalSaleId: originalSale.sale.id,
        originalFolio: originalSale.sale.folio,
        originalDate: originalSale.sale.created_at,
        returnedItems: [
          { product_code: 'PROD-A', name: 'Lana Merino Azul', unit_price: 5000, quantity: 2 }
        ],
        exchangeCredit: 10000
      }

      // Intenta llevar solo 1 producto de $ 3.000 (menor valor que el crédito de $ 10.000)
      expect(() => {
        salesService.completeSale({
          cashSessionId: sessionId,
          items: [{ product_code: 'PROD-B', name: 'Palillo Bambú 5mm', unit_price: 3000, quantity: 1 }],
          payments: [],
          exchangeInfo
        })
      }).toThrow(/debe ser igual o superior al crédito por cambio/)
    })
  })

  describe('Preservación de Pestaña de Cambio en Zustand Store (useSalesStore)', () => {
    it('mantiene la pestaña de cambio sin ser sobrescrita al volver a la vista de ventas', async () => {
      // Import store dynamically or test state logic
      const { useSalesStore } = await import('../renderer/src/store/salesStore')
      
      // Mock window.api.sales
      ;(global as any).window = {
        api: {
          sales: {
            getPending: async () => [],
            getNextTicketNumber: async () => 1
          }
        }
      }

      // 1. Simular carga inicial de ventas pendientes
      await useSalesStore.getState().loadPendingTickets(1)
      expect(useSalesStore.getState().tickets.length).toBe(1)
      expect(useSalesStore.getState().isInitialized).toBe(true)

      // 2. Crear ticket de cambio desde Historial
      const dummyExchange: ExchangeInfo = {
        originalSaleId: 99,
        originalFolio: 1234,
        originalDate: new Date().toISOString(),
        returnedItems: [{ product_code: 'TEST-1', name: 'Item Test', unit_price: 5000, quantity: 1 }],
        exchangeCredit: 5000
      }

      await useSalesStore.getState().createExchangeTicket(dummyExchange, 1)

      const stateAfterExchange = useSalesStore.getState()
      expect(stateAfterExchange.tickets.length).toBe(1)
      expect(stateAfterExchange.tickets[0].label).toBe('CAMBIO (Venta #1234)')
      expect(stateAfterExchange.tickets[0].exchangeInfo).toBeDefined()
      expect(stateAfterExchange.tickets[0].exchangeInfo?.exchangeCredit).toBe(5000)

      // 3. Simular montaje de SalesView al cambiar de pestaña activa (vuelve a ejecutar loadPendingTickets)
      await useSalesStore.getState().loadPendingTickets(1)

      // 4. Verificar que NO se borró el ticket de cambio
      const stateAfterRemount = useSalesStore.getState()
      expect(stateAfterRemount.tickets.length).toBe(1)
      expect(stateAfterRemount.tickets[0].label).toBe('CAMBIO (Venta #1234)')
      expect(stateAfterRemount.tickets[0].exchangeInfo?.originalFolio).toBe(1234)
    })
  })
})

