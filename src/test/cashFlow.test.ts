import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { CashService } from '../main/services/cashService'

describe('Fase 3: Flujo de Arranque de Caja (Sin sesión / Con sesión)', () => {
  let db: Database.Database
  let cashService: CashService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    cashService = new CashService(db)
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('al iniciar por primera vez, no existe sesión abierta (desencadena pantalla de apertura)', () => {
    const session = cashService.getCurrentOpenSession()
    expect(session).toBeNull()
  })

  it('permite registrar la apertura con fondo de caja y cambia el estado a sesión activa', () => {
    const newSession = cashService.openSession(50000)
    expect(newSession.id).toBeGreaterThan(0)
    expect(newSession.opening_fund).toBe(50000)
    expect(newSession.closed_at).toBeNull()

    const activeSession = cashService.getCurrentOpenSession()
    expect(activeSession).not.toBeNull()
    expect(activeSession?.id).toBe(newSession.id)
    expect(activeSession?.opening_fund).toBe(50000)
  })

  it('al reiniciar la app con sesión abierta, entra directo retornando la sesión activa', () => {
    cashService.openSession(75000)

    // Simula reinicio de la app leyendo la base de datos existente
    const current = cashService.getCurrentOpenSession()
    expect(current).not.toBeNull()
    expect(current?.opening_fund).toBe(75000)
    expect(current?.closed_at).toBeNull()
  })

  it('tras el cierre de caja, vuelve a quedar sin sesión abierta para el siguiente inicio', () => {
    const session = cashService.openSession(50000)
    cashService.closeSession(session.id)

    const current = cashService.getCurrentOpenSession()
    expect(current).toBeNull()
  })
})
