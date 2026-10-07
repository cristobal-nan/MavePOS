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

    it('registra y persiste desglose de billetes, monto de retiro y fondos para el siguiente turno', () => {
      // Registrar venta con efectivo y tarjeta
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 8000 }]
      })

      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-2', name: 'Palillos Circulares Bambú', unit_price: 7000, quantity: 1 }],
        payments: [{ method: 'card', amount: 7000 }]
      })

      const openingDenominations = { 20000: 2, 10000: 1 } // 50.000
      const closingDenominations = { 20000: 2, 10000: 1, 5000: 1, 2000: 1, 1000: 1 } // 58.000
      const nextOpeningDenominations = { 10000: 1, 5000: 1, 2000: 1, 1000: 1 } // 18.000 (se retiran los 2 de 20.000)
      const withdrawalAmount = 40000

      const closed = cashService.closeSession(sessionId, {
        closingCash: 58000,
        expectedCash: 58000,
        difference: 0,
        openingDenominations,
        closingDenominations,
        nextOpeningDenominations,
        withdrawalAmount,
        cardDifference: 0
      })

      expect(closed.withdrawal_amount).toBe(40000)
      expect(closed.sales_cash).toBe(8000)
      expect(closed.sales_card).toBe(7000)
      expect(closed.sales_transfer).toBe(0)
      expect(closed.card_difference).toBe(0)

      // Verificar getLastClosedSession
      const lastClosed = cashService.getLastClosedSession()
      expect(lastClosed).not.toBeNull()
      expect(lastClosed?.id).toBe(sessionId)
      expect(lastClosed?.next_opening_denominations).toEqual(nextOpeningDenominations)
      expect(lastClosed?.withdrawal_amount).toBe(40000)

      // Verificar getPastSessions
      const pastSessions = cashService.getPastSessions()
      expect(pastSessions.length).toBe(1)
      expect(pastSessions[0].sales_cash).toBe(8000)
      expect(pastSessions[0].sales_card).toBe(7000)
      expect(pastSessions[0].withdrawal_amount).toBe(40000)
      expect(pastSessions[0].closing_denominations).toEqual(closingDenominations)
    })

    it('permite abrir una nueva sesión heredando las denominaciones del turno anterior', () => {
      // Cerrar sesión actual con denominaciones para el siguiente
      cashService.closeSession(sessionId, {
        closingCash: 50000,
        nextOpeningDenominations: { 10000: 2, 5000: 2 } // 30.000
      })

      // Abrir nueva sesión pasando las denominaciones heredadas
      const newSession = cashService.openSession(30000, { 10000: 2, 5000: 2 })
      expect(newSession.id).toBeGreaterThan(sessionId)
      expect(newSession.opening_fund).toBe(30000)

      const active = cashService.getCurrentOpenSession()
      expect(active?.id).toBe(newSession.id)
      const parsedOpening = typeof active?.opening_denominations === 'string'
        ? JSON.parse(active.opening_denominations)
        : active?.opening_denominations
      expect(parsedOpening).toEqual({ 10000: 2, 5000: 2 })
    })

    it('registra y persiste cuadre de pagos con tarjeta y transferencias con sus diferencias', () => {
      // Venta con tarjeta $14.000 y transferencia $4.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-2', name: 'Palillos Circulares Bambú', unit_price: 7000, quantity: 2 }],
        payments: [{ method: 'card', amount: 14000 }]
      })

      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', unit_price: 4000, quantity: 1 }],
        payments: [{ method: 'transfer', amount: 4000 }]
      })

      // El cajero ingresa $14.500 en máquina POS (sobrante +500) y $4.000 en banco (cuadrada 0)
      const closed = cashService.closeSession(sessionId, {
        closingCash: 50000,
        expectedCash: 50000,
        difference: 0,
        cardMachineAmount: 14500,
        cardDifference: 500,
        transferVerifiedAmount: 4000,
        transferDifference: 0
      })

      expect(closed.card_machine_amount).toBe(14500)
      expect(closed.card_difference).toBe(500)
      expect(closed.transfer_verified_amount).toBe(4000)
      expect(closed.transfer_difference).toBe(0)

      // Verificar en getSessionSummary
      const summary = cashService.getSessionSummary(sessionId)
      expect(summary.cardMachineAmount).toBe(14500)
      expect(summary.cardDifference).toBe(500)
      expect(summary.transferVerifiedAmount).toBe(4000)
      expect(summary.transferDifference).toBe(0)

      // Verificar en getPastSessions
      const past = cashService.getPastSessions()
      expect(past[0].card_machine_amount).toBe(14500)
      expect(past[0].card_difference).toBe(500)
      expect(past[0].transfer_verified_amount).toBe(4000)
      expect(past[0].transfer_difference).toBe(0)
    })
  })

  describe('Cierre de caja sin ventas: descartar sin registrar vs guardar igual', () => {
    it('descarta la sesión sin ventas eliminándola de la base de datos y no aparece en getPastSessions', () => {
      // sessionId no tiene ventas
      const summary = cashService.getSessionSummary(sessionId)
      expect(summary.salesCount).toBe(0)
      expect(summary.salesTotal).toBe(0)

      // Se descarta la sesión
      const discarded = cashService.discardSession(sessionId)
      expect(discarded).toBe(true)

      // Ya no hay sesión activa
      expect(cashService.getCurrentOpenSession()).toBeNull()

      // No figura en el historial de cortes
      const past = cashService.getPastSessions()
      expect(past.find((s) => s.id === sessionId)).toBeUndefined()
    })

    it('no permite descartar una sesión si ya se completaron ventas', () => {
      // Registrar una venta
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', quantity: 1, unit_price: 4000 }],
        payments: [{ method: 'cash', amount: 4000 }]
      })

      expect(() => cashService.discardSession(sessionId)).toThrow(
        'No se puede descartar una sesión de caja con ventas registradas'
      )
    })

    it('al descartar una sesión sin ventas, elimina tickets pendientes en standby y movimientos asociados', () => {
      // Guardar ticket pendiente en standby
      salesService.savePendingSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ITEM-1', name: 'Ovillo Algodón Soft', quantity: 2, unit_price: 4000 }]
      })

      // Registrar una salida de dinero
      cashService.addMovement(sessionId, 5000, 'Compra insumos de prueba')

      // Descartar la sesión
      const discarded = cashService.discardSession(sessionId)
      expect(discarded).toBe(true)

      // No quedan tickets pendientes ni movimientos
      const pending = salesService.getPendingSales(sessionId)
      expect(pending).toHaveLength(0)

      const movements = cashService.getSessionMovements(sessionId)
      expect(movements).toHaveLength(0)

      expect(cashService.getCurrentOpenSession()).toBeNull()
    })

    it('permite guardar igual en el historial si el usuario lo decide (botón secundario)', () => {
      // Cerrar normalmente aunque no haya ventas (Guardar igual)
      const closed = cashService.closeSession(sessionId, {
        closingCash: 50000,
        expectedCash: 50000,
        difference: 0,
        notes: 'Cierre sin ventas registrado a petición del usuario'
      })

      expect(closed.closed_at).not.toBeNull()
      expect(closed.notes).toBe('Cierre sin ventas registrado a petición del usuario')

      // Sí figura en el historial de cortes
      const past = cashService.getPastSessions()
      expect(past.find((s) => s.id === sessionId)).toBeDefined()
    })
  })
})

