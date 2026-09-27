import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs'
import { SettingsService } from './settingsService'
import { BackupInfo } from '../../shared/types'

export const MAX_BACKUPS_RETENTION = 7

export class BackupService {
  constructor(
    private db: Database.Database,
    private settingsService?: SettingsService
  ) {}

  getBackupDirectory(): string {
    if (this.settingsService) {
      const configured = this.settingsService.get('backup_directory')
      if (configured && configured.trim()) {
        return configured.trim()
      }
    }

    const documentsPath = app
      ? app.getPath('documents')
      : join(process.env.USERPROFILE || process.cwd(), 'Documents')
    return join(documentsPath, 'Respaldos POS')
  }

  ensureBackupDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  async createBackup(targetDirectory?: string): Promise<string> {
    const dir = targetDirectory || this.getBackupDirectory()
    this.ensureBackupDirectory(dir)

    const pad = (n: number, z = 2): string => String(n).padStart(z, '0')
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`

    const filename = `pos_backup_${timestamp}.db`
    const destPath = join(dir, filename)

    // db.backup() ensures consistency with active WAL transactions
    await this.db.backup(destPath)

    // Enforce retention limit (keep the last 7)
    this.enforceRetention(dir)

    return destPath
  }

  listBackups(targetDirectory?: string): BackupInfo[] {
    const dir = targetDirectory || this.getBackupDirectory()
    if (!existsSync(dir)) {
      return []
    }

    const files = readdirSync(dir)
    const backupFiles = files
      .filter((file) => file.startsWith('pos_backup_') && file.endsWith('.db'))
      .map((file) => {
        const filepath = join(dir, file)
        const stats = statSync(filepath)
        return {
          filename: file,
          filepath,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString()
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // newest first

    return backupFiles
  }

  enforceRetention(dir: string): void {
    const backups = this.listBackups(dir)
    if (backups.length > MAX_BACKUPS_RETENTION) {
      const toDelete = backups.slice(MAX_BACKUPS_RETENTION)
      for (const item of toDelete) {
        try {
          if (existsSync(item.filepath)) {
            unlinkSync(item.filepath)
          }
        } catch (err) {
          console.error(`Error eliminando respaldo antiguo ${item.filepath}:`, err)
        }
      }
    }
  }

  restoreBackup(backupFilePath: string, currentDbPath: string): void {
    if (!existsSync(backupFilePath)) {
      throw new Error('El archivo de respaldo no existe')
    }

    // Replace current database file with the backup
    copyFileSync(backupFilePath, currentDbPath)
  }
}
