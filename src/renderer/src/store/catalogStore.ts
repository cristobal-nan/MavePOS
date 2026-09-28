import { create } from 'zustand'
import { Category, Product, ProductInput, ProductSearchResult, ProductType } from '@shared/types'

interface CatalogState {
  products: ProductSearchResult[]
  categories: Category[]
  selectedCategory: number | null
  selectedProductType: ProductType | 'all'
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
  error: string | null

  // Actions
  loadMetadata: () => Promise<void>
  fetchProducts: (customQuery?: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedCategory: (catId: number | null) => void
  setSelectedProductType: (type: ProductType | 'all') => void
  toggleSort: (column: 'name' | 'stock' | 'sale_price') => void
  setColumnWidth: (column: string, width: number) => void
  saveProduct: (input: ProductInput) => Promise<Product>
  saveVariableProduct: (parent: ProductInput, variations: ProductInput[]) => Promise<{ parent: Product; variations: Product[] }>
  getVariations: (parentId: number) => Promise<Product[]>
  deleteProduct: (codeOrId: string | number) => Promise<boolean>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  seedSampleData: () => Promise<void>
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  selectedCategory: null,
  selectedProductType: 'all',
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
  error: null,

  loadMetadata: async () => {
    try {
      const cats = await window.api.getCategories()
      set({ categories: cats })
    } catch (err: any) {
      console.error('Error cargando categorías:', err)
      set({ error: err.message })
    }
  },

  fetchProducts: async (customQuery?: string) => {
    set({ isLoading: true, error: null })
    const { searchQuery, selectedCategory, selectedProductType, orderBy, orderDir } = get()
    const query = customQuery !== undefined ? customQuery : searchQuery

    try {
      const results = await window.api.searchProducts({
        query,
        categoryId: selectedCategory,
        productType: selectedProductType === 'all' ? undefined : selectedProductType,
        orderBy,
        orderDir,
        limit: 300
      })
      set({ products: results, isLoading: false })
    } catch (err: any) {
      console.error('Error buscando productos:', err)
      set({ error: err.message, isLoading: false })
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

  setSelectedProductType: (type: ProductType | 'all') => {
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
    const product = await window.api.saveProduct(input)
    await get().fetchProducts()
    return product
  },

  saveVariableProduct: async (parent: ProductInput, variations: ProductInput[]) => {
    const result = await window.api.saveVariableProduct(parent, variations)
    await get().fetchProducts()
    return result
  },

  getVariations: async (parentId: number) => {
    return await window.api.getVariations(parentId)
  },

  deleteProduct: async (codeOrId: string | number) => {
    const ok = await window.api.deleteProduct(codeOrId)
    if (ok) {
      await get().fetchProducts()
    }
    return ok
  },

  saveCategory: async (name: string, parentId?: number | null, id?: number) => {
    const cat = await window.api.saveCategory(name, parentId, id)
    await get().loadMetadata()
    return cat
  },

  deleteCategory: async (id: number) => {
    await window.api.deleteCategory(id)
    await get().loadMetadata()
    await get().fetchProducts()
  },

  seedSampleData: async () => {
    set({ isLoading: true })
    await window.api.seedSampleData()
    await get().loadMetadata()
    await get().fetchProducts()
    set({ isLoading: false })
  }
}))
