import Database from 'better-sqlite3'
import {
  CashSession,
  CashMovement,
  CashCutSummary,
  CloseCashSessionInput
} from '../../shared/types'
import { calculateExpectedCash, calculateNetSales } from '../../shared/finance'

export class CashService {
  constructor(private db: Database.Database) {}

  getCurrentOpenSession(): CashSession | null {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')
      .get() as CashSession | undefined
    return session || null
  }

  openSession(openingFund: number, openingDenominations?: Record<number, number>): CashSession {
    if (!Number.isInteger(openingFund) || openingFund < 0) {
      throw new Error('El fondo de caja debe ser un entero mayor o igual a cero')
    }

    const current = this.getCurrentOpenSession()
    if (current) {
      throw new Error(`Ya existe una sesión de caja abierta (Sesión #${current.id})`)
    }

    const now = new Date().toISOString()
    const openingDenomsStr = openingDenominations ? JSON.stringify(openingDenominations) : null

    const result = this.db
      .prepare('INSERT INTO cash_sessions (opening_fund, opened_at, closed_at, opening_denominations) VALUES (?, ?, NULL, ?)')
      .run(openingFund, now, openingDenomsStr)

    return {
      id: Number(result.lastInsertRowid),
      opening_fund: openingFund,
      opened_at: now,
      closed_at: null,
      opening_denominations: openingDenomsStr
    }
  }

  closeSession(
    sessionId: number,
    closingData?: Omit<CloseCashSessionInput, 'sessionId'>
  ): CashSession {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId) as CashSession | undefined

    if (!session) {
      throw new Error('Sesión de caja no encontrada')
    }
    if (session.closed_at !== null) {
      throw new Error('La sesión de caja ya se encuentra cerrada')
    }

    const now = new Date().toISOString()
    const closingCash = closingData?.closingCash ?? null
    const expectedCash = closingData?.expectedCash ?? null
    const difference = closingData?.difference ?? null
    const notes = closingData?.notes ? closingData.notes.trim() : null

    // Denominaciones y desglose de retiro
    const openingDenomsStr = closingData?.openingDenominations
      ? JSON.stringify(closingData.openingDenominations)
      : session.opening_denominations ?? null
    const closingDenomsStr = closingData?.closingDenominations
      ? JSON.stringify(closingData.closingDenominations)
      : null
    const nextOpeningDenomsStr = closingData?.nextOpeningDenominations
      ? JSON.stringify(closingData.nextOpeningDenominations)
      : null
    const withdrawalAmount = closingData?.withdrawalAmount ?? null
    const cardMachineAmount = closingData?.cardMachineAmount ?? null
    const cardDiff = closingData?.cardDifference ?? 0
    const transferVerifiedAmount = closingData?.transferVerifiedAmount ?? null
    const transferDiff = closingData?.transferDifference ?? 0

    // Si no se pasaron las ventas por método, calcularlas directamente
    let salesCash = closingData?.salesCash ?? null
    let salesCard = closingData?.salesCard ?? null
    let salesTransfer = closingData?.salesTransfer ?? null

    if (salesCash === null || salesCard === null || salesTransfer === null) {
      const salesQuery = this.db
        .prepare(`
          SELECT
            COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount ELSE 0 END), 0) AS sales_cash,
            COALESCE(SUM(CASE WHEN sp.method = 'card' THEN sp.amount ELSE 0 END), 0) AS sales_card,
            COALESCE(SUM(CASE WHEN sp.method = 'transfer' THEN sp.amount ELSE 0 END), 0) AS sales_transfer
          FROM sales s
          JOIN sale_payments sp ON s.id = sp.sale_id
          WHERE s.cash_session_id = ?
        `)
        .get(sessionId) as { sales_cash: number; sales_card: number; sales_transfer: number } | undefined

      if (salesQuery) {
        salesCash = salesCash ?? salesQuery.sales_cash
        salesCard = salesCard ?? salesQuery.sales_card
        salesTransfer = salesTransfer ?? salesQuery.sales_transfer
      }
    }

