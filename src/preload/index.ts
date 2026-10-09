import { contextBridge, ipcRenderer } from 'electron'
import {
  Category,
  Product,
  ProductInput,
  ProductSearchResult,
  ProductSearchOptions,
  CashSession,
  CashMovement,
  CashCutSummary,
  CloseCashSessionInput,
  BackupInfo,
  CartItem,
  PendingTicket,
  CompleteSaleInput,
  CompletedSaleResult,
  AdjustStockInput,
  InventoryMovement,
  InventoryMovementDetail,
  MovementType,
  Sale,
  SalePayment,
  SaleDetail,
  SalesHistoryFilter,
  PaymentMethod,
  ExcelColumnMapping,
  ExcelParsePreview,
  ImportReportResult,
  GroupAsVariableInput,
  Supplier,
  ReportFilter,
  FullReportData,
  PrinterInfo,
  PrinterConfig,
  PrintResult,
  ExportExcelResult,
  ImportExcelOptions
} from '../shared/types'

// Domain API interfaces
export interface CatalogAPI {
  saveProduct: (input: ProductInput) => Promise<Product>
  saveVariableProduct: (parent: ProductInput, variations: ProductInput[]) => Promise<{ parent: Product; variations: Product[] }>
  getByCode: (code: string, includeInactive?: boolean) => Promise<Product | null>
  getById: (id: number, includeInactive?: boolean) => Promise<Product | null>
  getVariations: (parentId: number, includeInactive?: boolean) => Promise<Product[]>
  deleteProduct: (codeOrId: string | number) => Promise<boolean>
  bulkDelete: (productIds: number[]) => Promise<{ deletedCount: number }>
  bulkUpdateCategory: (productIds: number[], categoryId?: number | null, supplierIds?: number[]) => Promise<{ updatedCount: number }>
  groupAsVariable: (input: GroupAsVariableInput) => Promise<{ parentId: number; count: number }>
  getActive: (limit?: number, offset?: number) => Promise<Product[]>
  search: (options?: ProductSearchOptions) => Promise<ProductSearchResult[]>
  seedSampleData: () => Promise<boolean>
  getCategories: () => Promise<Category[]>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  getSuppliers: (includeInactive?: boolean) => Promise<Supplier[]>
  saveSupplier: (name: string, id?: number) => Promise<Supplier>
  deleteSupplier: (id: number) => Promise<boolean>
  selectExcelFile: () => Promise<string | null>
  parseExcelFile: (filePath: string) => Promise<ExcelParsePreview>
  importExcelFile: (filePath: string, customMapping?: Partial<ExcelColumnMapping>, options?: ImportExcelOptions) => Promise<ImportReportResult>
  exportExcel: (defaultPrefix?: string, productIds?: number[]) => Promise<{ filePath: string; totalExported: number } | null>
  openContainingFolder: (filePath: string) => Promise<boolean>
}

export interface SalesAPI {
  getNextFolio: () => Promise<number>
  getNextTicketNumber: (openTickets?: number[], cashSessionId?: number | null) => Promise<number>
  getPending: (cashSessionId?: number) => Promise<PendingTicket[]>
  savePending: (data: { id?: number; ticket_number?: number; cashSessionId: number | null; items: CartItem[] }) => Promise<PendingTicket>
  deletePending: (saleId: number) => Promise<boolean>
  complete: (input: CompleteSaleInput) => Promise<CompletedSaleResult>
  getHistory: (filter?: SalesHistoryFilter) => Promise<(Sale & { payments: SalePayment[]; total_items: number; returned_items_count: number })[]>
  getDetail: (saleId: number) => Promise<SaleDetail | null>
  cancel: (saleId: number, reason?: string) => Promise<SaleDetail>
  returnItem: (saleId: number, productCode: string, quantity: number, reason?: string) => Promise<SaleDetail>
  updatePaymentMethod: (saleId: number, newMethod: PaymentMethod) => Promise<SaleDetail>
}

