import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { runMigrations } from './migrations'

let dbInstance: Database.Database | null = null

export function initDatabase(customPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance
  }

  let dbPath: string
  if (customPath) {
    dbPath = customPath
  } else {
    // In production or development electron app, store in userData directory
    const userDataPath = app ? app.getPath('userData') : process.cwd()
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    dbPath = join(userDataPath, 'pos.db')
  }

  const db = new Database(dbPath)

  // Configure SQLite for high performance and integrity
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Run initial schema & migrations
  runMigrations(db)

  dbInstance = db
  return dbInstance
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    return initDatabase()
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close()
    } finally {
      dbInstance = null
    }
  }
}
