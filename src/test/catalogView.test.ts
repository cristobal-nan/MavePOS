import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CatalogView } from '../renderer/src/views/CatalogView'
import { ProductSearchModal } from '../renderer/src/components/ProductSearchModal'
import { ProductFormModal } from '../renderer/src/components/ProductFormModal'
import { ProductSearch } from '../renderer/src/components/ProductSearch'
import { ProductSearchResult } from '@shared/types'

// Mock stores
vi.mock('../renderer/src/store/catalogStore', () => ({
  useCatalogStore: Object.assign(
    () => ({
      products: [
        {
          id: 1,
          code: 'PROD-001',
          name: 'Algodón Rústico Negro',
          sale_price: 3500,
          cost_price: 2000,
          stock: 12,
          min_stock: 5,
          product_type: 'simple',
          category_id: 1,
          category_name: 'Lanas'
        }
      ],
      modalProducts: [],
      categories: [{ id: 1, name: 'Lanas' }],
      suppliers: [{ id: 1, name: 'Textil Chile' }],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      selectedSupplier: null,
      setSelectedSupplier: vi.fn(),
      selectedProductType: 'all',
      setSelectedProductType: vi.fn(),
      searchQuery: '',
      modalSearchQuery: '',
      setSearchQuery: vi.fn(),
      orderBy: 'name',
      orderDir: 'ASC',
      toggleSort: vi.fn(),
      columnWidths: { code: 130, name: 270, type: 140, category: 160, price: 110, stock: 90, actions: 100 },
      modalColumnWidths: { code: 120, name: 260, type: 130, category: 150, price: 100, stock: 80, actions: 0 },
      setColumnWidth: vi.fn(),
      isLoading: false,
      modalIsLoading: false,
      isLoadingMore: false,
      modalIsLoadingMore: false,
      hasMore: false,
      modalHasMore: false,
      loadMoreProducts: vi.fn(),
      fetchProducts: vi.fn(),
      loadMetadata: vi.fn().mockResolvedValue(undefined),
      bulkDeleteProducts: vi.fn(),
      seedSampleData: vi.fn(),
      saveProduct: vi.fn(),
      saveVariableProduct: vi.fn(),
      getVariations: vi.fn().mockResolvedValue([]),
      deleteProduct: vi.fn(),
      config: { catalogAutoLoad: true, modalAutoLoad: true }
    }),
    {
      getState: () => ({
        config: { catalogAutoLoad: true, modalAutoLoad: true },
        setSelectedProductType: vi.fn(),
        setSearchQuery: vi.fn(),
        fetchProducts: vi.fn(),
        loadMetadata: vi.fn().mockResolvedValue(undefined),
        loadConfig: vi.fn().mockResolvedValue(undefined),
        modalProducts: [],
        modalSearchQuery: ''
      }),
      setState: vi.fn()
    }
  )
}))

vi.mock('../renderer/src/store/memoryCatalogStore', () => ({
  useMemoryCatalogStore: () => ({
    isInitialized: false,
    searchLocal: vi.fn()
  })
}))

vi.mock('../renderer/src/store/uiStore', () => ({
  useUIStore: () => ({
    activeTab: 'catalogo',
    setActiveTab: vi.fn()
  })
}))

vi.mock('../renderer/src/store/inventoryStore', () => ({
  useInventoryStore: () => ({
    setSelectedProduct: vi.fn(),
    setActiveTab: vi.fn()
  })
}))

describe('Auditoría UI Pantalla 2: Catálogo y Productos (CatalogView y modales asociados)', () => {
  it('CatalogView integra ViewHeader canónico con título, badge con tabular-nums y botón primario', () => {
    const html = renderToStaticMarkup(React.createElement(CatalogView))

    expect(html).toContain('Catálogo de Productos')
    expect(html).toContain('Nuevo Producto')
    expect(html).toContain('tabular-nums')
  })

  it('CatalogView conecta SubTabs canónicas para filtrado rápido por tipo de producto', () => {
    const html = renderToStaticMarkup(React.createElement(CatalogView))

    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('Todos')
    expect(html).toContain('Vendibles')
    expect(html).toContain('Simples')
    expect(html).toContain('Variables')
    expect(html).toContain('Variaciones')
    expect(html).toContain('Filtrar catálogo por tipo de producto')
  })

  it('ProductSearchModal renderiza con semántica accesible de diálogo ARIA', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductSearchModal, {
        isOpen: true,
        onClose: () => {},
        onSelectProduct: () => {}
      })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="product-search-modal-title"')
    expect(html).toContain('id="product-search-modal-title"')
    expect(html).toContain('Búsqueda de Productos')
    expect(html).toContain('Cerrar (Esc)')
  })

  it('ProductSearch renderiza filas de tabla ultra compactas (h-7.5) con tabular-nums en código, precios y stock', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductSearch, {
        context: 'catalog',
        showActions: true,
        enableMultiSelect: true
      })
    )

    expect(html).toContain('h-7.5')
    expect(html).toContain('tabular-nums')
    expect(html).toContain('font-mono')
    expect(html).toContain('PROD-001')
    expect(html).toContain('$ 3.500')
    expect(html).toContain('aria-label="Seleccionar todos los productos visibles"')
  })

  it('ProductFormModal renderiza con role="dialog" y bloquea la edición directa de stock para productos existentes', () => {
    const sampleProduct: ProductSearchResult = {
      id: 10,
      code: 'EXISTING-01',
      name: 'Hilo Mercerizado 50g',
      sale_price: 2500,
      cost_price: 1500,
      stock: 45,
      min_stock: 10,
      product_type: 'simple'
    }

    const html = renderToStaticMarkup(
      React.createElement(ProductFormModal, {
        isOpen: true,
        product: sampleProduct,
        onClose: () => {}
      })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="product-form-title"')
    expect(html).toContain('Editar Producto Simple')
    // El campo de stock debe estar bloqueado y contener el botón "Ajustar" en lugar de un input editable
    expect(html).toContain('La existencia no se puede editar directamente')
    expect(html).toContain('Ajustar')
  })
})
