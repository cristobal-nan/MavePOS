import { create } from 'zustand'
import { Category, Product, ProductInput, ProductSearchResult, ProductType, GroupAsVariableInput, Supplier } from '@shared/types'

interface CatalogState {
  products: ProductSearchResult[]
  categories: Category[]
  suppliers: Supplier[]
  selectedCategory: number | null
  selectedSupplier: number | null
  selectedProductType: 'sellable' | 'simple' | 'variation' | 'variable' | 'all'
  searchQuery: string
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
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null

  // Actions
  loadMetadata: () => Promise<void>
  fetchProducts: (customQuery?: string) => Promise<void>
  loadMoreProducts: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedCategory: (catId: number | null) => void
  setSelectedSupplier: (supId: number | null) => void
  setSelectedProductType: (type: 'sellable' | 'simple' | 'variation' | 'variable' | 'all') => void
  toggleSort: (column: 'name' | 'stock' | 'sale_price') => void
  setColumnWidth: (column: string, width: number) => void
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
  categories: [],
  suppliers: [],
  selectedCategory: null,
  selectedSupplier: null,
  selectedProductType: 'sellable',
  searchQuery: '',
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
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  error: null,

  loadMetadata: async () => {
    try {
      const [cats, sups] = await Promise.all([
        window.api.catalog.getCategories(),
        window.api.catalog.getSuppliers()
      ])
      set({ categories: cats, suppliers: sups })
    } catch (err: any) {
      console.error('Error cargando metadatos de catálogo:', err)
      set({ error: err.message })
    }
  },

  fetchProducts: async (customQuery?: string) => {
    set({ isLoading: true, error: null })
    const { searchQuery, selectedCategory, selectedSupplier, selectedProductType, orderBy, orderDir } = get()
    const query = customQuery !== undefined ? customQuery : searchQuery

    try {
      let onlySellable: boolean | undefined = undefined
      let pType: ProductType | undefined = undefined

      if (selectedProductType === 'sellable') {
        onlySellable = true
      } else if (selectedProductType === 'all') {
        onlySellable = false
      } else {
        pType = selectedProductType as ProductType
      }

      const PAGE_SIZE = 150
      const results = await window.api.catalog.search({
        query,
        categoryId: selectedCategory,
        supplierId: selectedSupplier,
        productType: pType,
        onlySellable,
        orderBy,
        orderDir,
        limit: PAGE_SIZE,
        offset: 0
      })

      set({
        products: results,
        hasMore: results.length === PAGE_SIZE,
        isLoading: false
      })
    } catch (err: any) {
      console.error('Error buscando productos:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  loadMoreProducts: async () => {
    const {
      isLoading,
      isLoadingMore,
      hasMore,
      products,
      searchQuery,
      selectedCategory,
      selectedSupplier,
      selectedProductType,
      orderBy,
      orderDir
    } = get()

    if (isLoading || isLoadingMore || !hasMore) return

    set({ isLoadingMore: true })
    try {
      let onlySellable: boolean | undefined = undefined
      let pType: ProductType | undefined = undefined

      if (selectedProductType === 'sellable') {
        onlySellable = true
      } else if (selectedProductType === 'all') {
        onlySellable = false
      } else {
        pType = selectedProductType as ProductType
      }

      const PAGE_SIZE = 150
      const results = await window.api.catalog.search({
        query: searchQuery,
        categoryId: selectedCategory,
        supplierId: selectedSupplier,
        productType: pType,
        onlySellable,
        orderBy,
        orderDir,
        limit: PAGE_SIZE,
        offset: products.length
      })

      if (results.length === 0) {
        set({ hasMore: false, isLoadingMore: false })
        return
      }

      // Evitar duplicados por seguridad
      const existingIds = new Set(products.map((p) => p.id))
      const newItems = results.filter((p) => !existingIds.has(p.id))

      set({
        products: [...products, ...newItems],
        hasMore: results.length === PAGE_SIZE,
        isLoadingMore: false
      })
    } catch (err: any) {
      console.error('Error cargando más productos:', err)
      set({ error: err.message, isLoadingMore: false })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    get().fetchProducts(query)
  },

  setSelectedCategory: (catId: number | null) => {
    set({ selectedCategory: catId })
    get().fetchProducts()
  },

  setSelectedSupplier: (supId: number | null) => {
    set({ selectedSupplier: supId })
    get().fetchProducts()
  },

  setSelectedProductType: (type: 'sellable' | 'simple' | 'variation' | 'variable' | 'all') => {
    set({ selectedProductType: type })
    get().fetchProducts()
  },

  toggleSort: (column: 'name' | 'stock' | 'sale_price') => {
    const { orderBy, orderDir } = get()
    if (orderBy === column) {
      const newDir = orderDir === 'ASC' ? 'DESC' : 'ASC'
      set({ orderDir: newDir })
    } else {
      set({ orderBy: column, orderDir: 'ASC' })
    }
    get().fetchProducts()
  },

  setColumnWidth: (column: string, width: number) => {
    set((state) => ({
      columnWidths: {
        ...state.columnWidths,
        [column]: Math.max(60, width)
      }
    }))
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
