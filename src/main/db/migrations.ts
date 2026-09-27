import Database from 'better-sqlite3'
import { INITIAL_SCHEMA } from './schema'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(INITIAL_SCHEMA)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const getAppliedVersions = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
  const rows = getAppliedVersions.all() as { version: number }[]
  const appliedSet = new Set(rows.map((r) => r.version))

  const insertMigration = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      const applyTx = db.transaction(() => {
        migration.up(db)
        insertMigration.run(migration.version, new Date().toISOString())
      })
      applyTx()
    }
  }
}
