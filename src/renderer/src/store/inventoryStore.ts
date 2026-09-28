import { create } from 'zustand'
import {
  AdjustStockInput,
  InventoryMovement,
  InventoryMovementDetail,
  MovementType,
  Product,
  ProductSearchResult
} from '@shared/types'

export type InventoryTab = 'adjust' | 'lowStock' | 'movements' | 'kardex'

interface InventoryState {
  activeTab: InventoryTab
  selectedProduct: ProductSearchResult | null
  lowStockProducts: (ProductSearchResult & { min_stock: number })[]
  movements: InventoryMovementDetail[]
  kardexMovements: InventoryMovementDetail[]
  kardexProduct: ProductSearchResult | null
  selectedDate: string
  selectedMovementType: MovementType | 'all'
  isLoading: boolean
  error: string | null

  // Actions
  setActiveTab: (tab: InventoryTab) => void
  setSelectedProduct: (product: ProductSearchResult | null) => void
  setKardexProduct: (product: ProductSearchResult | null) => void
  setSelectedDate: (date: string) => void
  setSelectedMovementType: (type: MovementType | 'all') => void
  fetchLowStock: () => Promise<void>
  fetchMovements: (dateStr?: string, type?: MovementType | 'all') => Promise<void>
  fetchKardex: (productCode: string) => Promise<void>
  adjustStock: (input: AdjustStockInput) => Promise<{ product: Product; movement: InventoryMovement }>
}

function getLocalDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  activeTab: 'adjust',
  selectedProduct: null,
  lowStockProducts: [],
  movements: [],
  kardexMovements: [],
  kardexProduct: null,
  selectedDate: getLocalDateString(),
  selectedMovementType: 'all',
  isLoading: false,
  error: null,

  setActiveTab: (tab: InventoryTab) => {
    set({ activeTab: tab, error: null })
    if (tab === 'lowStock') {
      get().fetchLowStock()
    } else if (tab === 'movements') {
      get().fetchMovements()
    }
  },

  setSelectedProduct: (product: ProductSearchResult | null) => {
    set({ selectedProduct: product, error: null })
  },

  setKardexProduct: (product: ProductSearchResult | null) => {
    set({ kardexProduct: product })
    if (product && product.code) {
      get().fetchKardex(product.code)
    } else {
      set({ kardexMovements: [] })
    }
  },

  setSelectedDate: (date: string) => {
    set({ selectedDate: date })
    get().fetchMovements(date)
  },

  setSelectedMovementType: (type: MovementType | 'all') => {
    set({ selectedMovementType: type })
    get().fetchMovements(get().selectedDate, type)
  },

  fetchLowStock: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await window.api.getLowStockProducts()
      set({ lowStockProducts: items, isLoading: false })
    } catch (err: any) {
      console.error('Error cargando productos con stock bajo:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  fetchMovements: async (customDate?: string, customType?: MovementType | 'all') => {
    set({ isLoading: true, error: null })
    const { selectedDate, selectedMovementType } = get()
    const date = customDate !== undefined ? customDate : selectedDate
    const type = customType !== undefined ? customType : selectedMovementType

    try {
      const typeParam = type === 'all' ? undefined : (type as MovementType)
      const list = await window.api.getInventoryMovements(date, typeParam)
      set({ movements: list, isLoading: false })
    } catch (err: any) {
      console.error('Error cargando movimientos de inventario:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  fetchKardex: async (productCode: string) => {
    set({ isLoading: true, error: null })
    try {
      const list = await window.api.getProductKardex(productCode)
      set({ kardexMovements: list, isLoading: false })
    } catch (err: any) {
      console.error('Error cargando kardex del producto:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  adjustStock: async (input: AdjustStockInput) => {
    set({ isLoading: true, error: null })
    try {
      const res = await window.api.adjustStock(input)
      // Actualizar producto seleccionado si es el mismo
      const currentSelected = get().selectedProduct
      if (currentSelected && currentSelected.code === input.product_code) {
        set({
          selectedProduct: {
            ...currentSelected,
            stock: res.product.stock
          }
        })
      }
      set({ isLoading: false })
      return res
    } catch (err: any) {
      console.error('Error ajustando stock:', err)
      set({ error: err.message, isLoading: false })
      throw err
    }
  }
}))
