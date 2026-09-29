import Database from 'better-sqlite3'

export class SettingsService {
  constructor(private db: Database.Database) {}

  get(key: string, defaultValue: string | null = null): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row ? row.value : defaultValue
  }

  set(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const result: Record<string, string> = {}
    for (const r of rows) {
      result[r.key] = r.value
    }
    return result
  }

  resetDatabase(keepSettings = false): void {
    const tx = this.db.transaction(() => {
      this.db.pragma('foreign_keys = OFF')
      try {
        this.db.prepare('DELETE FROM sale_payments').run()
        this.db.prepare('DELETE FROM sale_items').run()
        this.db.prepare('DELETE FROM sales').run()
        this.db.prepare('DELETE FROM inventory_movements').run()
        this.db.prepare('DELETE FROM cash_movements').run()
        this.db.prepare('DELETE FROM cash_sessions').run()
        this.db.prepare('DELETE FROM product_suppliers').run()
        this.db.prepare('DELETE FROM suppliers').run()
        this.db.prepare('DELETE FROM products').run()
        this.db.prepare('DELETE FROM categories').run()
        if (!keepSettings) {
          this.db.prepare('DELETE FROM settings').run()
        }
        try {
          this.db
            .prepare(
              "DELETE FROM sqlite_sequence WHERE name IN ('sales', 'sale_items', 'sale_payments', 'products', 'categories', 'suppliers', 'cash_sessions', 'cash_movements', 'inventory_movements')"
            )
            .run()
        } catch {
          // ignore if sqlite_sequence doesn't exist
        }
      } finally {
        this.db.pragma('foreign_keys = ON')
      }
    })

    tx()
  }
}
