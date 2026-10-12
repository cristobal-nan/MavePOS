import { create } from 'zustand'
import { ProductSearchResult } from '@shared/types'
import { normalizeSearchName } from '@shared/finance'

export interface MemoryCatalogState {
  isInitialized: boolean
  isLoading: boolean
  progressCount: number
  totalCount: number
  loadDurationMs: number
  products: ProductSearchResult[]
  codeIndex: Map<string, ProductSearchResult>
  idIndex: Map<number, ProductSearchResult>

  // Actions
  initCatalog: () => Promise<void>
  refreshCatalog: () => Promise<void>
  searchLocal: (options: {
    query?: string
    categoryId?: number | null
    supplierId?: number | null
    orderBy?: 'name' | 'stock' | 'sale_price'
    orderDir?: 'ASC' | 'DESC'
    limit?: number
  }) => ProductSearchResult[]
  getByCodeFast: (rawCode: string) => ProductSearchResult | null
  updateProductLocal: (product: ProductSearchResult) => void
  removeProductLocal: (codeOrId: string | number) => void
  adjustStockLocal: (code: string, newStock: number) => void
  decrementStockLocal: (items: { product_code: string; quantity: number }[]) => void
  incrementStockLocal: (items: { product_code: string; quantity: number }[]) => void
}

function buildIndexes(items: ProductSearchResult[]): {
  codeIndex: Map<string, ProductSearchResult>
  idIndex: Map<number, ProductSearchResult>
} {
  const codeIndex = new Map<string, ProductSearchResult>()
  const idIndex = new Map<number, ProductSearchResult>()

  for (const p of items) {
    if (p.id !== undefined) {
      idIndex.set(p.id, p)
    }
    if (p.code) {
      const trimmed = p.code.trim().toUpperCase()
      codeIndex.set(trimmed, p)
      const stripped = trimmed.replace(/^0+/, '')
      if (stripped && stripped !== trimmed) {
        if (!codeIndex.has(stripped)) {
          codeIndex.set(stripped, p)
        }
      }
    }
  }

  return { codeIndex, idIndex }
}

