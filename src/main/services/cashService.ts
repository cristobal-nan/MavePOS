import Database from 'better-sqlite3'
import { CashSession, CashMovement } from '../../shared/types'

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

  closeSession(sessionId: number): CashSession {
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
    this.db.prepare('UPDATE cash_sessions SET closed_at = ? WHERE id = ?').run(now, sessionId)

    return {
      ...session,
      closed_at: now
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
}
