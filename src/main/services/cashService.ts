import Database from 'better-sqlite3'
import {
  CashSession,
  CashMovement,
  CashCutSummary,
  CloseCashSessionInput
} from '../../shared/types'

export class CashService {
  constructor(private db: Database.Database) {}

  getCurrentOpenSession(): CashSession | null {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')
      .get() as CashSession | undefined
    return session || null
  }

  openSession(openingFund: number): CashSession {
    if (!Number.isInteger(openingFund) || openingFund < 0) {
      throw new Error('El fondo de caja debe ser un entero mayor o igual a cero')
    }

    const current = this.getCurrentOpenSession()
    if (current) {
      throw new Error(`Ya existe una sesión de caja abierta (Sesión #${current.id})`)
    }

    const now = new Date().toISOString()
    const result = this.db
      .prepare('INSERT INTO cash_sessions (opening_fund, opened_at, closed_at) VALUES (?, ?, NULL)')
      .run(openingFund, now)

    return {
      id: Number(result.lastInsertRowid),
      opening_fund: openingFund,
      opened_at: now,
      closed_at: null
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

    this.db
      .prepare(`
        UPDATE cash_sessions
        SET closed_at = ?, closing_cash = ?, expected_cash = ?, difference = ?, notes = ?
        WHERE id = ?
      `)
      .run(now, closingCash, expectedCash, difference, notes, sessionId)

    return {
      ...session,
      closed_at: now,
      closing_cash: closingCash,
      expected_cash: expectedCash,
      difference,
      notes
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
    const netSales = salesStats.sales_total - returnsTotal

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
    const expectedCash =
      session.opening_fund +
      salesStats.sales_cash -
      returnsCash -
      withdrawalsStats.withdrawals_total

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
      notes: session.notes ?? null
    }
  }

  getPastSessions(limit = 50, offset = 0): CashSession[] {
    return this.db
      .prepare(`
        SELECT * FROM cash_sessions
        WHERE closed_at IS NOT NULL
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as CashSession[]
  }

  getLastClosedSession(): CashSession | null {
    const session = this.db
      .prepare('SELECT * FROM cash_sessions WHERE closed_at IS NOT NULL ORDER BY id DESC LIMIT 1')
      .get() as CashSession | undefined
    return session || null
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
}
