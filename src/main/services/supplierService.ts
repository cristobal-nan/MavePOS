import Database from 'better-sqlite3'
import { Supplier } from '../../shared/types'
import { normalizeSearchName } from '../db/utils'

export class SupplierService {
  constructor(private db: Database.Database) {}

  getAllSuppliers(includeInactive = false): Supplier[] {
    const query = includeInactive
      ? 'SELECT * FROM suppliers ORDER BY name ASC'
      : 'SELECT * FROM suppliers WHERE active = 1 ORDER BY name ASC'
    return this.db.prepare(query).all() as Supplier[]
  }

  getSupplierById(id: number): Supplier | null {
    const row = this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as Supplier | undefined
    return row || null
  }

  saveSupplier(name: string, id?: number): Supplier {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('El nombre del proveedor no puede estar vacío.')
    }

    const searchName = normalizeSearchName(trimmedName)
    const now = new Date().toISOString()

    if (id) {
      this.db
        .prepare('UPDATE suppliers SET name = ?, search_name = ?, updated_at = ? WHERE id = ?')
        .run(trimmedName, searchName, now, id)
      return { id, name: trimmedName, search_name: searchName, active: 1, created_at: now, updated_at: now }
    } else {
      const result = this.db
        .prepare('INSERT INTO suppliers (name, search_name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
        .run(trimmedName, searchName, now, now)
      const newId = Number(result.lastInsertRowid)
      return { id: newId, name: trimmedName, search_name: searchName, active: 1, created_at: now, updated_at: now }
    }
  }

  deleteSupplier(id: number): boolean {
    const now = new Date().toISOString()
    // Soft delete
    const result = this.db.prepare('UPDATE suppliers SET active = 0, updated_at = ? WHERE id = ?').run(now, id)
    return result.changes > 0
  }
}
