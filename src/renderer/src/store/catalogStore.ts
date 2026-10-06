import { create } from 'zustand'
import {
  Category,
  Product,
  ProductInput,
  ProductSearchResult,
  ProductType,
  GroupAsVariableInput,
  Supplier,
  CatalogConfig,
  DEFAULT_CATALOG_CONFIG
} from '@shared/types'

interface CatalogState {
  products: ProductSearchResult[]
  modalProducts: ProductSearchResult[]
  categories: Category[]
  suppliers: Supplier[]
  selectedCategory: number | null
  selectedSupplier: number | null
  selectedProductType: 'sellable' | 'simple' | 'variation' | 'variable' | 'all'
  searchQuery: string
  modalSearchQuery: string
  orderBy: 'name' | 'stock' | 'sale_price'
  orderDir: 'ASC' | 'DESC'
  columnWidths: {
    code: number
    name: number
    type: number
    category: number
    price: number
    stock: number
    actions: number
  }
  modalColumnWidths: {
    code: number
    name: number
    type: number
    category: number
    price: number
    stock: number
    actions: number
  }
  config: CatalogConfig
  isLoading: boolean
  modalIsLoading: boolean
  isLoadingMore: boolean
  modalIsLoadingMore: boolean
  hasMore: boolean
  modalHasMore: boolean
  error: string | null

  // Actions
  loadMetadata: () => Promise<void>
  loadConfig: () => Promise<void>
  updateConfig: (newConfig: Partial<CatalogConfig>) => Promise<void>
  fetchProducts: (customQuery?: string, context?: 'catalog' | 'modal') => Promise<void>
  loadMoreProducts: (context?: 'catalog' | 'modal') => Promise<void>
  setSearchQuery: (query: string, context?: 'catalog' | 'modal') => void
  setSelectedCategory: (catId: number | null, context?: 'catalog' | 'modal') => void
  setSelectedSupplier: (supId: number | null, context?: 'catalog' | 'modal') => void
  setSelectedProductType: (type: 'sellable' | 'simple' | 'variation' | 'variable' | 'all', context?: 'catalog' | 'modal') => void
  toggleSort: (column: 'name' | 'stock' | 'sale_price', context?: 'catalog' | 'modal') => void
  setColumnWidth: (column: string, width: number, context?: 'catalog' | 'modal') => void
  saveProduct: (input: ProductInput) => Promise<Product>
  saveVariableProduct: (parent: ProductInput, variations: ProductInput[]) => Promise<{ parent: Product; variations: Product[] }>
  getVariations: (parentId: number) => Promise<Product[]>
  deleteProduct: (codeOrId: string | number) => Promise<boolean>
  bulkDeleteProducts: (productIds: number[]) => Promise<{ deletedCount: number }>
  bulkUpdateCategory: (productIds: number[], categoryId?: number | null, supplierIds?: number[]) => Promise<{ updatedCount: number }>
  groupProductsAsVariable: (input: GroupAsVariableInput) => Promise<{ parentId: number; count: number }>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  saveSupplier: (name: string, id?: number) => Promise<Supplier>
  deleteSupplier: (id: number) => Promise<boolean>
  seedSampleData: () => Promise<void>
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  modalProducts: [],
  categories: [],
  suppliers: [],
  selectedCategory: null,
  selectedSupplier: null,
  selectedProductType: 'sellable',
  searchQuery: '',
  modalSearchQuery: '',
  orderBy: 'name',
  orderDir: 'ASC',
  columnWidths: {
    code: 130,
    name: 270,
    type: 140,
    category: 160,
    price: 110,
    stock: 90,
    actions: 100
  },
  modalColumnWidths: {
    code: 120,
    name: 260,
    type: 130,
    category: 150,
    price: 100,
    stock: 80,
    actions: 0
  },
  config: { ...DEFAULT_CATALOG_CONFIG },
  isLoading: false,
  modalIsLoading: false,
  isLoadingMore: false,
  modalIsLoadingMore: false,
  hasMore: false,
  modalHasMore: false,
  error: null,

  loadConfig: async () => {
    try {
      const all = await window.api.getAllSettings()
      set({
        config: {
          catalogAutoLoad: all.catalog_autoload !== undefined ? all.catalog_autoload === 'true' : DEFAULT_CATALOG_CONFIG.catalogAutoLoad,
          catalogInitialLimit: all.catalog_initial_limit ? Math.max(10, parseInt(all.catalog_initial_limit, 10) || 150) : DEFAULT_CATALOG_CONFIG.catalogInitialLimit,
          catalogScrollBatch: all.catalog_scroll_batch ? Math.max(10, parseInt(all.catalog_scroll_batch, 10) || 150) : DEFAULT_CATALOG_CONFIG.catalogScrollBatch,
          modalAutoLoad: all.modal_autoload !== undefined ? all.modal_autoload === 'true' : DEFAULT_CATALOG_CONFIG.modalAutoLoad,
          modalInitialLimit: all.modal_initial_limit ? Math.max(10, parseInt(all.modal_initial_limit, 10) || 150) : DEFAULT_CATALOG_CONFIG.modalInitialLimit,
          modalScrollBatch: all.modal_scroll_batch ? Math.max(10, parseInt(all.modal_scroll_batch, 10) || 150) : DEFAULT_CATALOG_CONFIG.modalScrollBatch
        }
      })
    } catch (e) {
      console.error('Error cargando configuración de catálogo:', e)
    }
  },

