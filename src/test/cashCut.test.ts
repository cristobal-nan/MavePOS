import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { CashService } from '../main/services/cashService'
import { SalesService } from '../main/services/salesService'
import { ProductService } from '../main/services/productService'

describe('Fase 8: Corte de Caja (Arqueo, Cuadre de Turno y Cierre de Sesión)', () => {
  let db: Database.Database
  let cashService: CashService
  let salesService: SalesService
  let productService: ProductService
  let sessionId: number

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    cashService = new CashService(db)
    salesService = new SalesService(db)
    productService = new ProductService(db)

    // Apertura de sesión con fondo de $50.000
    const session = cashService.openSession(50000)
    sessionId = session.id

    // Productos de prueba
    productService.upsertProduct({
      code: 'ITEM-1',
      name: 'Ovillo Algodón Soft',
      sale_price: 4000,
      stock: 100,
      min_stock: 10
    })

    productService.upsertProduct({
      code: 'ITEM-2',
      name: 'Palillos Circulares Bambú',
      sale_price: 7000,
      stock: 50,
      min_stock: 5
    })
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Cálculo del Resumen de Corte de Caja (getSessionSummary)', () => {
    it('calcula correctamente el resumen en una sesión sin movimientos', () => {
      const summary = cashService.getSessionSummary(sessionId)

      expect(summary.sessionId).toBe(sessionId)
      expect(summary.openingFund).toBe(50000)
      expect(summary.salesCash).toBe(0)
      expect(summary.salesCard).toBe(0)
      expect(summary.salesTransfer).toBe(0)
      expect(summary.salesTotal).toBe(0)
      expect(summary.salesCount).toBe(0)
      expect(summary.returnsTotal).toBe(0)
      expect(summary.returnsCash).toBe(0)
      expect(summary.withdrawalsTotal).toBe(0)
      expect(summary.netSales).toBe(0)
      expect(summary.expectedCash).toBe(50000)
      expect(summary.closedAt).toBeNull()
    })

    it('calcula las ventas por método (efectivo, tarjeta, transferencia) y el efectivo esperado', () => {
      // Venta 1: Efectivo $8.000 (2 un. ITEM-1)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 8000 }]
      })

      // Venta 2: Tarjeta $14.000 (2 un. ITEM-2)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-2', name: 'Palillos Circulares Bambú', unit_price: 7000, quantity: 2 }],
        payments: [{ method: 'card', amount: 14000 }]
      })

      // Venta 3: Transferencia $4.000 (1 un. ITEM-1)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 1 }],
        payments: [{ method: 'transfer', amount: 4000 }]
      })

      // Salida de dinero: $5.000 (pago repartidor)
      cashService.addMovement(sessionId, 5000, 'Pago delivery')

      const summary = cashService.getSessionSummary(sessionId)

      expect(summary.openingFund).toBe(50000)
      expect(summary.salesCash).toBe(8000)
      expect(summary.salesCard).toBe(14000)
      expect(summary.salesTransfer).toBe(4000)
      expect(summary.salesTotal).toBe(26000)
      expect(summary.salesCount).toBe(3)
      expect(summary.withdrawalsTotal).toBe(5000)
      expect(summary.withdrawalsCount).toBe(1)
      expect(summary.returnsTotal).toBe(0)
      expect(summary.returnsCash).toBe(0)
      expect(summary.netSales).toBe(26000)

      // Efectivo esperado = 50.000 + 8.000 - 5.000 = 53.000
      expect(summary.expectedCash).toBe(53000)
    })

    it('deduce exactamente las cancelaciones y devoluciones parciales del arqueo', () => {
      // Venta 1: Efectivo $12.000 (3 un. ITEM-1)
      const sale1 = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 3 }],
        payments: [{ method: 'cash', amount: 12000 }]
      })

      // Venta 2: Efectivo $4.000 (1 un. ITEM-1), luego se cancela
      const sale2 = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 4000 }]
      })

      // Cancelamos Venta 2
      salesService.cancelSale(sale2.sale.id, 'Cliente desistió')

      // Devolución parcial de 1 un. en Venta 1 ($4.000)
      salesService.returnSaleItem(sale1.sale.id, 'ITEM-1', 1, 'Error de color')

      // Salida de caja: $2.000
      cashService.addMovement(sessionId, 2000, 'Insumos de aseo')

      const summary = cashService.getSessionSummary(sessionId)

      // Ventas totales brutas: 12.000 + 4.000 = 16.000
      expect(summary.salesTotal).toBe(16000)
      expect(summary.salesCash).toBe(16000)

      // Devoluciones: cancelada (4.000) + parcial (4.000) = 8.000
      expect(summary.returnsTotal).toBe(8000)
      expect(summary.returnsCash).toBe(8000)
      expect(summary.returnsCount).toBe(2)
      expect(summary.netSales).toBe(8000)

      // Efectivo esperado = 50.000 (apertura) + 16.000 (ventas efectivo) - 8.000 (devoluciones) - 2.000 (salidas) = 56.000
      expect(summary.expectedCash).toBe(56000)
    })
  })

  describe('Cierre de Sesión con Arqueo de Caja (closeSession)', () => {
    it('cierra la sesión registrando el conteo real, diferencia y observaciones', () => {
      // Registrar venta en efectivo por $10.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 8000 }]
      })

      const summaryBefore = cashService.getSessionSummary(sessionId)
      expect(summaryBefore.expectedCash).toBe(58000) // 50.000 + 8.000

      // El cajero cuenta físicamente $58.500 (sobrante de $500)
      const closed = cashService.closeSession(sessionId, {
        closingCash: 58500,
        expectedCash: 58000,
        difference: 500,
        notes: 'Sobrante de $500 por redondeo de sencillo'
      })

      expect(closed.closed_at).not.toBeNull()
      expect(closed.closing_cash).toBe(58500)
      expect(closed.expected_cash).toBe(58000)
      expect(closed.difference).toBe(500)
      expect(closed.notes).toBe('Sobrante de $500 por redondeo de sencillo')

      // Verificar que la sesión activa ahora es null
      expect(cashService.getCurrentOpenSession()).toBeNull()

      // Verificar que el resumen refleja el cierre
      const summaryAfter = cashService.getSessionSummary(sessionId)
      expect(summaryAfter.closedAt).not.toBeNull()
      expect(summaryAfter.closingCash).toBe(58500)
      expect(summaryAfter.difference).toBe(500)
    })

    it('arroja error al intentar cerrar una sesión ya cerrada', () => {
      cashService.closeSession(sessionId)
      expect(() => cashService.closeSession(sessionId)).toThrow('La sesión de caja ya se encuentra cerrada')
    })

    it('permite listar sesiones cerradas históricas ordenadas cronológicamente inverso', () => {
      cashService.closeSession(sessionId, { closingCash: 50000, difference: 0 })

      // Abrir y cerrar una segunda sesión
      const session2 = cashService.openSession(30000)
      cashService.closeSession(session2.id, { closingCash: 30000, difference: 0 })

      const past = cashService.getPastSessions()
      expect(past.length).toBe(2)
      expect(past[0].id).toBe(session2.id)
      expect(past[1].id).toBe(sessionId)
    })
  })
})
