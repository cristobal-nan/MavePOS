import { create } from 'zustand'
import {
  Sale,
  SalePayment,
  SaleDetail,
  SalesHistoryFilter,
  CashMovement
} from '@shared/types'

export type HistorySubTab = 'sales' | 'cash_movements'

interface HistoryState {
  activeSubTab: HistorySubTab
  sales: (Sale & { payments: SalePayment[]; total_items: number; returned_items_count: number })[]
  filter: {
    date: string
    folioStr: string
    status: 'all' | 'completed' | 'cancelled'
  }
  selectedSaleDetail: SaleDetail | null
  cashMovements: CashMovement[]
  isLoading: boolean
  isDetailLoading: boolean
  error: string | null

  // Actions
  setActiveSubTab: (tab: HistorySubTab) => void
  setDateFilter: (date: string) => void
  setFolioFilter: (folioStr: string) => void
  setStatusFilter: (status: 'all' | 'completed' | 'cancelled') => void
  clearFilters: () => void
  fetchSalesHistory: () => Promise<void>
  openSaleDetail: (saleId: number) => Promise<void>
  closeSaleDetail: () => void
  cancelSale: (saleId: number, reason?: string) => Promise<boolean>
  returnSaleItem: (saleId: number, productCode: string, quantity: number, reason?: string) => Promise<boolean>
  fetchCashMovements: (sessionId: number) => Promise<void>
  addCashMovement: (sessionId: number, amount: number, reason: string) => Promise<boolean>
  clearError: () => void
}

function getLocalDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  activeSubTab: 'sales',
  sales: [],
  filter: {
    date: getLocalDateString(),
    folioStr: '',
    status: 'all'
  },
  selectedSaleDetail: null,
  cashMovements: [],
  isLoading: false,
  isDetailLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setActiveSubTab: (tab: HistorySubTab) => {
    set({ activeSubTab: tab, error: null })
  },

  setDateFilter: (date: string) => {
    set((state) => ({ filter: { ...state.filter, date } }))
    get().fetchSalesHistory()
  },

  setFolioFilter: (folioStr: string) => {
    set((state) => ({ filter: { ...state.filter, folioStr } }))
    get().fetchSalesHistory()
  },

  setStatusFilter: (status: 'all' | 'completed' | 'cancelled') => {
    set((state) => ({ filter: { ...state.filter, status } }))
    get().fetchSalesHistory()
  },

  clearFilters: () => {
    set({
      filter: {
        date: getLocalDateString(),
        folioStr: '',
        status: 'all'
      }
    })
    get().fetchSalesHistory()
  },

  fetchSalesHistory: async () => {
    set({ isLoading: true, error: null })
    try {
      if (!window.api?.sales?.getHistory) {
        throw new Error('API no disponible')
      }

      const { filter } = get()
      const apiFilter: SalesHistoryFilter = {}

      if (filter.date) {
        apiFilter.date = filter.date
      }

      const folioNum = parseInt(filter.folioStr.trim(), 10)
      if (!isNaN(folioNum) && folioNum >= 0) {
        apiFilter.folio = folioNum
      }

      if (filter.status !== 'all') {
        apiFilter.status = filter.status
      }

      const sales = await window.api.sales.getHistory(apiFilter)
      set({ sales, isLoading: false })
    } catch (err: any) {
      console.error('Error al cargar historial de ventas:', err)
      set({ error: err.message || 'Error al cargar ventas', isLoading: false })
    }
  },

  openSaleDetail: async (saleId: number) => {
    set({ isDetailLoading: true, error: null })
    try {
      if (!window.api?.sales?.getDetail) {
        throw new Error('API no disponible')
      }
      const detail = await window.api.sales.getDetail(saleId)
      set({ selectedSaleDetail: detail, isDetailLoading: false })
    } catch (err: any) {
      console.error('Error al cargar detalle de venta:', err)
      set({ error: err.message || 'Error al cargar detalle', isDetailLoading: false })
    }
  },

  closeSaleDetail: () => {
    set({ selectedSaleDetail: null, isDetailLoading: false })
  },

  cancelSale: async (saleId: number, reason?: string) => {
    set({ error: null })
    try {
      if (!window.api?.sales?.cancel) {
        throw new Error('API no disponible')
      }
      const updatedDetail = await window.api.sales.cancel(saleId, reason)
      set({ selectedSaleDetail: updatedDetail })
      // Refrescamos lista de ventas
      await get().fetchSalesHistory()
      return true
    } catch (err: any) {
      console.error('Error al cancelar venta:', err)
      set({ error: err.message || 'Error al cancelar la venta' })
      return false
    }
  },

  returnSaleItem: async (saleId: number, productCode: string, quantity: number, reason?: string) => {
    set({ error: null })
    try {
      if (!window.api?.sales?.returnItem) {
        throw new Error('API no disponible')
      }
      const updatedDetail = await window.api.sales.returnItem(saleId, productCode, quantity, reason)
      set({ selectedSaleDetail: updatedDetail })
      // Refrescamos lista de ventas
      await get().fetchSalesHistory()
      return true
    } catch (err: any) {
      console.error('Error al procesar devolución de producto:', err)
      set({ error: err.message || 'Error al devolver el producto' })
      return false
    }
  },

  fetchCashMovements: async (sessionId: number) => {
    set({ isLoading: true, error: null })
    try {
      if (!window.api?.cash?.getSessionMovements) {
        throw new Error('API no disponible')
      }
      const movements = await window.api.cash.getSessionMovements(sessionId)
      set({ cashMovements: movements, isLoading: false })
    } catch (err: any) {
      console.error('Error al cargar salidas de caja:', err)
      set({ error: err.message || 'Error al cargar salidas de dinero', isLoading: false })
    }
  },

  addCashMovement: async (sessionId: number, amount: number, reason: string) => {
    set({ error: null })
    try {
      if (!window.api?.cash?.addMovement) {
        throw new Error('API no disponible')
      }
      await window.api.cash.addMovement(sessionId, amount, reason)
      // Refrescamos la lista de movimientos
      await get().fetchCashMovements(sessionId)
      return true
    } catch (err: any) {
      console.error('Error registrando salida de dinero:', err)
      set({ error: err.message || 'Error al registrar salida de dinero' })
      return false
    }
  }
}))