  updateConfig: async (newConfig: Partial<CatalogConfig>) => {
    const updated = { ...get().config, ...newConfig }
    set({ config: updated })
    try {
      if (newConfig.catalogAutoLoad !== undefined) {
        await window.api.setSetting('catalog_autoload', String(newConfig.catalogAutoLoad))
      }
      if (newConfig.catalogInitialLimit !== undefined) {
        await window.api.setSetting('catalog_initial_limit', String(newConfig.catalogInitialLimit))
      }
      if (newConfig.catalogScrollBatch !== undefined) {
        await window.api.setSetting('catalog_scroll_batch', String(newConfig.catalogScrollBatch))
      }
      if (newConfig.modalAutoLoad !== undefined) {
        await window.api.setSetting('modal_autoload', String(newConfig.modalAutoLoad))
      }
      if (newConfig.modalInitialLimit !== undefined) {
        await window.api.setSetting('modal_initial_limit', String(newConfig.modalInitialLimit))
      }
      if (newConfig.modalScrollBatch !== undefined) {
        await window.api.setSetting('modal_scroll_batch', String(newConfig.modalScrollBatch))
      }
    } catch (e) {
      console.error('Error guardando configuración de catálogo:', e)
    }
  },

  loadMetadata: async () => {
    try {
      const [cats, sups] = await Promise.all([
        window.api.catalog.getCategories(),
        window.api.catalog.getSuppliers(),
        get().loadConfig()
      ])
      set({ categories: cats, suppliers: sups })
    } catch (err: any) {
      console.error('Error cargando metadatos de catálogo:', err)
      set({ error: err.message })
    }
  },

  fetchProducts: async (customQuery?: string, context: 'catalog' | 'modal' = 'catalog') => {
    const isModal = context === 'modal'
    if (isModal) {
      set({ modalIsLoading: true, error: null })
    } else {
      set({ isLoading: true, error: null })
    }

    const { searchQuery, modalSearchQuery, selectedCategory, selectedSupplier, selectedProductType, orderBy, orderDir, config } = get()
    const query = customQuery !== undefined ? customQuery : (isModal ? modalSearchQuery : searchQuery)

    try {
      let onlySellable: boolean | undefined = undefined
      let pType: ProductType | undefined = undefined

      if (isModal) {
        onlySellable = true
      } else {
        if (selectedProductType === 'sellable') {
          onlySellable = true
        } else if (selectedProductType === 'all') {
          onlySellable = false
        } else {
          pType = selectedProductType as ProductType
        }
      }

      const limit = isModal ? (config.modalInitialLimit || 150) : (config.catalogInitialLimit || 150)
      const results = await window.api.catalog.search({
        query,
        categoryId: isModal ? null : selectedCategory,
        supplierId: isModal ? null : selectedSupplier,
        productType: pType,
        onlySellable,
        orderBy,
        orderDir,
        limit,
        offset: 0
      })

      if (isModal) {
        set({
          modalProducts: results,
          modalHasMore: results.length === limit,
          modalIsLoading: false
        })
      } else {
        set({
          products: results,
          hasMore: results.length === limit,
          isLoading: false
        })
      }
    } catch (err: any) {
      console.error('Error buscando productos:', err)
      if (isModal) {
        set({ error: err.message, modalIsLoading: false })
      } else {
        set({ error: err.message, isLoading: false })
      }
    }
  },

  loadMoreProducts: async (context: 'catalog' | 'modal' = 'catalog') => {
    const isModal = context === 'modal'
    const state = get()
    const currentLoading = isModal ? state.modalIsLoading : state.isLoading
    const currentLoadingMore = isModal ? state.modalIsLoadingMore : state.isLoadingMore
    const currentHasMore = isModal ? state.modalHasMore : state.hasMore
    const currentProducts = isModal ? state.modalProducts : state.products
    const currentQuery = isModal ? state.modalSearchQuery : state.searchQuery

    if (currentLoading || currentLoadingMore || !currentHasMore) return

    if (isModal) {
      set({ modalIsLoadingMore: true })
    } else {
      set({ isLoadingMore: true })
    }

    try {
      let onlySellable: boolean | undefined = undefined
      let pType: ProductType | undefined = undefined

      if (isModal) {
        onlySellable = true
      } else {
        if (state.selectedProductType === 'sellable') {
          onlySellable = true
        } else if (state.selectedProductType === 'all') {
          onlySellable = false
        } else {
          pType = state.selectedProductType as ProductType
        }
      }

      const limit = isModal ? (state.config.modalScrollBatch || 150) : (state.config.catalogScrollBatch || 150)
      const results = await window.api.catalog.search({
        query: currentQuery,
        categoryId: isModal ? null : state.selectedCategory,
        supplierId: isModal ? null : state.selectedSupplier,
        productType: pType,
        onlySellable,
        orderBy: state.orderBy,
        orderDir: state.orderDir,
        limit,
        offset: currentProducts.length
      })

      if (results.length === 0) {
        if (isModal) {
          set({ modalHasMore: false, modalIsLoadingMore: false })
        } else {
          set({ hasMore: false, isLoadingMore: false })
        }
        return
      }

      // Evitar duplicados por seguridad
      const existingIds = new Set(currentProducts.map((p) => p.id))
      const newItems = results.filter((p) => !existingIds.has(p.id))

      if (isModal) {
        set({
          modalProducts: [...currentProducts, ...newItems],
          modalHasMore: results.length === limit,
          modalIsLoadingMore: false
        })
      } else {
        set({
          products: [...currentProducts, ...newItems],
          hasMore: results.length === limit,
          isLoadingMore: false
        })
      }
    } catch (err: any) {
      console.error('Error cargando más productos:', err)
      if (isModal) {
        set({ error: err.message, modalIsLoadingMore: false })
      } else {
        set({ error: err.message, isLoadingMore: false })
      }
    }
  },

