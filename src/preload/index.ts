import { contextBridge, ipcRenderer } from 'electron'
import {
  Category,
  Family,
  Product,
  ProductInput,
  ProductSearchResult,
  ProductSearchOptions,
  CashSession,
  CashMovement,
  BackupInfo
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
  getProductByCode: (code: string, includeInactive?: boolean) => Promise<Product | null>
  deleteProduct: (code: string) => Promise<boolean>
  getActiveProducts: (limit?: number, offset?: number) => Promise<Product[]>
  searchProducts: (options?: ProductSearchOptions) => Promise<ProductSearchResult[]>
  seedSampleData: () => Promise<boolean>

  // Categories & Families
  getCategories: () => Promise<Category[]>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  getFamilies: () => Promise<Family[]>
  saveFamily: (name: string, categoryId?: number | null, id?: number) => Promise<Family>
  deleteFamily: (id: number) => Promise<void>

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
  getProductByCode: (code, includeInactive) => ipcRenderer.invoke('products:getByCode', code, includeInactive),
  deleteProduct: (code) => ipcRenderer.invoke('products:delete', code),
  getActiveProducts: (limit, offset) => ipcRenderer.invoke('products:getActive', limit, offset),
  searchProducts: (options) => ipcRenderer.invoke('products:search', options),
  seedSampleData: () => ipcRenderer.invoke('products:seed'),

  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  saveCategory: (name, parentId, id) => ipcRenderer.invoke('categories:save', name, parentId, id),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),
  getFamilies: () => ipcRenderer.invoke('families:getAll'),
  saveFamily: (name, categoryId, id) => ipcRenderer.invoke('families:save', name, categoryId, id),
  deleteFamily: (id) => ipcRenderer.invoke('families:delete', id),

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
  getBackupDirectory: () => ipcRenderer.invoke('backup:getDirectory')
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