    this.db
      .prepare(`
        UPDATE cash_sessions
        SET closed_at = ?, closing_cash = ?, expected_cash = ?, difference = ?, notes = ?,
            opening_denominations = ?, closing_denominations = ?, next_opening_denominations = ?,
            withdrawal_amount = ?, sales_cash = ?, sales_card = ?, sales_transfer = ?,
            card_machine_amount = ?, card_difference = ?, transfer_verified_amount = ?, transfer_difference = ?
        WHERE id = ?
      `)
      .run(
        now,
        closingCash,
        expectedCash,
        difference,
        notes,
        openingDenomsStr,
        closingDenomsStr,
        nextOpeningDenomsStr,
        withdrawalAmount,
        salesCash,
        salesCard,
        salesTransfer,
        cardMachineAmount,
        cardDiff,
        transferVerifiedAmount,
        transferDiff,
        sessionId
      )

    return {
      ...session,
      closed_at: now,
      closing_cash: closingCash,
      expected_cash: expectedCash,
      difference,
      notes,
      opening_denominations: closingData?.openingDenominations ?? (session.opening_denominations ? (typeof session.opening_denominations === 'string' ? JSON.parse(session.opening_denominations) : session.opening_denominations) : null),
      closing_denominations: closingData?.closingDenominations ?? null,
      next_opening_denominations: closingData?.nextOpeningDenominations ?? null,
      withdrawal_amount: withdrawalAmount,
      sales_cash: salesCash,
      sales_card: salesCard,
      sales_transfer: salesTransfer,
      card_machine_amount: cardMachineAmount,
      card_difference: cardDiff,
      transfer_verified_amount: transferVerifiedAmount,
      transfer_difference: transferDiff
    }
  }

  getSessionSummary(sessionId: number): CashCutSummary {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId) as CashSession | undefined

    if (!session) {
      throw new Error(`Sesión de caja #${sessionId} no encontrada`)
    }

    // 1. Ventas por método de pago (todas las ventas originadas en esta sesión)
    const salesStats = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount ELSE 0 END), 0) AS sales_cash,
          COALESCE(SUM(CASE WHEN sp.method = 'card' THEN sp.amount ELSE 0 END), 0) AS sales_card,
          COALESCE(SUM(CASE WHEN sp.method = 'transfer' THEN sp.amount ELSE 0 END), 0) AS sales_transfer,
          COALESCE(SUM(sp.amount), 0) AS sales_total,
          COUNT(DISTINCT s.id) AS sales_count
        FROM sales s
        JOIN sale_payments sp ON s.id = sp.sale_id
        WHERE s.cash_session_id = ?
      `)
      .get(sessionId) as {
        sales_cash: number
        sales_card: number
        sales_transfer: number
        sales_total: number
        sales_count: number
      }

    // 2. Devoluciones:
    // a) Ventas canceladas en su totalidad
    const cancelledSales = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(s.total), 0) AS cancelled_total,
          COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount ELSE 0 END), 0) AS cancelled_cash,
          COUNT(DISTINCT s.id) AS cancelled_count
        FROM sales s
        LEFT JOIN sale_payments sp ON s.id = sp.sale_id
        WHERE s.cash_session_id = ? AND s.status = 'cancelled'
      `)
      .get(sessionId) as {
        cancelled_total: number
        cancelled_cash: number
        cancelled_count: number
      }

    // b) Devoluciones parciales en ventas de esta sesión que aún permanecen completadas
    const partialReturns = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(si.returned_qty * si.unit_price), 0) AS partial_total,
          COUNT(DISTINCT CASE WHEN si.returned_qty > 0 THEN s.id END) AS partial_count
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.cash_session_id = ? AND s.status = 'completed'
      `)
      .get(sessionId) as {
        partial_total: number
        partial_count: number
      }

    // Calcular la parte en efectivo de devoluciones parciales
    const completedSalesWithReturns = this.db
      .prepare(`
        SELECT s.id, s.total
        FROM sales s
        WHERE s.cash_session_id = ? AND s.status = 'completed' AND
              EXISTS (SELECT 1 FROM sale_items WHERE sale_id = s.id AND returned_qty > 0)
      `)
      .all(sessionId) as { id: number; total: number }[]

    let partialCashTotal = 0
    for (const s of completedSalesWithReturns) {
      const retRow = this.db
        .prepare(`
          SELECT COALESCE(SUM(returned_qty * unit_price), 0) AS ret_sum
          FROM sale_items WHERE sale_id = ?
        `)
        .get(s.id) as { ret_sum: number }

      const cashRow = this.db
        .prepare(`
          SELECT COALESCE(SUM(amount), 0) AS cash_amt
          FROM sale_payments WHERE sale_id = ? AND method = 'cash'
        `)
        .get(s.id) as { cash_amt: number }

      if (cashRow.cash_amt >= s.total) {
        partialCashTotal += retRow.ret_sum
      } else if (cashRow.cash_amt > 0 && s.total > 0) {
        const cashRatio = cashRow.cash_amt / s.total
        partialCashTotal += Math.round(retRow.ret_sum * cashRatio)
      }
    }

    const returnsTotal = cancelledSales.cancelled_total + partialReturns.partial_total
    const returnsCash = cancelledSales.cancelled_cash + partialCashTotal
    const returnsCount = cancelledSales.cancelled_count + partialReturns.partial_count
    const netSales = calculateNetSales(salesStats.sales_total, returnsTotal)

    // 3. Salidas de dinero de caja
    const withdrawalsStats = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(amount), 0) AS withdrawals_total,
          COUNT(*) AS withdrawals_count
        FROM cash_movements
        WHERE cash_session_id = ? AND type = 'salida'
      `)
      .get(sessionId) as {
        withdrawals_total: number
        withdrawals_count: number
      }

    // 4. Efectivo esperado en gaveta:
    // Fondo de apertura + Ventas en efectivo - Devoluciones en efectivo - Salidas de dinero
    const expectedCash = calculateExpectedCash(
      session.opening_fund,
      salesStats.sales_cash,
      returnsCash,
      withdrawalsStats.withdrawals_total
    )

    return {
      sessionId: session.id,
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      openingFund: session.opening_fund,
      salesCash: salesStats.sales_cash,
      salesCard: salesStats.sales_card,
      salesTransfer: salesStats.sales_transfer,
      salesTotal: salesStats.sales_total,
      salesCount: salesStats.sales_count,
      returnsTotal,
      returnsCash,
      returnsCount,
      withdrawalsTotal: withdrawalsStats.withdrawals_total,
      withdrawalsCount: withdrawalsStats.withdrawals_count,
      netSales,
      expectedCash,
      closingCash: session.closing_cash ?? null,
      difference: session.difference ?? null,
      notes: session.notes ?? null,
      withdrawalAmount: session.withdrawal_amount ?? null,
      cardMachineAmount: session.card_machine_amount ?? null,
      cardDifference: session.card_difference ?? 0,
      transferVerifiedAmount: session.transfer_verified_amount ?? null,
      transferDifference: session.transfer_difference ?? 0,
      openingDenominations: session.opening_denominations
        ? typeof session.opening_denominations === 'string'
          ? JSON.parse(session.opening_denominations)
          : session.opening_denominations
        : null,
      closingDenominations: session.closing_denominations
        ? typeof session.closing_denominations === 'string'
          ? JSON.parse(session.closing_denominations)
          : session.closing_denominations
        : null,
      nextOpeningDenominations: session.next_opening_denominations
        ? typeof session.next_opening_denominations === 'string'
          ? JSON.parse(session.next_opening_denominations)
          : session.next_opening_denominations
        : null
    }
  }

  getPastSessions(limit = 100, offset = 0): CashSession[] {
    const rows = this.db
      .prepare(`
        SELECT
          cs.*,
          COALESCE(cs.sales_cash, (
            SELECT COALESCE(SUM(sp.amount), 0)
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.cash_session_id = cs.id AND sp.method = 'cash'
          )) AS sales_cash,
          COALESCE(cs.sales_card, (
            SELECT COALESCE(SUM(sp.amount), 0)
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.cash_session_id = cs.id AND sp.method = 'card'
          )) AS sales_card,
          COALESCE(cs.sales_transfer, (
            SELECT COALESCE(SUM(sp.amount), 0)
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.cash_session_id = cs.id AND sp.method = 'transfer'
          )) AS sales_transfer
        FROM cash_sessions cs
        WHERE cs.closed_at IS NOT NULL
        ORDER BY cs.id DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as any[]

    return rows.map((cs) => ({
      ...cs,
      opening_denominations: cs.opening_denominations ? (typeof cs.opening_denominations === 'string' ? JSON.parse(cs.opening_denominations) : cs.opening_denominations) : null,
      closing_denominations: cs.closing_denominations ? (typeof cs.closing_denominations === 'string' ? JSON.parse(cs.closing_denominations) : cs.closing_denominations) : null,
      next_opening_denominations: cs.next_opening_denominations ? (typeof cs.next_opening_denominations === 'string' ? JSON.parse(cs.next_opening_denominations) : cs.next_opening_denominations) : null
    }))
  }

  getLastClosedSession(): CashSession | null {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE closed_at IS NOT NULL ORDER BY id DESC LIMIT 1')
      .get() as any
    if (!session) return null
    return {
      ...session,
      opening_denominations: session.opening_denominations ? (typeof session.opening_denominations === 'string' ? JSON.parse(session.opening_denominations) : session.opening_denominations) : null,
      closing_denominations: session.closing_denominations ? (typeof session.closing_denominations === 'string' ? JSON.parse(session.closing_denominations) : session.closing_denominations) : null,
      next_opening_denominations: session.next_opening_denominations ? (typeof session.next_opening_denominations === 'string' ? JSON.parse(session.next_opening_denominations) : session.next_opening_denominations) : null
    }
  }

  addMovement(sessionId: number, amount: number, reason: string): CashMovement {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('El monto de la salida de dinero debe ser un entero positivo')
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new Error('Debe especificar un motivo para la salida de dinero')
    }

    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId) as CashSession | undefined

    if (!session || session.closed_at !== null) {
      throw new Error('No se puede registrar movimiento en una sesión de caja inexistente o cerrada')
    }

    const now = new Date().toISOString()
    const result = this.db
      .prepare('INSERT INTO cash_movements (cash_session_id, type, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, 'salida', amount, trimmedReason, now)

    return {
      id: Number(result.lastInsertRowid),
      cash_session_id: sessionId,
      type: 'salida',
      amount,
      reason: trimmedReason,
      created_at: now
    }
  }

  getSessionMovements(sessionId: number): CashMovement[] {
    return this.db
      .prepare('SELECT * FROM cash_movements WHERE cash_session_id = ? ORDER BY id ASC')
      .all(sessionId) as CashMovement[]
  }

  discardSession(sessionId: number): boolean {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId) as CashSession | undefined

    if (!session) {
      throw new Error('Sesión de caja no encontrada')
    }
    if (session.closed_at !== null) {
      throw new Error('La sesión de caja ya se encuentra cerrada')
    }

    // Comprobar que no existan ventas registradas (completadas o canceladas)
    const existingSales = this.db
      .prepare("SELECT COUNT(*) as count FROM sales WHERE cash_session_id = ? AND status != 'pending'")
      .get(sessionId) as { count: number }

    if (existingSales && existingSales.count > 0) {
      throw new Error('No se puede descartar una sesión de caja con ventas registradas')
    }

    // Eliminar tickets pendientes en standby si hubiesen
    const pendingSales = this.db
      .prepare("SELECT id FROM sales WHERE cash_session_id = ? AND status = 'pending'")
      .all(sessionId) as { id: number }[]

    for (const ps of pendingSales) {
      this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(ps.id)
      this.db.prepare('DELETE FROM sales WHERE id = ?').run(ps.id)
    }

    // Eliminar movimientos de efectivo asociados si hubiesen
    this.db.prepare('DELETE FROM cash_movements WHERE cash_session_id = ?').run(sessionId)

    // Eliminar la sesión para que no figure en el historial de cortes
    this.db.prepare('DELETE FROM cash_sessions WHERE id = ?').run(sessionId)

    return true
  }
}

