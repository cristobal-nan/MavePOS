import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { ProductService } from '../main/services/productService'

describe('Fase 4: Motor de Búsqueda de Productos (% wildcard, normalización y reglas de dominio)', () => {
  let db: Database.Database
  let productService: ProductService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    productService = new ProductService(db)

    // Poblamos el catálogo exacto de prueba especificado en docs/ESPECIFICACION.md §5.2
    const sampleProducts = [
      { code: 'P1', name: 'Algodón negro', sale_price: 1000 },
      { code: 'P2', name: 'Algodón azul', sale_price: 1000 },
      { code: 'P3', name: 'Algodón natural', sale_price: 1000 },
      { code: 'P4', name: 'Algodón premium negro', sale_price: 1000 },
      { code: 'P5', name: 'Algodón económico negro barato', sale_price: 1000 },
      { code: 'P6', name: 'Lana negro', sale_price: 1000 },
      { code: 'P7', name: 'Hilo negro', sale_price: 1000 },
      { code: 'P8', name: 'Estuche de algodón', sale_price: 1000 },
      // Casos adicionales para testing de '_' literal
      { code: 'P9', name: 'Lana_1 especial', sale_price: 1000 },
      { code: 'P10', name: 'Lana 1 normal', sale_price: 1000 }
    ]

    for (const p of sampleProducts) {
      productService.upsertProduct(p)
    }
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('algod: coincide solo con los que INICIAN con "Algodón" (excluye "Estuche de algodón")', () => {
    const results = productService.searchProducts({ query: 'algod' })
    const names = results.map((r) => r.name)

    expect(names).toContain('Algodón negro')
    expect(names).toContain('Algodón azul')
    expect(names).toContain('Algodón natural')
    expect(names).toContain('Algodón premium negro')
    expect(names).toContain('Algodón económico negro barato')
    // "Estuche de algodón" no empieza con "algod"
    expect(names).not.toContain('Estuche de algodón')
    expect(names.length).toBe(5)
  })

  it('%algod: coincide en CUALQUIER parte (incluye "Estuche de algodón")', () => {
    const results = productService.searchProducts({ query: '%algod' })
    const names = results.map((r) => r.name)

    expect(names).toContain('Algodón negro')
    expect(names).toContain('Algodón azul')
    expect(names).toContain('Algodón natural')
    expect(names).toContain('Algodón premium negro')
    expect(names).toContain('Algodón económico negro barato')
    expect(names).toContain('Estuche de algodón')
    expect(names.length).toBe(6)
  })

  it('negro: busca al inicio del nombre (en este catálogo ninguno inicia con "Negro")', () => {
    const results = productService.searchProducts({ query: 'negro' })
    expect(results.length).toBe(0)
  })

  it('%negro: coincide en cualquier parte con "negro"', () => {
    const results = productService.searchProducts({ query: '%negro' })
    const names = results.map((r) => r.name)

    expect(names).toContain('Algodón negro')
    expect(names).toContain('Algodón premium negro')
    expect(names).toContain('Algodón económico negro barato')
    expect(names).toContain('Lana negro')
    expect(names).toContain('Hilo negro')
    expect(names).not.toContain('Algodón azul')
    expect(names).not.toContain('Estuche de algodón')
    expect(names.length).toBe(5)
  })

  it('%%negro: fragmentos vacíos descartados, resultado idéntico a %negro', () => {
    const results = productService.searchProducts({ query: '%%negro' })
    expect(results.length).toBe(5)
  })

  it('algod%: el % final no altera la búsqueda (idéntico a "algod")', () => {
    const results = productService.searchProducts({ query: 'algod%' })
    const names = results.map((r) => r.name)

    expect(names.length).toBe(5)
    expect(names).not.toContain('Estuche de algodón')
  })

  it('algod%negro: empieza con "algod" Y contiene "negro" en cualquier parte', () => {
    const results = productService.searchProducts({ query: 'algod%negro' })
    const names = results.map((r) => r.name)

    expect(names).toContain('Algodón negro')
    expect(names).toContain('Algodón premium negro')
    expect(names).toContain('Algodón económico negro barato')
    expect(names).not.toContain('Algodón azul')
    expect(names).not.toContain('Lana negro')
    expect(names).not.toContain('Estuche de algodón')
    expect(names.length).toBe(3)
  })

  it('algod%natural: empieza con "algod" Y contiene "natural"', () => {
    const results = productService.searchProducts({ query: 'algod%natural' })
    const names = results.map((r) => r.name)

    expect(names).toEqual(['Algodón natural'])
  })

  it('insensible a mayúsculas y tildes (ej: "ALGODON" o "algodon" devuelven lo mismo que "algodón")', () => {
    const resSinTilde = productService.searchProducts({ query: 'algodon' })
    const resConTilde = productService.searchProducts({ query: 'algodón' })
    const resMayus = productService.searchProducts({ query: 'ALGODÓN' })

    expect(resSinTilde.length).toBe(5)
    expect(resConTilde.length).toBe(5)
    expect(resMayus.length).toBe(5)
  })

  it('_ es literal y nunca comodín de un solo caracter', () => {
    // Si _ fuera comodín, coincidiría tanto con "Lana_1 especial" como con "Lana 1 normal"
    const results = productService.searchProducts({ query: 'Lana_1' })
    const names = results.map((r) => r.name)

    expect(names).toContain('Lana_1 especial')
    expect(names).not.toContain('Lana 1 normal')
  })

  it('búsqueda por código exacto encuentra el producto directamente', () => {
    const resultByCode = productService.searchProducts({ query: 'P7' })
    expect(resultByCode.length).toBe(1)
    expect(resultByCode[0].name).toBe('Hilo negro')
  })

  it('búsqueda con input vacío o solo % lista todos los productos activos', () => {
    const all1 = productService.searchProducts({ query: '' })
    const all2 = productService.searchProducts({ query: '%' })
    const all3 = productService.searchProducts({ query: '%%' })

    expect(all1.length).toBe(10)
    expect(all2.length).toBe(10)
    expect(all3.length).toBe(10)
  })

  it('Gestión de Producto Variable con Variaciones e identificación por atributo', () => {
    const { parent, variations } = productService.saveVariableProduct(
      {
        name: 'Algodón Rústico',
        attribute_name: 'Color'
      },
      [
        {
          code: 'VAR1',
          name: 'Algodón Rústico Azul',
          attribute_value: 'Azul',
          sale_price: 3200,
          stock: 20
        },
        {
          code: 'VAR2',
          name: 'Algodón Rústico Rojo',
          attribute_value: 'Rojo',
          sale_price: 3200,
          stock: 15
        }
      ]
    )

    expect(parent.id).toBeGreaterThan(0)
    expect(variations.length).toBe(2)

    // Búsqueda filtrada por producto padre
    const variationsFound = productService.searchProducts({ parentId: parent.id })
    expect(variationsFound.length).toBe(2)
    expect(variationsFound[0].parent_name).toBe('Algodón Rústico')
    expect(variationsFound.map((p) => p.attribute_value)).toEqual(['Azul', 'Rojo'])

    // Búsqueda filtrada con onlySellable excluye el producto padre variable
    const allSellable = productService.searchProducts({ query: 'Algodón Rústico', onlySellable: true })
    expect(allSellable.every((p) => p.product_type !== 'variable')).toBe(true)
  })

  it('orden alfabético por nombre del padre (o simple) para que variaciones queden agrupadas por su producto padre', () => {
    // Padre que empieza con "A"
    productService.saveVariableProduct(
      { name: 'Algodón Modelo A', attribute_name: 'Color' },
      [
        {
          code: 'VAR_Z',
          name: 'Algodón Modelo A Zafiro',
          attribute_value: 'Zafiro',
          sale_price: 3000,
          stock: 10
        }
      ]
    )

    // Producto Simple que empieza con "B"
    productService.upsertProduct({
      code: 'PROD_B',
      name: 'Botones Dorados',
      product_type: 'simple',
      sale_price: 500,
      stock: 50
    })

    // Listamos productos vendibles (excluye padre variable) ordenados por nombre
    const results = productService.searchProducts({ onlySellable: true, orderBy: 'name', orderDir: 'ASC' })

    const codes = results.map((r) => r.code)
    const indexZ = codes.indexOf('VAR_Z')
    const indexB = codes.indexOf('PROD_B')

    // Aunque la variación sea "Zafiro", pertenece al padre "Algodón...", por lo que debe quedar ANTES de "Botones..." (B)
    expect(indexZ).toBeGreaterThanOrEqual(0)
    expect(indexB).toBeGreaterThanOrEqual(0)
    expect(indexZ).toBeLessThan(indexB)

    // Ningún padre variable debe aparecer en la lista de vendibles
    expect(results.some((r) => r.product_type === 'variable')).toBe(false)
  })

  it('paginación progresiva: soporta limit y offset para navegar por todo el catálogo por lotes sin solapamientos', () => {
    // Obtenemos los productos en lotes de 3
    const batch1 = productService.searchProducts({ limit: 3, offset: 0 })
    const batch2 = productService.searchProducts({ limit: 3, offset: 3 })
    const batch3 = productService.searchProducts({ limit: 3, offset: 6 })
    const batch4 = productService.searchProducts({ limit: 3, offset: 9 })

    expect(batch1.length).toBe(3)
    expect(batch2.length).toBe(3)
    expect(batch3.length).toBe(3)
    expect(batch4.length).toBeGreaterThan(0)

    // Los códigos entre lotes no deben repetirse
    const codes1 = new Set(batch1.map((p) => p.code))
    const codes2 = new Set(batch2.map((p) => p.code))
    const codes3 = new Set(batch3.map((p) => p.code))

    for (const code of codes2) {
      expect(codes1.has(code)).toBe(false)
    }
    for (const code of codes3) {
      expect(codes1.has(code)).toBe(false)
      expect(codes2.has(code)).toBe(false)
    }
  })

  it('tolerancia de ceros a la izquierda en búsqueda por código (getProductByCode)', () => {
    productService.upsertProduct({
      code: '007542',
      name: 'Aguja Crochet 4mm',
      sale_price: 1500
    })

    // Búsqueda con ceros exactos
    const exact = productService.getProductByCode('007542')
    expect(exact).not.toBeNull()
    expect(exact?.name).toBe('Aguja Crochet 4mm')

    // Búsqueda sin ceros a la izquierda (código escaneado que omitió ceros)
    const stripped = productService.getProductByCode('7542')
    expect(stripped).not.toBeNull()
    expect(stripped?.name).toBe('Aguja Crochet 4mm')

    // Búsqueda con ceros extra digitados
    const extraZeros = productService.getProductByCode('00007542')
    expect(extraZeros).not.toBeNull()
    expect(extraZeros?.name).toBe('Aguja Crochet 4mm')

    // Producto importado sin cero inicial pero con puntos (ej: 3.19234)
    productService.upsertProduct({
      code: '3.19234',
      name: 'Lana Especial 3.19234',
      sale_price: 2500
    })

    // Escanear código con cero inicial '03.19234' debe encontrar '3.19234'
    const scannedWithZero = productService.getProductByCode('03.19234')
    expect(scannedWithZero).not.toBeNull()
    expect(scannedWithZero?.code).toBe('3.19234')
    expect(scannedWithZero?.name).toBe('Lana Especial 3.19234')

    // Escanear código con múltiples ceros iniciales '003.19234'
    const scannedMultipleZeros = productService.getProductByCode('003.19234')
    expect(scannedMultipleZeros).not.toBeNull()
    expect(scannedMultipleZeros?.code).toBe('3.19234')

    // Búsqueda por catálogo con searchProducts usando el código escaneado '03.19234'
    const searchResults = productService.searchProducts({ query: '03.19234' })
    expect(searchResults.some((p) => p.code === '3.19234')).toBe(true)
  })

  it('permite configurar límites iniciales y lotes de scroll dinámicos', () => {
    // Buscar con límite inicial configurado de 4
    const initialBatch = productService.searchProducts({ query: '', limit: 4, offset: 0 })
    expect(initialBatch.length).toBe(4)

    // Siguiente lote con tamaño configurable de 2
    const nextBatch = productService.searchProducts({ query: '', limit: 2, offset: 4 })
    expect(nextBatch.length).toBe(2)

    // No se superponen
    const initialCodes = new Set(initialBatch.map((p) => p.code))
    for (const p of nextBatch) {
      expect(initialCodes.has(p.code)).toBe(false)
    }
  })

  it('permite verificar stock antes de eliminar producto simple o variación', () => {
    // Producto con stock
    const pWithStock = productService.upsertProduct({
      code: 'WITH-STOCK-1',
      name: 'Lana Azul Gruesa',
      sale_price: 2500,
      stock: 15
    })
    expect(pWithStock).not.toBeNull()
    expect(pWithStock.stock).toBe(15)

    // Producto sin stock (0)
    const pZeroStock = productService.upsertProduct({
      code: 'ZERO-STOCK-1',
      name: 'Producto Agotado',
      sale_price: 1000,
      stock: 0
    })
    expect(pZeroStock.stock).toBe(0)

    // Soft delete de producto con stock 0
    const deleted = productService.softDeleteProduct(pZeroStock.code!)
    expect(deleted).toBe(true)

    const foundAfter = productService.getProductByCode('ZERO-STOCK-1')
    expect(foundAfter).toBeNull() // No se encuentra en catálogo activo
  })
})
