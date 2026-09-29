import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SupplierService } from '../main/services/supplierService'
import { ProductService } from '../main/services/productService'
import { SettingsService } from '../main/services/settingsService'

describe('Proveedores y Categorías: Relación N:M y Visualización', () => {
  let db: Database.Database
  let supplierService: SupplierService
  let productService: ProductService
  let settingsService: SettingsService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    supplierService = new SupplierService(db)
    productService = new ProductService(db)
    settingsService = new SettingsService(db)
  })

  describe('CRUD de Proveedores (SupplierService)', () => {
    it('crea proveedores correctamente y normaliza search_name', () => {
      const sup1 = supplierService.saveSupplier('Revesderecho')
      const sup2 = supplierService.saveSupplier('Ukryl S.A.')

      expect(sup1.id).toBeDefined()
      expect(sup1.name).toBe('Revesderecho')
      expect(sup2.id).toBeDefined()
      expect(sup2.name).toBe('Ukryl S.A.')

      const list = supplierService.getAllSuppliers()
      expect(list).toHaveLength(2)
      expect(list.map((s) => s.name)).toEqual(['Revesderecho', 'Ukryl S.A.'])
    })

    it('actualiza el nombre de un proveedor existente', () => {
      const sup = supplierService.saveSupplier('Revesderecho')
      const updated = supplierService.saveSupplier('Revesderecho Oficial', sup.id)

      expect(updated.id).toBe(sup.id)
      expect(updated.name).toBe('Revesderecho Oficial')

      const found = supplierService.getSupplierById(sup.id)
      expect(found?.name).toBe('Revesderecho Oficial')
    })

    it('elimina un proveedor con soft delete', () => {
      const sup = supplierService.saveSupplier('Proveedor Temporal')
      const deleted = supplierService.deleteSupplier(sup.id)
      expect(deleted).toBe(true)

      const activeList = supplierService.getAllSuppliers(false)
      expect(activeList.find((s) => s.id === sup.id)).toBeUndefined()

      const allList = supplierService.getAllSuppliers(true)
      expect(allList.find((s) => s.id === sup.id)?.active).toBe(0)
    })
  })

  describe('Asociación N:M de Productos con Proveedores', () => {
    it('asocia múltiples proveedores a un producto simple', () => {
      const s1 = supplierService.saveSupplier('Revesderecho')
      const s2 = supplierService.saveSupplier('Ukryl')

      const prod = productService.upsertProduct({
        code: 'LANA001',
        name: 'Lana Natural 100g',
        sale_price: 3990,
        cost_price: 1800,
        stock: 20,
        supplier_ids: [s1.id, s2.id]
      })

      const fetched = productService.getProductByCode('LANA001')
      expect(fetched).not.toBeNull()
      expect(fetched?.supplier_ids).toHaveLength(2)
      expect(fetched?.supplier_ids).toContain(s1.id)
      expect(fetched?.supplier_ids).toContain(s2.id)
      expect(fetched?.suppliers?.map((s) => s.name)).toContain('Revesderecho')
      expect(fetched?.suppliers?.map((s) => s.name)).toContain('Ukryl')
    })

    it('actualiza los proveedores al editar un producto', () => {
      const s1 = supplierService.saveSupplier('Proveedor A')
      const s2 = supplierService.saveSupplier('Proveedor B')
      const s3 = supplierService.saveSupplier('Proveedor C')

      const prod = productService.upsertProduct({
        code: 'PROD01',
        name: 'Producto Inicial',
        sale_price: 2000,
        supplier_ids: [s1.id, s2.id]
      })

      // Cambiamos a s2 y s3 (quitamos s1, agregamos s3)
      productService.upsertProduct({
        id: prod.id,
        code: 'PROD01',
        name: 'Producto Actualizado',
        sale_price: 2000,
        supplier_ids: [s2.id, s3.id]
      })

      const fetched = productService.getProductById(prod.id)
      expect(fetched?.supplier_ids).toHaveLength(2)
      expect(fetched?.supplier_ids).not.toContain(s1.id)
      expect(fetched?.supplier_ids).toContain(s2.id)
      expect(fetched?.supplier_ids).toContain(s3.id)
    })
  })

  describe('Búsqueda, Filtro por Proveedor y Sintaxis de Columna "Categoría"', () => {
    it('genera la sintaxis "Categoría - Proveedor1 / Proveedor2" en category_display', () => {
      const catLanas = productService.saveCategory('Lanas')
      const s1 = supplierService.saveSupplier('Revesderecho')
      const s2 = supplierService.saveSupplier('Ukryl')

      // Producto 1: Categoría + 2 Proveedores
      productService.upsertProduct({
        code: 'LANA-DUAL',
        name: 'Lana Mixta',
        category_id: catLanas.id,
        sale_price: 4500,
        supplier_ids: [s1.id, s2.id]
      })

      // Producto 2: Categoría + 1 Proveedor
      productService.upsertProduct({
        code: 'LANA-SOLO',
        name: 'Lana Simple',
        category_id: catLanas.id,
        sale_price: 3500,
        supplier_ids: [s1.id]
      })

      // Producto 3: Solo Categoría (sin proveedor)
      productService.upsertProduct({
        code: 'LANA-NONE',
        name: 'Lana Genérica',
        category_id: catLanas.id,
        sale_price: 2500,
        supplier_ids: []
      })

      // Producto 4: Sin Categoría pero con Proveedor
      productService.upsertProduct({
        code: 'NOCAT-PROV',
        name: 'Aguja Suelta',
        sale_price: 1500,
        supplier_ids: [s2.id]
      })

      const results = productService.searchProducts({ onlySellable: true })

      const itemDual = results.find((r) => r.code === 'LANA-DUAL')
      expect(itemDual?.category_display).toBe('Lanas - Revesderecho / Ukryl')

      const itemSolo = results.find((r) => r.code === 'LANA-SOLO')
      expect(itemSolo?.category_display).toBe('Lanas - Revesderecho')

      const itemNone = results.find((r) => r.code === 'LANA-NONE')
      expect(itemNone?.category_display).toBe('Lanas')

      const itemNoCat = results.find((r) => r.code === 'NOCAT-PROV')
      expect(itemNoCat?.category_display).toBe('Ukryl')
    })

    it('filtra productos por supplierId correctamente', () => {
      const cat = productService.saveCategory('Tejido')
      const sReves = supplierService.saveSupplier('Revesderecho')
      const sUkryl = supplierService.saveSupplier('Ukryl')

      productService.upsertProduct({
        code: 'P-REV',
        name: 'Ovillo Reves',
        category_id: cat.id,
        sale_price: 3000,
        supplier_ids: [sReves.id]
      })

      productService.upsertProduct({
        code: 'P-UKR',
        name: 'Ovillo Ukryl',
        category_id: cat.id,
        sale_price: 3000,
        supplier_ids: [sUkryl.id]
      })

      productService.upsertProduct({
        code: 'P-BOTH',
        name: 'Ovillo Común',
        category_id: cat.id,
        sale_price: 3000,
        supplier_ids: [sReves.id, sUkryl.id]
      })

      // Filtrar por Revesderecho: debe traer P-REV y P-BOTH
      const filteredReves = productService.searchProducts({ supplierId: sReves.id })
      const codesReves = filteredReves.map((r) => r.code)
      expect(codesReves).toContain('P-REV')
      expect(codesReves).toContain('P-BOTH')
      expect(codesReves).not.toContain('P-UKR')

      // Filtrar por Ukryl: debe traer P-UKR y P-BOTH
      const filteredUkryl = productService.searchProducts({ supplierId: sUkryl.id })
      const codesUkryl = filteredUkryl.map((r) => r.code)
      expect(codesUkryl).toContain('P-UKR')
      expect(codesUkryl).toContain('P-BOTH')
      expect(codesUkryl).not.toContain('P-REV')
    })

    it('encuentra variaciones cuando el proveedor está asignado al padre variable', () => {
      const s = supplierService.saveSupplier('Proveedor Lana')
      const cat = productService.saveCategory('Hilados')

      const variableResult = productService.saveVariableProduct(
        {
          name: 'Lana Chenille',
          category_id: cat.id,
          attribute_name: 'Color',
          supplier_ids: [s.id]
        },
        [
          { code: 'CHEN-01', name: 'Lana Chenille Rojo', attribute_value: 'Rojo', sale_price: 2990 },
          { code: 'CHEN-02', name: 'Lana Chenille Azul', attribute_value: 'Azul', sale_price: 2990 }
        ]
      )

      // Búsqueda de vendibles con filtro de proveedor s.id
      const results = productService.searchProducts({ supplierId: s.id, onlySellable: true })
      expect(results).toHaveLength(2)
      expect(results.map((r) => r.code)).toEqual(expect.arrayContaining(['CHEN-01', 'CHEN-02']))
    })
  })

  describe('Reorganización en Lote (bulkUpdateCategory con proveedores)', () => {
    it('actualiza categoría y proveedores en lote a múltiples productos', () => {
      const cat1 = productService.saveCategory('Cat 1')
      const cat2 = productService.saveCategory('Cat 2')
      const sup = supplierService.saveSupplier('Proveedor Mayorista')

      const p1 = productService.upsertProduct({ code: 'B1', name: 'Prod 1', category_id: cat1.id, sale_price: 1000 })
      const p2 = productService.upsertProduct({ code: 'B2', name: 'Prod 2', category_id: cat1.id, sale_price: 2000 })

      productService.bulkUpdateCategory([p1.id, p2.id], cat2.id, [sup.id])

      const r1 = productService.getProductById(p1.id)
      const r2 = productService.getProductById(p2.id)

      expect(r1?.category_id).toBe(cat2.id)
      expect(r1?.supplier_ids).toContain(sup.id)
      expect(r2?.category_id).toBe(cat2.id)
      expect(r2?.supplier_ids).toContain(sup.id)
    })

    it('asocia proveedores al agrupar productos como variable', () => {
      const cat = productService.saveCategory('Lanas')
      const sup = supplierService.saveSupplier('Revesderecho')

      const p1 = productService.upsertProduct({ code: 'L1', name: 'Lana Natural Rojo', sale_price: 3500 })
      const p2 = productService.upsertProduct({ code: 'L2', name: 'Lana Natural Azul', sale_price: 3500 })

      const groupRes = productService.groupProductsAsVariable({
        parentName: 'Lana Natural',
        categoryId: cat.id,
        supplierIds: [sup.id],
        attributeName: 'Color',
        items: [
          { productId: p1.id, attributeValue: 'Rojo' },
          { productId: p2.id, attributeValue: 'Azul' }
        ]
      })

      const parentProd = productService.getProductById(groupRes.parentId)
      expect(parentProd?.supplier_ids).toContain(sup.id)

      const variations = productService.getVariations(groupRes.parentId)
      expect(variations).toHaveLength(2)
      expect(variations[0].supplier_ids).toContain(sup.id)
      expect(variations[1].supplier_ids).toContain(sup.id)

      // Verificamos que la búsqueda por proveedor encuentre las variaciones
      const found = productService.searchProducts({ supplierId: sup.id, onlySellable: true })
      expect(found.map((f) => f.code)).toEqual(expect.arrayContaining(['L1', 'L2']))
    })
  })

  describe('Limpieza de Base de Datos (resetDatabase)', () => {
    it('elimina proveedores y asociaciones al vaciar la base de datos', () => {
      const sup = supplierService.saveSupplier('Proveedor Temp')
      const prod = productService.upsertProduct({ code: 'T1', name: 'Temp', sale_price: 500, supplier_ids: [sup.id] })

      settingsService.resetDatabase()

      const supsAfter = supplierService.getAllSuppliers()
      expect(supsAfter).toHaveLength(0)

      const prodsAfter = productService.getActiveProducts()
      expect(prodsAfter).toHaveLength(0)
    })
  })
})
