import { ipcMain, BrowserWindow } from 'electron'
import { getDatabase } from './db/db'
import { ProductService } from './services/productService'
import { CashService } from './services/cashService'
import { SettingsService } from './services/settingsService'
import { BackupService } from './services/backupService'
import { ProductInput, ProductSearchOptions } from '../shared/types'

let isQuittingFromRenderer = false

export function registerIpcHandlers(mainWindow: BrowserWindow): {
  productService: ProductService
  cashService: CashService
  settingsService: SettingsService
  backupService: BackupService
} {
  const db = getDatabase()
  const productService = new ProductService(db)
  const cashService = new CashService(db)
  const settingsService = new SettingsService(db)
  const backupService = new BackupService(db, settingsService)

  // ---------------- Ping & Health ----------------
  ipcMain.handle('db:ping', () => {
    return { ok: true, timestamp: new Date().toISOString() }
  })

  // ---------------- Products, Categories, Families ----------------
  ipcMain.handle('products:save', (_event, input: ProductInput) => {
    return productService.upsertProduct(input)
  })

  ipcMain.handle('products:getByCode', (_event, code: string, includeInactive = false) => {
    return productService.getProductByCode(code, includeInactive)
  })

  ipcMain.handle('products:delete', (_event, code: string) => {
    return productService.softDeleteProduct(code)
  })

  ipcMain.handle('products:getActive', (_event, limit = 100, offset = 0) => {
    return productService.getActiveProducts(limit, offset)
  })

  ipcMain.handle('products:search', (_event, options: ProductSearchOptions) => {
    return productService.searchProducts(options)
  })

  ipcMain.handle('products:seed', () => {
    productService.seedSampleData()
    return true
  })

  ipcMain.handle('categories:getAll', () => {
    return productService.getAllCategories()
  })

  ipcMain.handle('categories:save', (_event, name: string, parentId: number | null = null, id?: number) => {
    return productService.saveCategory(name, parentId, id)
  })

  ipcMain.handle('categories:delete', (_event, id: number) => {
    return productService.deleteCategory(id)
  })

  ipcMain.handle('families:getAll', () => {
    return productService.getAllFamilies()
  })

  ipcMain.handle('families:save', (_event, name: string, categoryId: number | null = null, id?: number) => {
    return productService.saveFamily(name, categoryId, id)
  })

  ipcMain.handle('families:delete', (_event, id: number) => {
    return productService.deleteFamily(id)
  })

  // ---------------- Cash Sessions ----------------
  ipcMain.handle('cash:getCurrentSession', () => {
    return cashService.getCurrentOpenSession()
  })

  ipcMain.handle('cash:openSession', (_event, openingFund: number) => {
    return cashService.openSession(openingFund)
  })

  ipcMain.handle('cash:closeSession', (_event, sessionId: number) => {
    return cashService.closeSession(sessionId)
  })

  ipcMain.handle('cash:addMovement', (_event, sessionId: number, amount: number, reason: string) => {
    return cashService.addMovement(sessionId, amount, reason)
  })

  ipcMain.handle('cash:getSessionMovements', (_event, sessionId: number) => {
    return cashService.getSessionMovements(sessionId)
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

  return { productService, cashService, settingsService, backupService }
}
