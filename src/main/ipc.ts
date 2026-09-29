import { ipcMain, BrowserWindow, dialog } from 'electron'
import { getDatabase } from './db/db'
import { ProductService } from './services/productService'
import { CashService } from './services/cashService'
import { SettingsService } from './services/settingsService'
import { BackupService } from './services/backupService'
import { SalesService } from './services/salesService'
import { InventoryService } from './services/inventoryService'
import { ExcelService } from './services/excelService'
import { SupplierService } from './services/supplierService'
import { ReportService } from './services/reportService'
import { PrinterService } from './services/printerService'
import {
  ProductInput,
  ProductSearchOptions,
  CartItem,
  CompleteSaleInput,
  AdjustStockInput,
  MovementType,
  SalesHistoryFilter,
  ExcelColumnMapping,
  GroupAsVariableInput,
  ReportFilter,
  PrinterConfig,
  SaleDetail
} from '../shared/types'

let isQuittingFromRenderer = false

export function registerIpcHandlers(mainWindow: BrowserWindow): {
  productService: ProductService
  cashService: CashService
  settingsService: SettingsService
  backupService: BackupService
  salesService: SalesService
  inventoryService: InventoryService
  excelService: ExcelService
  supplierService: SupplierService
  reportService: ReportService
  printerService: PrinterService
} {
  const db = getDatabase()
  const productService = new ProductService(db)
  const cashService = new CashService(db)
  const settingsService = new SettingsService(db)
  const backupService = new BackupService(db, settingsService)
  const salesService = new SalesService(db)
  const inventoryService = new InventoryService(db)
  const excelService = new ExcelService(db)
  const supplierService = new SupplierService(db)
  const reportService = new ReportService(db)
  const printerService = new PrinterService(db, settingsService)

  // ---------------- Ping & Health & Reset ----------------
  ipcMain.handle('db:ping', () => {
    return { ok: true, timestamp: new Date().toISOString() }
  })

  ipcMain.handle('db:reset', (_event, keepSettings = false) => {
    settingsService.resetDatabase(keepSettings)
    return { ok: true }
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

  ipcMain.handle('products:getById', (_event, id: number, includeInactive = false) => {
    return productService.getProductById(id, includeInactive)
  })

  ipcMain.handle('products:getVariations', (_event, parentId: number, includeInactive = false) => {
    return productService.getVariations(parentId, includeInactive)
  })

  ipcMain.handle('products:saveVariable', (_event, parent: ProductInput, variations: ProductInput[]) => {
    return productService.saveVariableProduct(parent, variations)
  })

  ipcMain.handle('products:bulkUpdateCategory', (_event, productIds: number[], categoryId?: number | null, supplierIds?: number[]) => {
    return productService.bulkUpdateCategory(productIds, categoryId, supplierIds)
  })

  ipcMain.handle('products:groupAsVariable', (_event, input: GroupAsVariableInput) => {
    return productService.groupProductsAsVariable(input)
  })

  ipcMain.handle('products:bulkDelete', (_event, productIds: number[]) => {
    return productService.bulkSoftDelete(productIds)
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

  // ---------------- Suppliers ----------------
  ipcMain.handle('suppliers:getAll', (_event, includeInactive = false) => {
    return supplierService.getAllSuppliers(includeInactive)
  })

  ipcMain.handle('suppliers:save', (_event, name: string, id?: number) => {
    return supplierService.saveSupplier(name, id)
  })

  ipcMain.handle('suppliers:delete', (_event, id: number) => {
    return supplierService.deleteSupplier(id)
  })

  // ---------------- Cash Sessions ----------------
  ipcMain.handle('cash:getCurrentSession', () => {
    return cashService.getCurrentOpenSession()
  })

  ipcMain.handle('cash:openSession', (_event, openingFund: number) => {
    return cashService.openSession(openingFund)
  })

  ipcMain.handle('cash:closeSession', (_event, sessionId: number, closingData?: any) => {
    return cashService.closeSession(sessionId, closingData)
  })

  ipcMain.handle('cash:getSessionSummary', (_event, sessionId: number) => {
    return cashService.getSessionSummary(sessionId)
  })

  ipcMain.handle('cash:getPastSessions', (_event, limit?: number, offset?: number) => {
    return cashService.getPastSessions(limit, offset)
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

  // ---------------- Sales & Tickets ----------------
  ipcMain.handle('sales:getNextFolio', () => {
    return salesService.getNextFolio()
  })

  ipcMain.handle('sales:getNextTicketNumber', (_event, openTickets?: number[], cashSessionId?: number) => {
    return salesService.getNextTicketNumber(openTickets, cashSessionId)
  })

  ipcMain.handle('sales:getPending', (_event, cashSessionId?: number) => {
    return salesService.getPendingSales(cashSessionId)
  })

  ipcMain.handle('sales:savePending', (_event, data: { id?: number; cashSessionId: number | null; items: CartItem[] }) => {
    return salesService.savePendingSale(data)
  })

  ipcMain.handle('sales:deletePending', (_event, saleId: number) => {
    return salesService.deletePendingSale(saleId)
  })

  ipcMain.handle('sales:complete', (_event, input: CompleteSaleInput) => {
    return salesService.completeSale(input)
  })

  ipcMain.handle('sales:getHistory', (_event, filter?: SalesHistoryFilter) => {
    return salesService.getSalesHistory(filter)
  })

  ipcMain.handle('sales:getDetail', (_event, saleId: number) => {
    return salesService.getSaleDetail(saleId)
  })

  ipcMain.handle('sales:cancel', (_event, saleId: number, reason?: string) => {
    return salesService.cancelSale(saleId, reason)
  })

  ipcMain.handle('sales:returnItem', (_event, saleId: number, productCode: string, quantity: number, reason?: string) => {
    return salesService.returnSaleItem(saleId, productCode, quantity, reason)
  })

  // ---------------- Inventory ----------------
  ipcMain.handle('inventory:adjustStock', (_event, input: AdjustStockInput) => {
    return inventoryService.adjustStock(input)
  })

  ipcMain.handle('inventory:getLowStock', (_event, limit = 100, offset = 0) => {
    return inventoryService.getLowStockProducts(limit, offset)
  })

  ipcMain.handle('inventory:getMovements', (_event, dateStr?: string, type?: MovementType) => {
    return inventoryService.getMovementsByDate(dateStr, type)
  })

  ipcMain.handle('inventory:getKardex', (_event, productCode: string, limit = 100) => {
    return inventoryService.getProductKardex(productCode, limit)
  })

  // ---------------- Excel Import (Fase 10) ----------------
  ipcMain.handle('excel:selectFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar archivo Excel de Catálogo',
      filters: [{ name: 'Hojas de Cálculo Excel (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('excel:parseFile', (_event, filePath: string) => {
    return excelService.parseExcelFile(filePath)
  })

  ipcMain.handle('excel:importFile', (_event, filePath: string, customMapping?: Partial<ExcelColumnMapping>) => {
    return excelService.importExcel(filePath, customMapping)
  })

  // ---------------- Printers & ESC/POS (Fase 9) ----------------
  ipcMain.handle('printers:getList', () => {
    return printerService.getInstalledPrinters(mainWindow)
  })

  ipcMain.handle('printers:getConfig', () => {
    return printerService.getPrinterConfig()
  })

  ipcMain.handle('printers:saveConfig', (_event, config: Partial<PrinterConfig>) => {
    printerService.savePrinterConfig(config)
    return { ok: true }
  })

  ipcMain.handle(
    'printers:printThermal',
    (_event, saleDetail: SaleDetail, change = 0, customConfig?: Partial<PrinterConfig>) => {
      return printerService.printThermalReceipt(saleDetail, change, customConfig)
    }
  )

  ipcMain.handle('printers:openCashDrawer', (_event, customConfig?: Partial<PrinterConfig>) => {
    return printerService.openCashDrawer(customConfig)
  })

  ipcMain.handle('printers:testThermal', (_event, customConfig?: Partial<PrinterConfig>) => {
    return printerService.printTestTicket(customConfig)
  })

  ipcMain.handle('printers:printNormal', (_event, saleDetail: SaleDetail, printerName?: string) => {
    return printerService.printNormalReceipt(saleDetail, printerName)
  })

  return {
    productService,
    cashService,
    settingsService,
    backupService,
    salesService,
    inventoryService,
    excelService,
    supplierService,
    reportService,
    printerService
  }
}
