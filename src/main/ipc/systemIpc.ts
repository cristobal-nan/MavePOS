import { ipcMain, BrowserWindow } from 'electron'
import { SettingsService } from '../services/settingsService'
import { BackupService } from '../services/backupService'

export function registerSystemIpc(
  mainWindow: BrowserWindow,
  settingsService: SettingsService,
  backupService: BackupService
): void {
  let isQuittingFromRenderer = false

  // ---------------- Ping & Health & Reset ----------------
  ipcMain.handle('db:ping', () => {
    return { ok: true, timestamp: new Date().toISOString() }
  })

  ipcMain.handle('db:reset', (_event, keepSettings = false) => {
    settingsService.resetDatabase(keepSettings)
    return { ok: true }
  })

  // ---------------- Settings ----------------
  ipcMain.handle('settings:get', (_event, key: string, defaultValue = null) => {
    return settingsService.get(key, defaultValue)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    return settingsService.set(key, value)
  })

  ipcMain.handle('settings:getAll', () => {
    return settingsService.getAll()
  })

  // ---------------- Backups ----------------
  ipcMain.handle('backup:create', async () => {
    return await backupService.createBackup()
  })

  ipcMain.handle('backup:list', () => {
    return backupService.listBackups()
  })

  ipcMain.handle('backup:getDirectory', () => {
    return backupService.getBackupDirectory()
  })

  ipcMain.handle('backup:openDirectory', () => {
    return backupService.openBackupDirectory()
  })

  ipcMain.handle('backup:selectDirectory', () => {
    return backupService.selectBackupDirectory(mainWindow)
  })

  ipcMain.handle('backup:restore', (_event, backupFilePath: string) => {
    backupService.restoreBackup(backupFilePath)
    return { ok: true }
  })

  // ---------------- Close Hook & Application Exit ----------------
  ipcMain.handle('app:confirm-close', async (_event, shouldBackup: boolean) => {
    isQuittingFromRenderer = true
    if (shouldBackup) {
      try {
        await backupService.createBackup()
      } catch (err) {
        console.error('Error al realizar respaldo antes de salir:', err)
      }
    }
    mainWindow.close()
  })

  // Intercept window close to trigger the close prompt flow in renderer
  mainWindow.on('close', (e) => {
    if (!isQuittingFromRenderer) {
      e.preventDefault()
      // Send close prompt event to renderer
      mainWindow.webContents.send('app:prompt-close')
    }
  })
}
