import { create } from 'zustand'
import {
  AdjustStockInput,
  AdjustmentCancellationPreview,
  CancelAdjustmentResult,
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
  recentAdjustments: InventoryMovementDetail[]
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
  fetchRecentAdjustments: () => Promise<void>
  updateMovementReason: (movementId: number, newReason: string) => Promise<void>
  getAdjustmentCancellationPreview: (movementId: number) => Promise<AdjustmentCancellationPreview>
  cancelAdjustment: (movementId: number) => Promise<CancelAdjustmentResult>
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
  recentAdjustments: [],
  selectedDate: getLocalDateString(),
  selectedMovementType: 'all',
  isLoading: false,
  error: null,

  setActiveTab: (tab: InventoryTab) => {
    set({ activeTab: tab, error: null })
    if (tab === 'adjust') {
      get().fetchRecentAdjustments()
    } else if (tab === 'lowStock') {
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
      const items = await window.api.inventory.getLowStock()
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
      const list = await window.api.inventory.getMovements(date, typeParam)
      set({ movements: list, isLoading: false })
    } catch (err: any) {
      console.error('Error cargando movimientos de inventario:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  fetchKardex: async (productCode: string) => {
    set({ isLoading: true, error: null })
    try {
      const list = await window.api.inventory.getKardex(productCode)
      set({ kardexMovements: list, isLoading: false })
    } catch (err: any) {
      console.error('Error cargando kardex del producto:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  fetchRecentAdjustments: async () => {
    try {
      const items = await window.api.inventory.getRecentAdjustments(5)
      set({ recentAdjustments: items })
    } catch (err: any) {
      console.error('Error cargando últimos ajustes:', err)
    }
  },

  updateMovementReason: async (movementId: number, newReason: string) => {
    try {
      await window.api.inventory.updateMovementReason(movementId, newReason)
      // Actualizar listas reactivas en memoria
      set((state) => ({
        recentAdjustments: state.recentAdjustments.map((m) =>
          m.id === movementId ? { ...m, reason: newReason.trim() } : m
        ),
        movements: state.movements.map((m) =>
          m.id === movementId ? { ...m, reason: newReason.trim() } : m
        ),
        kardexMovements: state.kardexMovements.map((m) =>
          m.id === movementId ? { ...m, reason: newReason.trim() } : m
        )
      }))
    } catch (err: any) {
      console.error('Error actualizando motivo de movimiento:', err)
      throw err
    }
  },

  getAdjustmentCancellationPreview: async (movementId: number) => {
    return window.api.inventory.getAdjustmentCancellationPreview(movementId)
  },

  cancelAdjustment: async (movementId: number) => {
    set({ isLoading: true, error: null })
    try {
      const res = await window.api.inventory.cancelAdjustment(movementId)
      // Refrescar recientes, movimientos y producto actual si coincide
      await get().fetchRecentAdjustments()
      const currentSelected = get().selectedProduct
      if (currentSelected && currentSelected.code === res.revertedMovement.product_code) {
        set({
          selectedProduct: {
            ...currentSelected,
            stock: res.newStock
          }
        })
      }
      const kardexProd = get().kardexProduct
      if (kardexProd && kardexProd.code === res.revertedMovement.product_code) {
        set({
          kardexProduct: {
            ...kardexProd,
            stock: res.newStock
          }
        })
        await get().fetchKardex(kardexProd.code)
      }
      // Refrescar historial de movimientos si estamos en esa fecha
      await get().fetchMovements()
      set({ isLoading: false })
      return res
    } catch (err: any) {
      console.error('Error cancelando ajuste:', err)
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  adjustStock: async (input: AdjustStockInput) => {
    set({ isLoading: true, error: null })
    try {
      const res = await window.api.inventory.adjustStock(input)
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
      // Actualizar la lista de los últimos ajustes
      await get().fetchRecentAdjustments()
      set({ isLoading: false })
      return res
    } catch (err: any) {
      console.error('Error ajustando stock:', err)
      set({ error: err.message, isLoading: false })
      throw err
    }
  }
}))
