import { describe, it, expect, beforeEach } from 'vitest'
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
    // Configurar estado en memoria con productos de prueba
    useMemoryCatalogStore.setState({
      isInitialized: true,
      isLoading: false,
      products: [...sampleProducts],
      totalCount: sampleProducts.length,
      codeIndex: new Map([
        ['00123', sampleProducts[0]],
        ['123', sampleProducts[0]],
        ['124', sampleProducts[1]],
        ['8899', sampleProducts[2]]
      ]),
      idIndex: new Map([
        [1, sampleProducts[0]],
        [2, sampleProducts[1]],
        [3, sampleProducts[2]]
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
})