export const useMemoryCatalogStore = create<MemoryCatalogState>((set, get) => ({
  isInitialized: false,
  isLoading: false,
  progressCount: 0,
  totalCount: 0,
  loadDurationMs: 0,
  products: [],
  codeIndex: new Map(),
  idIndex: new Map(),

  initCatalog: async () => {
    if (get().isInitialized || get().isLoading) return
    const t0 = performance.now()
    set({ isLoading: true, progressCount: 0 })

    try {
      const items = await window.api.catalog.getAllForMemory()
      const { codeIndex, idIndex } = buildIndexes(items)
      const duration = Math.round(performance.now() - t0)

      set({
        isInitialized: true,
        isLoading: false,
        products: items,
        totalCount: items.length,
        progressCount: items.length,
        loadDurationMs: duration,
        codeIndex,
        idIndex
      })
    } catch (err) {
      console.error('Error inicializando catálogo en memoria:', err)
      set({ isLoading: false })
    }
  },

  refreshCatalog: async () => {
    const t0 = performance.now()
    try {
      const items = await window.api.catalog.getAllForMemory()
      const { codeIndex, idIndex } = buildIndexes(items)
      const duration = Math.round(performance.now() - t0)

      set({
        isInitialized: true,
        products: items,
        totalCount: items.length,
        progressCount: items.length,
        loadDurationMs: duration,
        codeIndex,
        idIndex
      })
    } catch (err) {
      console.error('Error refrescando catálogo en memoria:', err)
    }
  },

  getByCodeFast: (rawCode: string): ProductSearchResult | null => {
    if (!rawCode) return null
    const { codeIndex } = get()
    const trimmed = rawCode.trim().toUpperCase()
    let found = codeIndex.get(trimmed)
    if (!found) {
      const stripped = trimmed.replace(/^0+/, '')
      if (stripped) {
        found = codeIndex.get(stripped)
      }
    }
    return found || null
  },

  searchLocal: (options) => {
    const { products } = get()
    const {
      query = '',
      categoryId = null,
      supplierId = null,
      orderBy = 'name',
      orderDir = 'ASC',
      limit = 200
    } = options

    const rawInput = query.trim()
    let filtered = products

    // 1. Filtro por categoría (directa o subcategoría)
    if (categoryId !== null && categoryId !== undefined) {
      filtered = filtered.filter(
        (p) => p.category_id === categoryId
      )
    }

    // 2. Filtro por proveedor
    if (supplierId !== null && supplierId !== undefined) {
      filtered = filtered.filter((p) =>
        p.suppliers && p.suppliers.some((s) => s.id === supplierId)
      )
    }

    // 3. Filtro de búsqueda por texto (% comodín) y por código
    if (rawInput) {
      const startsWithPercent = rawInput.startsWith('%')
      const rawFragments = rawInput.split('%')
      const fragments: { text: string; isInitial: boolean }[] = []

      rawFragments.forEach((frag, idx) => {
        const normalized = normalizeSearchName(frag)
        if (normalized.length > 0) {
          const isInitial = idx === 0 && !startsWithPercent
          fragments.push({ text: normalized, isInitial })
        }
      })

      const trimmedInput = rawInput.toUpperCase()
      const strippedInput = trimmedInput.replace(/^0+/, '')

      filtered = filtered.filter((p) => {
        // Coincidencia exacta de código
        if (!rawInput.includes('%')) {
          if (p.code) {
            const pCode = p.code.toUpperCase()
            if (pCode === trimmedInput || pCode === strippedInput) return true
          }
        }

        // Si hay fragmentos de texto, deben coincidir todos (AND)
        if (fragments.length === 0) return true

        const prodName = p.search_name || ''
        const parentName = (p as any).parent_search_name || ''

        return fragments.every((f) => {
          if (f.isInitial) {
            return prodName.startsWith(f.text) || parentName.startsWith(f.text)
          } else {
            return prodName.includes(f.text) || parentName.includes(f.text)
          }
        })
      })
    }

    // 4. Ordenamiento
    const isDesc = orderDir.toUpperCase() === 'DESC'
    filtered = [...filtered].sort((a, b) => {
      if (orderBy === 'stock') {
        const diff = (a.stock || 0) - (b.stock || 0)
        if (diff !== 0) return isDesc ? -diff : diff
      } else if (orderBy === 'sale_price') {
        const diff = (a.sale_price || 0) - (b.sale_price || 0)
        if (diff !== 0) return isDesc ? -diff : diff
      }

      // Alfabético por nombre del producto / padre
      const nameA = (a.search_name || a.name || '').toUpperCase()
      const nameB = (b.search_name || b.name || '').toUpperCase()
      const cmp = nameA.localeCompare(nameB)
      return isDesc ? -cmp : cmp
    })

    if (limit && limit > 0) {
      return filtered.slice(0, limit)
    }
    return filtered
  },

  updateProductLocal: (product: ProductSearchResult) => {
    set((state) => {
      const idx = state.products.findIndex((p) => p.id === product.id)
      let nextProducts: ProductSearchResult[]
      if (idx !== -1) {
        nextProducts = [...state.products]
        nextProducts[idx] = { ...nextProducts[idx], ...product }
      } else {
        nextProducts = [product, ...state.products]
      }
      const { codeIndex, idIndex } = buildIndexes(nextProducts)
      return {
        products: nextProducts,
        totalCount: nextProducts.length,
        codeIndex,
        idIndex
      }
    })
  },

  removeProductLocal: (codeOrId: string | number) => {
    set((state) => {
      const nextProducts = state.products.filter((p) => {
        if (typeof codeOrId === 'number') return p.id !== codeOrId
        return p.code !== String(codeOrId) && String(p.id) !== String(codeOrId)
      })
      const { codeIndex, idIndex } = buildIndexes(nextProducts)
      return {
        products: nextProducts,
        totalCount: nextProducts.length,
        codeIndex,
        idIndex
      }
    })
  },

  adjustStockLocal: (code: string, newStock: number) => {
    set((state) => {
      const item = state.getByCodeFast(code)
      if (!item) return state
      item.stock = newStock
      return {
        products: [...state.products]
      }
    })
  },

  decrementStockLocal: (items) => {
    set((state) => {
      let changed = false
      for (const it of items) {
        const prod = state.getByCodeFast(it.product_code)
        if (prod) {
          prod.stock = Math.max(0, (prod.stock || 0) - it.quantity)
          changed = true
        }
      }
      return changed ? { products: [...state.products] } : state
    })
  },

  incrementStockLocal: (items) => {
    set((state) => {
      let changed = false
      for (const it of items) {
        const prod = state.getByCodeFast(it.product_code)
        if (prod) {
          prod.stock = (prod.stock || 0) + it.quantity
          changed = true
        }
      }
      return changed ? { products: [...state.products] } : state
    })
  }
}))
