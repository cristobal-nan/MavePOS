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
    productType?: 'all' | 'sellable' | 'simple' | 'variable' | 'variation'
    onlySellable?: boolean
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

/**
 * Orden canónico del catálogo, equivalente al ORDER BY de SQLite en getAllForMemoryIndex:
 * COALESCE(parent.search_name, p.search_name) ASC, CASE WHEN p.product_type = 'variable' THEN 0 ELSE 1 END ASC, p.search_name ASC, p.id ASC.
 * Comparación binaria (igual que la colación BINARY de SQLite), sin localeCompare.
 * `products` se mantiene SIEMPRE en este orden: searchLocal depende de ello para cortar al límite.
 */
function compareCanonical(a: ProductSearchResult, b: ProductSearchResult): number {
  const ka = a.parent_search_name || a.search_name || ''
  const kb = b.parent_search_name || b.search_name || ''
  if (ka !== kb) return ka < kb ? -1 : 1
  const typeA = a.product_type === 'variable' ? 0 : 1
  const typeB = b.product_type === 'variable' ? 0 : 1
  if (typeA !== typeB) return typeA - typeB
  const na = a.search_name || ''
  const nb = b.search_name || ''
  if (na !== nb) return na < nb ? -1 : 1
  return (a.id || 0) - (b.id || 0)
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
      productType = 'all',
      onlySellable = false,
      orderBy = 'name',
      orderDir = 'ASC',
      limit = 200
    } = options

    const rawInput = query.trim()
    const isDesc = orderDir.toUpperCase() === 'DESC'
    const maxResults = limit && limit > 0 ? limit : Infinity

    // Preparar fragmentos de texto (% comodín) UNA sola vez por búsqueda
    const fragments: { text: string; isInitial: boolean }[] = []
    let codeMatch: ProductSearchResult | null = null
    if (rawInput) {
      const startsWithPercent = rawInput.startsWith('%')
      rawInput.split('%').forEach((frag, idx) => {
        const normalized = normalizeSearchName(frag)
        if (normalized.length > 0) {
          fragments.push({ text: normalized, isInitial: idx === 0 && !startsWithPercent })
        }
      })
      // Coincidencia exacta de código: una sola consulta al índice (O(1))
      if (!rawInput.includes('%')) {
        codeMatch = get().getByCodeFast(rawInput)
      }
    }

    const matches = (p: ProductSearchResult): boolean => {
      if (onlySellable && p.product_type === 'variable') {
        return false
      }
      if (productType && productType !== 'all') {
        if (productType === 'sellable') {
          if (p.product_type === 'variable') return false
        } else if (p.product_type !== productType) {
          return false
        }
      }
      if (categoryId !== null && categoryId !== undefined && p.category_id !== categoryId) {
        return false
      }
      if (supplierId !== null && supplierId !== undefined) {
        if (!p.suppliers || !p.suppliers.some((s) => s.id === supplierId)) return false
      }
      if (!rawInput) return true
      if (p === codeMatch) return true
      if (fragments.length === 0) return true

      const prodName = p.search_name || ''
      const parentName = p.parent_search_name || ''
      for (const f of fragments) {
        const ok = f.isInitial
          ? prodName.startsWith(f.text) || parentName.startsWith(f.text)
          : prodName.includes(f.text) || parentName.includes(f.text)
        if (!ok) return false
      }
      return true
    }

    // Orden por nombre: `products` ya está en orden canónico, se recorre y se corta al
    // llegar al límite (sin ordenar ni recorrer el catálogo completo en cada tecla).
    if (orderBy === 'name') {
      const result: ProductSearchResult[] = []
      if (isDesc) {
        for (let i = products.length - 1; i >= 0 && result.length < maxResults; i--) {
          if (matches(products[i])) result.push(products[i])
        }
      } else {
        for (let i = 0; i < products.length && result.length < maxResults; i++) {
          if (matches(products[i])) result.push(products[i])
        }
      }
      return result
    }

    // Orden numérico (stock / precio): sort estable, el desempate conserva el orden por nombre
    const filtered = products.filter(matches)
    const key = orderBy === 'stock' ? 'stock' : 'sale_price'
    filtered.sort((a, b) => {
      const diff = (a[key] || 0) - (b[key] || 0)
      return isDesc ? -diff : diff
    })
    return maxResults === Infinity ? filtered : filtered.slice(0, maxResults)
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
      // Mantener el orden canónico (invariante de la que depende searchLocal)
      nextProducts.sort(compareCanonical)
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
