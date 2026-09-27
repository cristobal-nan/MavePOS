import { create } from 'zustand'
import { Category, Family, Product, ProductInput, ProductSearchResult } from '@shared/types'

interface CatalogState {
  products: ProductSearchResult[]
  categories: Category[]
  families: Family[]
  selectedCategory: number | null
  selectedFamily: number | null
  searchQuery: string
  orderBy: 'name' | 'stock' | 'sale_price'
  orderDir: 'ASC' | 'DESC'
  columnWidths: {
    code: number
    name: number
    category: number
    variant: number
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
  setSelectedFamily: (famId: number | null) => void
  toggleSort: (column: 'name' | 'stock' | 'sale_price') => void
  setColumnWidth: (column: string, width: number) => void
  saveProduct: (input: ProductInput) => Promise<Product>
  deleteProduct: (code: string) => Promise<boolean>
  saveCategory: (name: string, parentId?: number | null, id?: number) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  saveFamily: (name: string, categoryId?: number | null, id?: number) => Promise<Family>
  deleteFamily: (id: number) => Promise<void>
  seedSampleData: () => Promise<void>
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  families: [],
  selectedCategory: null,
  selectedFamily: null,
  searchQuery: '',
  orderBy: 'name',
  orderDir: 'ASC',
  columnWidths: {
    code: 140,
    name: 280,
    category: 160,
    variant: 160,
    price: 120,
    stock: 100,
    actions: 100
  },
  isLoading: false,
  error: null,

  loadMetadata: async () => {
    try {
      const [cats, fams] = await Promise.all([
        window.api.getCategories(),
        window.api.getFamilies()
      ])
      set({ categories: cats, families: fams })
    } catch (err: any) {
      console.error('Error cargando categorías y familias:', err)
      set({ error: err.message })
    }
  },

  fetchProducts: async (customQuery?: string) => {
    set({ isLoading: true, error: null })
    const { searchQuery, selectedCategory, selectedFamily, orderBy, orderDir } = get()
    const query = customQuery !== undefined ? customQuery : searchQuery

    try {
      const results = await window.api.searchProducts({
        query,
        categoryId: selectedCategory,
        familyId: selectedFamily,
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

  setSelectedFamily: (famId: number | null) => {
    set({ selectedFamily: famId })
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

  deleteProduct: async (code: string) => {
    const ok = await window.api.deleteProduct(code)
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

  saveFamily: async (name: string, categoryId?: number | null, id?: number) => {
    const fam = await window.api.saveFamily(name, categoryId, id)
    await get().loadMetadata()
    return fam
  },

  deleteFamily: async (id: number) => {
    await window.api.deleteFamily(id)
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