export interface CashAPI {
  getCurrentSession: () => Promise<CashSession | null>
  openSession: (openingFund: number, openingDenominations?: Record<number, number>) => Promise<CashSession>
  closeSession: (sessionId: number, closingData?: Omit<CloseCashSessionInput, 'sessionId'>) => Promise<CashSession>
  discardSession: (sessionId: number) => Promise<boolean>
  getSessionSummary: (sessionId: number) => Promise<CashCutSummary>
  getPastSessions: (limit?: number, offset?: number) => Promise<CashSession[]>
  getLastClosedSession: () => Promise<CashSession | null>
  addMovement: (sessionId: number, amount: number, reason: string) => Promise<CashMovement>
  getSessionMovements: (sessionId: number) => Promise<CashMovement[]>
}

export interface InventoryAPI {
  adjustStock: (input: AdjustStockInput) => Promise<{ product: Product; movement: InventoryMovement }>
  getLowStock: (limit?: number, offset?: number) => Promise<(ProductSearchResult & { min_stock: number })[]>
  getMovements: (dateStr?: string, type?: MovementType) => Promise<InventoryMovementDetail[]>
  getKardex: (productCode: string, limit?: number) => Promise<InventoryMovementDetail[]>
  exportMovementsExcel: (dateStr: string, movements: InventoryMovementDetail[]) => Promise<ExportExcelResult | null>
  exportKardexExcel: (
    productInfo: { code: string; name: string; category_name?: string | null; current_stock: number },
    limit?: number
  ) => Promise<ExportExcelResult | null>
}

export interface ReportsAPI {
  getData: (filter: ReportFilter) => Promise<FullReportData>
  exportExcel: (filter: ReportFilter) => Promise<{ success: boolean; filePath?: string }>
}