  setSearchQuery: (query: string, context: 'catalog' | 'modal' = 'catalog') => {
    if (context === 'modal') {
      set({ modalSearchQuery: query })
      get().fetchProducts(query, 'modal')
    } else {
      set({ searchQuery: query })
      get().fetchProducts(query, 'catalog')
    }
  },

  setSelectedCategory: (catId: number | null, context: 'catalog' | 'modal' = 'catalog') => {
    set({ selectedCategory: catId })
    get().fetchProducts(undefined, context)
  },

  setSelectedSupplier: (supId: number | null, context: 'catalog' | 'modal' = 'catalog') => {
    set({ selectedSupplier: supId })
    get().fetchProducts(undefined, context)
  },

  setSelectedProductType: (type: 'sellable' | 'simple' | 'variation' | 'variable' | 'all', context: 'catalog' | 'modal' = 'catalog') => {
    set({ selectedProductType: type })
    get().fetchProducts(undefined, context)
  },

  toggleSort: (column: 'name' | 'stock' | 'sale_price', context: 'catalog' | 'modal' = 'catalog') => {
    const { orderBy, orderDir } = get()
    if (orderBy === column) {
      const newDir = orderDir === 'ASC' ? 'DESC' : 'ASC'
      set({ orderDir: newDir })
    } else {
      set({ orderBy: column, orderDir: 'ASC' })
    }
    get().fetchProducts(undefined, context)
  },

  setColumnWidth: (column: string, width: number, context: 'catalog' | 'modal' = 'catalog') => {
    set((state) => {
      const targetKey = context === 'modal' ? 'modalColumnWidths' : 'columnWidths'
      return {
        [targetKey]: {
          ...state[targetKey],
          [column]: Math.max(60, width)
        }
      }
    })
  },

  saveProduct: async (input: ProductInput) => {
    const product = await window.api.catalog.saveProduct(input)
    await get().fetchProducts()
    return product
  },

  saveVariableProduct: async (parent: ProductInput, variations: ProductInput[]) => {
    const result = await window.api.catalog.saveVariableProduct(parent, variations)
    await get().fetchProducts()
    return result
  },

  getVariations: async (parentId: number) => {
    return await window.api.catalog.getVariations(parentId)
  },

  deleteProduct: async (codeOrId: string | number) => {
    const ok = await window.api.catalog.deleteProduct(codeOrId)
    if (ok) {
      await get().fetchProducts()
    }
    return ok
  },

  bulkDeleteProducts: async (productIds: number[]) => {
    const res = await window.api.catalog.bulkDelete(productIds)
    await get().fetchProducts()
    return res
  },

  bulkUpdateCategory: async (productIds: number[], categoryId?: number | null, supplierIds?: number[]) => {
    const res = await window.api.catalog.bulkUpdateCategory(productIds, categoryId, supplierIds)
    await get().fetchProducts()
    return res
  },

  groupProductsAsVariable: async (input: GroupAsVariableInput) => {
    const res = await window.api.catalog.groupAsVariable(input)
    await get().fetchProducts()
    return res
  },

  saveCategory: async (name: string, parentId?: number | null, id?: number) => {
    const cat = await window.api.catalog.saveCategory(name, parentId, id)
    await get().loadMetadata()
    return cat
  },

  deleteCategory: async (id: number) => {
    await window.api.catalog.deleteCategory(id)
    await get().loadMetadata()
    await get().fetchProducts()
  },

  saveSupplier: async (name: string, id?: number) => {
    const sup = await window.api.catalog.saveSupplier(name, id)
    await get().loadMetadata()
    return sup
  },

  deleteSupplier: async (id: number) => {
    const ok = await window.api.catalog.deleteSupplier(id)
    await get().loadMetadata()
    await get().fetchProducts()
    return ok
  },

  seedSampleData: async () => {
    set({ isLoading: true })
    await window.api.catalog.seedSampleData()
    await get().loadMetadata()
    await get().fetchProducts()
    set({ isLoading: false })
  }
}))
