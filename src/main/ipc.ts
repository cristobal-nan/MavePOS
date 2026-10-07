import { BrowserWindow } from 'electron'
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

import { registerCatalogIpc } from './ipc/catalogIpc'
import { registerSalesIpc } from './ipc/salesIpc'
import { registerCashIpc } from './ipc/cashIpc'
import { registerInventoryIpc } from './ipc/inventoryIpc'
import { registerReportsIpc } from './ipc/reportsIpc'
import { registerDevicesIpc } from './ipc/devicesIpc'
import { registerSystemIpc } from './ipc/systemIpc'

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

  // Register domain IPC modules
  registerCatalogIpc(productService, supplierService, excelService, mainWindow)
  registerSalesIpc(salesService)
  registerCashIpc(cashService)
  registerInventoryIpc(inventoryService, excelService, mainWindow)
  registerReportsIpc(reportService)
  registerDevicesIpc(printerService, mainWindow)
  registerSystemIpc(mainWindow, settingsService, backupService)

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
