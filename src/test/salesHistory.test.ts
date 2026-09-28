import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SalesService } from '../main/services/salesService'
import { ProductService } from '../main/services/productService'
import { CashService } from '../main/services/cashService'

describe('Fase 7: Historial y Dinero (Devoluciones, Cancelaciones y Salidas de Caja)', () => {
  let db: Database.Database
  let salesService: SalesService
  let productService: ProductService
  let cashService: CashService
  let cashSessionId: number

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    salesService = new SalesService(db)
    productService = new ProductService(db)
    cashService = new CashService(db)

    const session = cashService.openSession(50000)
    cashSessionId = session.id

    // Crear productos de prueba
    productService.upsertProduct({
      code: 'PROD-A',
      name: 'Hilo Algodón Premium',
      sale_price: 3000,
      stock: 20,
      min_stock: 5
    })

    productService.upsertProduct({
      code: 'PROD-B',
      name: 'Lana Merino Extra',
      sale_price: 5000,
      stock: 15,
      min_stock: 3
    })
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Historial de Ventas y Detalle', () => {
    it('lista el historial de ventas completadas con desglose de items y pagos', () => {
      // Registrar venta 1
      salesService.completeSale({
        cashSessionId,
        items: [{ product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 6000 }]
      })

      // Registrar venta 2
      salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 1 },
          { product_code: 'PROD-B', name: 'Lana Merino Extra', unit_price: 5000, quantity: 2 }
        ],
        payments: [{ method: 'card', amount: 13000 }]
      })

      const history = salesService.getSalesHistory()
      expect(history.length).toBe(2)
      expect(history[0].folio).toBe(2)
      expect(history[0].total).toBe(13000)
      expect(history[0].total_items).toBe(3)
      expect(history[0].returned_items_count).toBe(0)
      expect(history[0].payments[0].method).toBe('card')

      expect(history[1].folio).toBe(1)
      expect(history[1].total).toBe(6000)
      expect(history[1].total_items).toBe(2)
    })

    it('permite filtrar el historial por folio exacto', () => {
      salesService.completeSale({
        cashSessionId,
        items: [{ product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3000 }]
      })
      salesService.completeSale({
        cashSessionId,
        items: [{ product_code: 'PROD-B', name: 'Lana Merino Extra', unit_price: 5000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 5000 }]
      })

      const filtered = salesService.getSalesHistory({ folio: 1 })
      expect(filtered.length).toBe(1)
      expect(filtered[0].folio).toBe(1)
    })

    it('obtiene el detalle íntegro de una venta específica', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 2 }
        ],
        payments: [{ method: 'cash', amount: 6000 }]
      })

      const detail = salesService.getSaleDetail(completed.sale.id)
      expect(detail).not.toBeNull()
      expect(detail!.id).toBe(completed.sale.id)
      expect(detail!.folio).toBe(completed.sale.folio)
      expect(detail!.items.length).toBe(1)
      expect(detail!.items[0].product_code).toBe('PROD-A')
      expect(detail!.items[0].quantity).toBe(2)
      expect(detail!.items[0].returned_qty).toBe(0)
      expect(detail!.payments.length).toBe(1)
      expect(detail!.payments[0].amount).toBe(6000)
    })
  })

  describe('Cancelación Total de Ventas', () => {
    it('cancela una venta completa, restaura el 100% del stock y registra movimientos de inventario', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 5 },
          { product_code: 'PROD-B', name: 'Lana Merino Extra', unit_price: 5000, quantity: 3 }
        ],
        payments: [{ method: 'cash', amount: 30000 }]
      })

      // Stock tras la venta:
      // PROD-A: 20 - 5 = 15
      // PROD-B: 15 - 3 = 12
      expect(productService.getProductByCode('PROD-A')!.stock).toBe(15)
      expect(productService.getProductByCode('PROD-B')!.stock).toBe(12)

      // Cancelar venta
      const updated = salesService.cancelSale(completed.sale.id, 'Cliente solicitó anulación')
      expect(updated.status).toBe('cancelled')
      expect(updated.returned_items_count).toBe(8)

      // Stock debe estar 100% restaurado
      expect(productService.getProductByCode('PROD-A')!.stock).toBe(20)
      expect(productService.getProductByCode('PROD-B')!.stock).toBe(15)

      // Verificar movimientos de inventario
      const movements = db
        .prepare("SELECT * FROM inventory_movements WHERE ref_sale_id = ? AND type = 'devolucion'")
        .all(completed.sale.id) as any[]

      expect(movements.length).toBe(2)
      expect(movements.find((m) => m.product_code === 'PROD-A')?.delta).toBe(5)
      expect(movements.find((m) => m.product_code === 'PROD-B')?.delta).toBe(3)
      expect(movements[0].reason).toBe('Cliente solicitó anulación')
    })

    it('arroja error al intentar cancelar una venta ya cancelada', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [{ product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3000 }]
      })

      salesService.cancelSale(completed.sale.id)
      expect(() => salesService.cancelSale(completed.sale.id)).toThrow('Esta venta ya se encuentra cancelada')
    })
  })

  describe('Devolución Parcial de Productos', () => {
    it('permite devolver una cantidad parcial de un producto y reponer su stock', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 5 }
        ],
        payments: [{ method: 'cash', amount: 15000 }]
      })

      // Stock inicial: 20 - 5 = 15
      expect(productService.getProductByCode('PROD-A')!.stock).toBe(15)

      // Devolvemos 2 unidades
      const afterReturn = salesService.returnSaleItem(
        completed.sale.id,
        'PROD-A',
        2,
        'Cliente cambió de opinión'
      )

      expect(afterReturn.status).toBe('completed') // Sigue completed porque aún quedan 3 no devueltos
      expect(afterReturn.items[0].returned_qty).toBe(2)
      expect(afterReturn.returned_items_count).toBe(2)

      // Stock repuesto en 2: 15 + 2 = 17
      expect(productService.getProductByCode('PROD-A')!.stock).toBe(17)

      // Movimiento de inventario
      const mov = db
        .prepare("SELECT * FROM inventory_movements WHERE ref_sale_id = ? AND type = 'devolucion'")
        .get(completed.sale.id) as any
      expect(mov).toBeDefined()
      expect(mov.delta).toBe(2)
      expect(mov.reason).toBe('Cliente cambió de opinión')
    })

    it('impide devolver más unidades que las disponibles', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [{ product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 6000 }]
      })

      expect(() => salesService.returnSaleItem(completed.sale.id, 'PROD-A', 3)).toThrow(
        /No se pueden devolver 3 unidades/
      )
    })

    it('marca automáticamente la venta como cancelada cuando todos los productos han sido devueltos', () => {
      const completed = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: 'PROD-A', name: 'Hilo Algodón Premium', unit_price: 3000, quantity: 2 },
          { product_code: 'PROD-B', name: 'Lana Merino Extra', unit_price: 5000, quantity: 1 }
        ],
        payments: [{ method: 'cash', amount: 11000 }]
      })

      // Devolvemos los 2 de PROD-A
      const r1 = salesService.returnSaleItem(completed.sale.id, 'PROD-A', 2)
      expect(r1.status).toBe('completed')

      // Devolvemos el único de PROD-B
      const r2 = salesService.returnSaleItem(completed.sale.id, 'PROD-B', 1)
      expect(r2.status).toBe('cancelled')
      expect(r2.returned_items_count).toBe(3)
    })
  })

  describe('Salidas de Dinero de Caja', () => {
    it('registra una salida de dinero vinculada a la sesión de caja actual', () => {
      const movement = cashService.addMovement(cashSessionId, 15000, 'Pago a repartidor')

      expect(movement.id).toBeGreaterThan(0)
      expect(movement.cash_session_id).toBe(cashSessionId)
      expect(movement.type).toBe('salida')
      expect(movement.amount).toBe(15000)
      expect(movement.reason).toBe('Pago a repartidor')

      const movements = cashService.getSessionMovements(cashSessionId)
      expect(movements.length).toBe(1)
      expect(movements[0].amount).toBe(15000)
    })

    it('valida que el monto sea un entero positivo y el motivo no esté vacío', () => {
      expect(() => cashService.addMovement(cashSessionId, 0, 'Motivo')).toThrow(
        /monto de la salida de dinero debe ser un entero positivo/
      )
      expect(() => cashService.addMovement(cashSessionId, -500, 'Motivo')).toThrow(
        /monto de la salida de dinero debe ser un entero positivo/
      )
      expect(() => cashService.addMovement(cashSessionId, 5000, '   ')).toThrow(
        /Debe especificar un motivo/
      )
    })
  })
})