export interface DevicesAPI {
  getPrinters: () => Promise<PrinterInfo[]>
  getConfig: () => Promise<PrinterConfig>
  saveConfig: (config: Partial<PrinterConfig>) => Promise<{ ok: boolean }>
  printThermal: (saleDetail: SaleDetail, change?: number, customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  openCashDrawer: (customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  testThermal: (customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  printNormal: (saleDetail: SaleDetail, printerName?: string) => Promise<PrintResult>
}

export interface SystemAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  onPromptClose: (callback: () => void) => () => void
  confirmClose: (shouldBackup: boolean) => Promise<void>
  pingDb: () => Promise<{ ok: boolean; timestamp: string }>
  resetDatabase: (keepSettings?: boolean) => Promise<{ ok: boolean }>
  getSetting: (key: string, defaultValue?: string | null) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  getAllSettings: () => Promise<Record<string, string>>
  createBackup: () => Promise<string>
  listBackups: () => Promise<BackupInfo[]>
  getBackupDirectory: () => Promise<string>
  openBackupDirectory: () => Promise<boolean>
  selectBackupDirectory: () => Promise<string | null>
  selectExternalBackup: () => Promise<BackupInfo | null>
  restoreBackup: (backupFilePath: string) => Promise<{ ok: boolean }>
}

export interface WindowAPI {
  // Domain Namespaces
  catalog: CatalogAPI
  sales: SalesAPI
  cash: CashAPI
  inventory: InventoryAPI
  reports: ReportsAPI
  devices: DevicesAPI
  system: SystemAPI

  // Backward compatibility flat methods
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  onPromptClose: (callback: () => void) => () => void
  confirmClose: (shouldBackup: boolean) => Promise<void>
  pingDb: () => Promise<{ ok: boolean; timestamp: string }>
  resetDatabase: (keepSettings?: boolean) => Promise<{ ok: boolean }>

  saveProduct: (input: ProductInput) => Promise<Product>
  saveVariableProduct: (parent: ProductInput, variations: ProductInput[]) => Promise<{ parent: Product; variations: Product[] }>
  getProductByCode: (code: string, includeInactive?: boolean) => Promise<Product | null>
  getProductById: (id: number, includeInactive?: boolean) => Promise<Product | null>
  getVariations: (parentId: number, includeInactive?: boolean) => Promise<Product[]>
  deleteProduct: (codeOrId: string | number) => Promise<boolean>
  bulkDeleteProducts: (productIds: number[]) => Promise<{ deletedCount: number }>
  bulkUpdateCategory: (productIds: number[], categoryId?: number | null, supplierIds?: number[]) => Promise<{ updatedCount: number }>
  groupProductsAsVariable: (input: GroupAsVariableInput) => Promise<{ parentId: number; count: number }>
  getActiveProducts: (limit?: number, offset?: number) => Promise<Product[]>
  searchProducts: (options?: ProductSearchOptions) => Promise<ProductSearchResult[]>
  seedSampleData: () => Promise<boolean>

  getCategories: () => Promise<Category[]>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>

  getSuppliers: (includeInactive?: boolean) => Promise<Supplier[]>
  saveSupplier: (name: string, id?: number) => Promise<Supplier>
  deleteSupplier: (id: number) => Promise<boolean>

  getCurrentCashSession: () => Promise<CashSession | null>
  openCashSession: (openingFund: number) => Promise<CashSession>
  closeCashSession: (sessionId: number, closingData?: Omit<CloseCashSessionInput, 'sessionId'>) => Promise<CashSession>
  discardCashSession: (sessionId: number) => Promise<boolean>
  getSessionSummary: (sessionId: number) => Promise<CashCutSummary>
  getPastSessions: (limit?: number, offset?: number) => Promise<CashSession[]>
  addCashMovement: (sessionId: number, amount: number, reason: string) => Promise<CashMovement>
  getSessionMovements: (sessionId: number) => Promise<CashMovement[]>

  getSetting: (key: string, defaultValue?: string | null) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  getAllSettings: () => Promise<Record<string, string>>

  createBackup: () => Promise<string>
  listBackups: () => Promise<BackupInfo[]>
  getBackupDirectory: () => Promise<string>
  openBackupDirectory: () => Promise<boolean>
  selectBackupDirectory: () => Promise<string | null>
  selectExternalBackup: () => Promise<BackupInfo | null>
  restoreBackup: (backupFilePath: string) => Promise<{ ok: boolean }>

  getNextFolio: () => Promise<number>
  getNextTicketNumber: (openTickets?: number[], cashSessionId?: number | null) => Promise<number>
  getPendingSales: (cashSessionId?: number) => Promise<PendingTicket[]>
  savePendingSale: (data: { id?: number; ticket_number?: number; cashSessionId: number | null; items: CartItem[] }) => Promise<PendingTicket>
  deletePendingSale: (saleId: number) => Promise<boolean>
  completeSale: (input: CompleteSaleInput) => Promise<CompletedSaleResult>
  getSalesHistory: (filter?: SalesHistoryFilter) => Promise<(Sale & { payments: SalePayment[]; total_items: number; returned_items_count: number })[]>
  getSaleDetail: (saleId: number) => Promise<SaleDetail | null>
  cancelSale: (saleId: number, reason?: string) => Promise<SaleDetail>
  returnSaleItem: (saleId: number, productCode: string, quantity: number, reason?: string) => Promise<SaleDetail>
  updatePaymentMethod: (saleId: number, newMethod: PaymentMethod) => Promise<SaleDetail>

  adjustStock: (input: AdjustStockInput) => Promise<{ product: Product; movement: InventoryMovement }>
  getLowStockProducts: (limit?: number, offset?: number) => Promise<(ProductSearchResult & { min_stock: number })[]>
  getInventoryMovements: (dateStr?: string, type?: MovementType) => Promise<InventoryMovementDetail[]>
  getProductKardex: (productCode: string, limit?: number) => Promise<InventoryMovementDetail[]>
  exportMovementsExcel: (dateStr: string, movements: InventoryMovementDetail[]) => Promise<ExportExcelResult | null>
  exportKardexExcel: (
    productInfo: { code: string; name: string; category_name?: string | null; current_stock: number },
    limit?: number
  ) => Promise<ExportExcelResult | null>

  selectExcelFile: () => Promise<string | null>
  parseExcelFile: (filePath: string) => Promise<ExcelParsePreview>
  importExcelFile: (filePath: string, customMapping?: Partial<ExcelColumnMapping>, options?: ImportExcelOptions) => Promise<ImportReportResult>
  exportExcel: (defaultPrefix?: string, productIds?: number[]) => Promise<{ filePath: string; totalExported: number } | null>
  openContainingFolder: (filePath: string) => Promise<boolean>

  getReportData: (filter: ReportFilter) => Promise<FullReportData>
  exportReportToExcel: (filter: ReportFilter) => Promise<{ success: boolean; filePath?: string }>

  getInstalledPrinters: () => Promise<PrinterInfo[]>
  getPrinterConfig: () => Promise<PrinterConfig>
  savePrinterConfig: (config: Partial<PrinterConfig>) => Promise<{ ok: boolean }>
  printThermalReceipt: (saleDetail: SaleDetail, change?: number, customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  openCashDrawer: (customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  testThermalPrinter: (customConfig?: Partial<PrinterConfig>) => Promise<PrintResult>
  printNormalReceipt: (saleDetail: SaleDetail, printerName?: string) => Promise<PrintResult>
}

// Concrete domain implementations
const catalog: CatalogAPI = {
  saveProduct: (input) => ipcRenderer.invoke('products:save', input),
  saveVariableProduct: (parent, variations) => ipcRenderer.invoke('products:saveVariable', parent, variations),
  getByCode: (code, includeInactive) => ipcRenderer.invoke('products:getByCode', code, includeInactive),
  getById: (id, includeInactive) => ipcRenderer.invoke('products:getById', id, includeInactive),
  getVariations: (parentId, includeInactive) => ipcRenderer.invoke('products:getVariations', parentId, includeInactive),
  deleteProduct: (codeOrId) => ipcRenderer.invoke('products:delete', codeOrId),
  bulkDelete: (productIds) => ipcRenderer.invoke('products:bulkDelete', productIds),
  bulkUpdateCategory: (productIds, categoryId, supplierIds) =>
    ipcRenderer.invoke('products:bulkUpdateCategory', productIds, categoryId, supplierIds),
  groupAsVariable: (input) => ipcRenderer.invoke('products:groupAsVariable', input),
  getActive: (limit, offset) => ipcRenderer.invoke('products:getActive', limit, offset),
  search: (options) => ipcRenderer.invoke('products:search', options),
  seedSampleData: () => ipcRenderer.invoke('products:seed'),

  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  saveCategory: (name, parentId, id) => ipcRenderer.invoke('categories:save', name, parentId, id),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  getSuppliers: (includeInactive) => ipcRenderer.invoke('suppliers:getAll', includeInactive),
  saveSupplier: (name, id) => ipcRenderer.invoke('suppliers:save', name, id),
  deleteSupplier: (id) => ipcRenderer.invoke('suppliers:delete', id),

  selectExcelFile: () => ipcRenderer.invoke('excel:selectFile'),
  parseExcelFile: (filePath) => ipcRenderer.invoke('excel:parseFile', filePath),
  importExcelFile: (filePath, customMapping, options) => ipcRenderer.invoke('excel:importFile', filePath, customMapping, options),
  exportExcel: (defaultPrefix, productIds) => ipcRenderer.invoke('excel:exportProducts', defaultPrefix, productIds),
  openContainingFolder: (filePath) => ipcRenderer.invoke('excel:openContainingFolder', filePath)
}

const sales: SalesAPI = {
  getNextFolio: () => ipcRenderer.invoke('sales:getNextFolio'),
  getNextTicketNumber: (openTickets, cashSessionId) =>
    ipcRenderer.invoke('sales:getNextTicketNumber', openTickets, cashSessionId),
  getPending: (cashSessionId) => ipcRenderer.invoke('sales:getPending', cashSessionId),
  savePending: (data) => ipcRenderer.invoke('sales:savePending', data),
  deletePending: (saleId) => ipcRenderer.invoke('sales:deletePending', saleId),
  complete: (input) => ipcRenderer.invoke('sales:complete', input),
  getHistory: (filter) => ipcRenderer.invoke('sales:getHistory', filter),
  getDetail: (saleId) => ipcRenderer.invoke('sales:getDetail', saleId),
  cancel: (saleId, reason) => ipcRenderer.invoke('sales:cancel', saleId, reason),
  returnItem: (saleId, productCode, quantity, reason) =>
    ipcRenderer.invoke('sales:returnItem', saleId, productCode, quantity, reason),
  updatePaymentMethod: (saleId, newMethod) =>
    ipcRenderer.invoke('sales:updatePaymentMethod', saleId, newMethod)
}

const cash: CashAPI = {
  getCurrentSession: () => ipcRenderer.invoke('cash:getCurrentSession'),
  openSession: (openingFund, openingDenominations) =>
    ipcRenderer.invoke('cash:openSession', openingFund, openingDenominations),
  closeSession: (sessionId, closingData) => ipcRenderer.invoke('cash:closeSession', sessionId, closingData),
  discardSession: (sessionId) => ipcRenderer.invoke('cash:discardSession', sessionId),
  getSessionSummary: (sessionId) => ipcRenderer.invoke('cash:getSessionSummary', sessionId),
  getPastSessions: (limit, offset) => ipcRenderer.invoke('cash:getPastSessions', limit, offset),
  getLastClosedSession: () => ipcRenderer.invoke('cash:getLastClosedSession'),
  addMovement: (sessionId, amount, reason) => ipcRenderer.invoke('cash:addMovement', sessionId, amount, reason),
  getSessionMovements: (sessionId) => ipcRenderer.invoke('cash:getSessionMovements', sessionId)
}

const inventory: InventoryAPI = {
  adjustStock: (input) => ipcRenderer.invoke('inventory:adjustStock', input),
  getLowStock: (limit, offset) => ipcRenderer.invoke('inventory:getLowStock', limit, offset),
  getMovements: (dateStr, type) => ipcRenderer.invoke('inventory:getMovements', dateStr, type),
  getKardex: (productCode, limit) => ipcRenderer.invoke('inventory:getKardex', productCode, limit),
  exportMovementsExcel: (dateStr, movements) =>
    ipcRenderer.invoke('inventory:exportMovementsExcel', dateStr, movements),
  exportKardexExcel: (productInfo, limit) =>
    ipcRenderer.invoke('inventory:exportKardexExcel', productInfo, limit)
}

const reports: ReportsAPI = {
  getData: (filter) => ipcRenderer.invoke('reports:getData', filter),
  exportExcel: (filter) => ipcRenderer.invoke('reports:exportExcel', filter)
}

const devices: DevicesAPI = {
  getPrinters: () => ipcRenderer.invoke('printers:getList'),
  getConfig: () => ipcRenderer.invoke('printers:getConfig'),
  saveConfig: (config) => ipcRenderer.invoke('printers:saveConfig', config),
  printThermal: (saleDetail, change, customConfig) =>
    ipcRenderer.invoke('printers:printThermal', saleDetail, change, customConfig),
  openCashDrawer: (customConfig) => ipcRenderer.invoke('printers:openCashDrawer', customConfig),
  testThermal: (customConfig) => ipcRenderer.invoke('printers:testThermal', customConfig),
  printNormal: (saleDetail, printerName) =>
    ipcRenderer.invoke('printers:printNormal', saleDetail, printerName)
}

const system: SystemAPI = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window:maximized-change', subscription)
    return () => {
      ipcRenderer.removeListener('window:maximized-change', subscription)
    }
  },
  onPromptClose: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on('app:prompt-close', subscription)
    return () => {
      ipcRenderer.removeListener('app:prompt-close', subscription)
    }
  },
  confirmClose: (shouldBackup) => ipcRenderer.invoke('app:confirm-close', shouldBackup),
  pingDb: () => ipcRenderer.invoke('db:ping'),
  resetDatabase: (keepSettings) => ipcRenderer.invoke('db:reset', keepSettings),
  getSetting: (key, defaultValue) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  getBackupDirectory: () => ipcRenderer.invoke('backup:getDirectory'),
  openBackupDirectory: () => ipcRenderer.invoke('backup:openDirectory'),
  selectBackupDirectory: () => ipcRenderer.invoke('backup:selectDirectory'),
  selectExternalBackup: () => ipcRenderer.invoke('backup:selectExternal'),
  restoreBackup: (backupFilePath) => ipcRenderer.invoke('backup:restore', backupFilePath)
}

const api: WindowAPI = {
  // Namespaces
  catalog,
  sales,
  cash,
  inventory,
  reports,
  devices,
  system,

  // Flat aliases for backward compatibility
  minimize: system.minimize,
  maximize: system.maximize,
  close: system.close,
  isMaximized: system.isMaximized,
  onMaximizedChange: system.onMaximizedChange,
  onPromptClose: system.onPromptClose,
  confirmClose: system.confirmClose,
  pingDb: system.pingDb,
  resetDatabase: system.resetDatabase,

  saveProduct: catalog.saveProduct,
  saveVariableProduct: catalog.saveVariableProduct,
  getProductByCode: catalog.getByCode,
  getProductById: catalog.getById,
  getVariations: catalog.getVariations,
  deleteProduct: catalog.deleteProduct,
  bulkDeleteProducts: catalog.bulkDelete,
  bulkUpdateCategory: catalog.bulkUpdateCategory,
  groupProductsAsVariable: catalog.groupAsVariable,
  getActiveProducts: catalog.getActive,
  searchProducts: catalog.search,
  seedSampleData: catalog.seedSampleData,

  getCategories: catalog.getCategories,
  saveCategory: catalog.saveCategory,
  deleteCategory: catalog.deleteCategory,

  getSuppliers: catalog.getSuppliers,
  saveSupplier: catalog.saveSupplier,
  deleteSupplier: catalog.deleteSupplier,

  getCurrentCashSession: cash.getCurrentSession,
  openCashSession: cash.openSession,
  closeCashSession: cash.closeSession,
  discardCashSession: cash.discardSession,
  getSessionSummary: cash.getSessionSummary,
  getPastSessions: cash.getPastSessions,
  addCashMovement: cash.addMovement,
  getSessionMovements: cash.getSessionMovements,

  getSetting: system.getSetting,
  setSetting: system.setSetting,
  getAllSettings: system.getAllSettings,

  createBackup: system.createBackup,
  listBackups: system.listBackups,
  getBackupDirectory: system.getBackupDirectory,
  openBackupDirectory: system.openBackupDirectory,
  selectBackupDirectory: system.selectBackupDirectory,
  selectExternalBackup: system.selectExternalBackup,
  restoreBackup: system.restoreBackup,

  getNextFolio: sales.getNextFolio,
  getNextTicketNumber: sales.getNextTicketNumber,
  getPendingSales: sales.getPending,
  savePendingSale: sales.savePending,
  deletePendingSale: sales.deletePending,
  completeSale: sales.complete,
  getSalesHistory: sales.getHistory,
  getSaleDetail: sales.getDetail,
  cancelSale: sales.cancel,
  returnSaleItem: sales.returnItem,
  updatePaymentMethod: sales.updatePaymentMethod,

  adjustStock: inventory.adjustStock,
  getLowStockProducts: inventory.getLowStock,
  getInventoryMovements: inventory.getMovements,
  getProductKardex: inventory.getKardex,
  exportMovementsExcel: inventory.exportMovementsExcel,
  exportKardexExcel: inventory.exportKardexExcel,

  selectExcelFile: catalog.selectExcelFile,
  parseExcelFile: catalog.parseExcelFile,
  importExcelFile: catalog.importExcelFile,
  exportExcel: catalog.exportExcel,
  openContainingFolder: catalog.openContainingFolder,

  getReportData: reports.getData,
  exportReportToExcel: reports.exportExcel,

  getInstalledPrinters: devices.getPrinters,
  getPrinterConfig: devices.getConfig,
  savePrinterConfig: devices.saveConfig,
  printThermalReceipt: devices.printThermal,
  openCashDrawer: devices.openCashDrawer,
  testThermalPrinter: devices.testThermal,
  printNormalReceipt: devices.printNormal
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose api:', error)
  }
} else {
  // @ts-ignore (define in window)
  window.api = api
}
