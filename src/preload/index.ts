import { contextBridge, ipcRenderer } from 'electron'
import {
  Category,
  Product,
  ProductInput,
  ProductSearchResult,
  ProductSearchOptions,
  CashSession,
  CashMovement,
  BackupInfo,
  CartItem,
  PendingTicket,
  CompleteSaleInput,
  CompletedSaleResult
} from '../shared/types'

export interface WindowAPI {
  // Window controls
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void

  // Close Flow & Backups
  onPromptClose: (callback: () => void) => () => void
  confirmClose: (shouldBackup: boolean) => Promise<void>

  // Health
  pingDb: () => Promise<{ ok: boolean; timestamp: string }>

  // Products
  saveProduct: (input: ProductInput) => Promise<Product>
  saveVariableProduct: (parent: ProductInput, variations: ProductInput[]) => Promise<{ parent: Product; variations: Product[] }>
  getProductByCode: (code: string, includeInactive?: boolean) => Promise<Product | null>
  getProductById: (id: number, includeInactive?: boolean) => Promise<Product | null>
  getVariations: (parentId: number, includeInactive?: boolean) => Promise<Product[]>
  deleteProduct: (codeOrId: string | number) => Promise<boolean>
  getActiveProducts: (limit?: number, offset?: number) => Promise<Product[]>
  searchProducts: (options?: ProductSearchOptions) => Promise<ProductSearchResult[]>
  seedSampleData: () => Promise<boolean>

  // Categories
  getCategories: () => Promise<Category[]>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>

  // Cash Session
  getCurrentCashSession: () => Promise<CashSession | null>
  openCashSession: (openingFund: number) => Promise<CashSession>
  closeCashSession: (sessionId: number) => Promise<CashSession>
  addCashMovement: (sessionId: number, amount: number, reason: string) => Promise<CashMovement>
  getSessionMovements: (sessionId: number) => Promise<CashMovement[]>

  // Settings
  getSetting: (key: string, defaultValue?: string | null) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  getAllSettings: () => Promise<Record<string, string>>

  // Backups
  createBackup: () => Promise<string>
  listBackups: () => Promise<BackupInfo[]>
  getBackupDirectory: () => Promise<string>

  // Sales & Tickets
  getNextFolio: () => Promise<number>
  getPendingSales: (cashSessionId?: number) => Promise<PendingTicket[]>
  savePendingSale: (data: { id?: number; cashSessionId: number | null; items: CartItem[] }) => Promise<PendingTicket>
  deletePendingSale: (saleId: number) => Promise<boolean>
  completeSale: (input: CompleteSaleInput) => Promise<CompletedSaleResult>
}

const api: WindowAPI = {
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

  saveProduct: (input) => ipcRenderer.invoke('products:save', input),
  saveVariableProduct: (parent, variations) => ipcRenderer.invoke('products:saveVariable', parent, variations),
  getProductByCode: (code, includeInactive) => ipcRenderer.invoke('products:getByCode', code, includeInactive),
  getProductById: (id, includeInactive) => ipcRenderer.invoke('products:getById', id, includeInactive),
  getVariations: (parentId, includeInactive) => ipcRenderer.invoke('products:getVariations', parentId, includeInactive),
  deleteProduct: (codeOrId) => ipcRenderer.invoke('products:delete', codeOrId),
  getActiveProducts: (limit, offset) => ipcRenderer.invoke('products:getActive', limit, offset),
  searchProducts: (options) => ipcRenderer.invoke('products:search', options),
  seedSampleData: () => ipcRenderer.invoke('products:seed'),

  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  saveCategory: (name, parentId, id) => ipcRenderer.invoke('categories:save', name, parentId, id),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  getCurrentCashSession: () => ipcRenderer.invoke('cash:getCurrentSession'),
  openCashSession: (openingFund) => ipcRenderer.invoke('cash:openSession', openingFund),
  closeCashSession: (sessionId) => ipcRenderer.invoke('cash:closeSession', sessionId),
  addCashMovement: (sessionId, amount, reason) => ipcRenderer.invoke('cash:addMovement', sessionId, amount, reason),
  getSessionMovements: (sessionId) => ipcRenderer.invoke('cash:getSessionMovements', sessionId),

  getSetting: (key, defaultValue) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  getBackupDirectory: () => ipcRenderer.invoke('backup:getDirectory'),

  getNextFolio: () => ipcRenderer.invoke('sales:getNextFolio'),
  getPendingSales: (cashSessionId) => ipcRenderer.invoke('sales:getPending', cashSessionId),
  savePendingSale: (data) => ipcRenderer.invoke('sales:savePending', data),
  deletePendingSale: (saleId) => ipcRenderer.invoke('sales:deletePending', saleId),
  completeSale: (input) => ipcRenderer.invoke('sales:complete', input)
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
