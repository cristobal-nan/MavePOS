import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMemoryCatalogStore } from '../renderer/src/store/memoryCatalogStore'
import { ProductSearchResult } from '../shared/types'

describe('MemoryCatalogStore - Catálogo en Memoria y Búsqueda Instantánea (0 ms)', () => {
  const sampleProducts: ProductSearchResult[] = [
    {
      id: 1,
      code: '00123',
      name: 'Algodón Rústico Natural',
      search_name: 'ALGODON RUSTICO NATURAL',
      sale_price: 2500,
      cost_price: 1500,
      product_type: 'simple',
      parent_id: null,
      attribute_name: null,
      attribute_value: null,
      category_id: 10,
      stock: 40,
      min_stock: 5,
      active: 1,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    },
    {
      id: 2,
      code: '124',
      name: 'Algodón Rústico Negro',
      search_name: 'ALGODON RUSTICO NEGRO',
      sale_price: 2500,
      cost_price: 1500,
      product_type: 'simple',
      parent_id: null,
      attribute_name: null,
      attribute_value: null,
      category_id: 10,
      stock: 12,
      min_stock: 5,
      active: 1,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    },
    {
      id: 3,
      code: '8899',
      name: 'Lana Merino Extra Fina',
      search_name: 'LANA MERINO EXTRA FINA',
      sale_price: 4990,
      cost_price: 3000,
      product_type: 'simple',
      parent_id: null,
      attribute_name: null,
      attribute_value: null,
      category_id: 20,
      stock: 8,
      min_stock: 2,
      active: 1,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    // Configurar estado en memoria con copias frescas (los tests de stock mutan los objetos en sitio)
    const items = sampleProducts.map((p) => ({ ...p }))
    useMemoryCatalogStore.setState({
      isInitialized: true,
      isLoading: false,
      products: items,
      totalCount: items.length,
      codeIndex: new Map([
        ['00123', items[0]],
        ['123', items[0]],
        ['124', items[1]],
        ['8899', items[2]]
      ]),
      idIndex: new Map([
        [1, items[0]],
        [2, items[1]],
        [3, items[2]]
      ])
    })
  })

  it('obtiene productos por código exacto y con tolerancia a ceros a la izquierda en 0 ms', () => {
    const store = useMemoryCatalogStore.getState()
    
    // Código tal cual
    expect(store.getByCodeFast('00123')?.name).toBe('Algodón Rústico Natural')
    // Sin ceros a la izquierda
    expect(store.getByCodeFast('123')?.name).toBe('Algodón Rústico Natural')
    // Con minúsculas o espacios
    expect(store.getByCodeFast(' 124 ')?.name).toBe('Algodón Rústico Negro')
    // Código inexistente
    expect(store.getByCodeFast('999999')).toBeNull()
  })

  it('filtra productos por nombre anclado al inicio y con comodín intermedio %', () => {
    const store = useMemoryCatalogStore.getState()

    // Anclado al inicio: 'algod'
    const resAlgod = store.searchLocal({ query: 'algod' })
    expect(resAlgod.length).toBe(2)
    expect(resAlgod.every((p) => p.name.includes('Algodón'))).toBe(true)

    // Comodín intermedio: 'algod%negro'
    const resNegro = store.searchLocal({ query: 'algod%negro' })
    expect(resNegro.length).toBe(1)
    expect(resNegro[0].name).toBe('Algodón Rústico Negro')

    // Comodín en cualquier parte: '%merino'
    const resMerino = store.searchLocal({ query: '%merino' })
    expect(resMerino.length).toBe(1)
    expect(resMerino[0].name).toBe('Lana Merino Extra Fina')
  })

  it('sincroniza deducción de inventario en memoria al concretar una venta (decrementStockLocal)', () => {
    const store = useMemoryCatalogStore.getState()
    expect(store.getByCodeFast('00123')?.stock).toBe(40)

    store.decrementStockLocal([{ product_code: '00123', quantity: 5 }])

    expect(store.getByCodeFast('00123')?.stock).toBe(35)
  })

  it('sincroniza ajuste físico directo en memoria (adjustStockLocal)', () => {
    const store = useMemoryCatalogStore.getState()

    store.adjustStockLocal('8899', 25)

    expect(store.getByCodeFast('8899')?.stock).toBe(25)
  })

  it('actualiza o inserta productos modificados en memoria (updateProductLocal)', () => {
    const store = useMemoryCatalogStore.getState()
    const updatedProd: ProductSearchResult = {
      ...sampleProducts[0],
      sale_price: 2990,
      name: 'Algodón Rústico Natural Premium'
    }

    store.updateProductLocal(updatedProd)

    const found = store.getByCodeFast('00123')
    expect(found?.sale_price).toBe(2990)
    expect(found?.name).toBe('Algodón Rústico Natural Premium')
  })

  it('respeta el límite cortando en orden canónico (ASC y DESC) sin ordenar en cada tecla', () => {
    const store = useMemoryCatalogStore.getState()

    const asc = store.searchLocal({ query: '', limit: 2 })
    expect(asc.map((p) => p.id)).toEqual([1, 2])

    const desc = store.searchLocal({ query: '', orderDir: 'DESC', limit: 2 })
    expect(desc.map((p) => p.id)).toEqual([3, 2])
  })

  it('ordena por precio/stock con desempate estable por nombre', () => {
    const store = useMemoryCatalogStore.getState()

    const byPrice = store.searchLocal({ query: '', orderBy: 'sale_price', orderDir: 'DESC' })
    expect(byPrice.map((p) => p.id)).toEqual([3, 1, 2])

    const byStock = store.searchLocal({ query: '', orderBy: 'stock' })
    expect(byStock.map((p) => p.id)).toEqual([3, 2, 1])
  })

  it('encuentra por código exacto (con tolerancia a ceros) aunque el nombre no coincida', () => {
    const store = useMemoryCatalogStore.getState()

    expect(store.searchLocal({ query: '8899' }).map((p) => p.id)).toEqual([3])
    expect(store.searchLocal({ query: '0124' }).map((p) => p.id)).toEqual([2])
  })

  it('mantiene el orden canónico al insertar un producto nuevo (updateProductLocal)', () => {
    const store = useMemoryCatalogStore.getState()
    store.updateProductLocal({
      ...sampleProducts[0],
      id: 4,
      code: '5000',
      name: 'Hilo Crochet',
      search_name: 'HILO CROCHET'
    })

    const names = useMemoryCatalogStore.getState().products.map((p) => p.search_name)
    expect(names).toEqual([
      'ALGODON RUSTICO NATURAL',
      'ALGODON RUSTICO NEGRO',
      'HILO CROCHET',
      'LANA MERINO EXTRA FINA'
    ])
  })

  it('agrupa variaciones bajo el nombre del padre en el orden canónico', () => {
    const store = useMemoryCatalogStore.getState()
    store.updateProductLocal({
      ...sampleProducts[0],
      id: 5,
      code: '7001',
      name: 'Azul',
      search_name: 'AZUL',
      product_type: 'variation',
      parent_id: 99,
      parent_search_name: 'BAMBU'
    })

    const ids = useMemoryCatalogStore.getState().products.map((p) => p.id)
    // "BAMBU AZUL" va entre ALGODON y LANA (ordena por el padre, no por "AZUL")
    expect(ids).toEqual([1, 2, 5, 3])
    expect(store.searchLocal({ query: 'bambu' }).map((p) => p.id)).toEqual([5])
  })

  it('searchLocal filtra correctamente por productType y onlySellable', () => {
    const store = useMemoryCatalogStore.getState()
    store.updateProductLocal({
      ...sampleProducts[0],
      id: 99,
      code: '',
      name: 'Padre Algodón',
      search_name: 'PADRE ALGODON',
      product_type: 'variable'
    })

    // all: incluye simples, variaciones y el padre variable
    const all = store.searchLocal({ productType: 'all' })
    expect(all.some((p) => p.id === 99)).toBe(true)

    // sellable: excluye variables
    const sellable = store.searchLocal({ productType: 'sellable' })
    expect(sellable.some((p) => p.id === 99)).toBe(false)

    // variable: únicamente padres variables
    const variables = store.searchLocal({ productType: 'variable' })
    expect(variables.every((p) => p.product_type === 'variable')).toBe(true)
    expect(variables.some((p) => p.id === 99)).toBe(true)

    // simple: únicamente simples
    const simples = store.searchLocal({ productType: 'simple' })
    expect(simples.every((p) => p.product_type === 'simple')).toBe(true)
  })
})

describe('CatalogStore - resolución a 0 ms sin consultar SQLite cuando el catálogo en RAM está listo', () => {
  it('fetchProducts(modal) y fetchProducts(catalog) no invocan IPC ni activan isLoading con la memoria inicializada', async () => {
    const searchSpy = vi.fn().mockResolvedValue([])
    ;(globalThis as any).window = { api: { catalog: { search: searchSpy } } }
    const { useCatalogStore } = await import('../renderer/src/store/catalogStore')

    useMemoryCatalogStore.setState({ isInitialized: true })
    await useCatalogStore.getState().fetchProducts('algod', 'modal')
    expect(searchSpy).not.toHaveBeenCalled()
    expect(useCatalogStore.getState().modalIsLoading).toBe(false)

    await useCatalogStore.getState().fetchProducts(undefined, 'catalog')
    expect(searchSpy).not.toHaveBeenCalled()
    expect(useCatalogStore.getState().isLoading).toBe(false)

    useMemoryCatalogStore.setState({ isInitialized: false })
    await useCatalogStore.getState().fetchProducts('algod', 'modal')
    expect(searchSpy).toHaveBeenCalledTimes(1)
  })
})
