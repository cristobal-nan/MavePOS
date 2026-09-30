import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { ProductService } from '../main/services/productService'

describe('Reorganización Post-Importación de Catálogo (Operaciones en Lote)', () => {
  let db: Database.Database
  let productService: ProductService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    productService = new ProductService(db)

    // Crear categorías base
    db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (1, 'Lanas e Hilos', NULL)").run()
    db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (2, 'Algodón', 1)").run()
    db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (3, 'Lana Merino', 1)").run()
    db.prepare("INSERT INTO categories (id, name, parent_id) VALUES (4, 'Costura', NULL)").run()
  })

  describe('bulkUpdateCategory (Reasignar categoría/subcategoría en lote)', () => {
    it('actualiza la categoría de múltiples productos a la vez', () => {
      // Creamos 3 productos en depto 1
      const p1 = productService.upsertProduct({
        code: 'PROD-1',
        name: 'Hilo Algodón 1',
        sale_price: 1500,
        category_id: 1
      })
      const p2 = productService.upsertProduct({
        code: 'PROD-2',
        name: 'Hilo Algodón 2',
        sale_price: 1500,
        category_id: 1
      })
      const p3 = productService.upsertProduct({
        code: 'PROD-3',
        name: 'Lana Merino 1',
        sale_price: 3500,
        category_id: 1
      })

      // Movemos p1 y p2 a la subcategoría 2 (Algodón)
      const res = productService.bulkUpdateCategory([p1.id!, p2.id!], 2)
      expect(res.updatedCount).toBe(2)

      const updatedP1 = productService.getProductByCode('PROD-1')
      const updatedP2 = productService.getProductByCode('PROD-2')
      const untouchedP3 = productService.getProductByCode('PROD-3')

      expect(updatedP1?.category_id).toBe(2)
      expect(updatedP2?.category_id).toBe(2)
      expect(untouchedP3?.category_id).toBe(1)
    })

    it('propaga la categoría a las variaciones si se actualiza un producto variable padre', () => {
      const { parent } = productService.saveVariableProduct(
        {
          name: 'Lana Rústica',
          category_id: 1,
          attribute_name: 'Color'
        },
        [
          { code: 'VAR-1', name: 'Lana Rústica Azul', sale_price: 2500, attribute_value: 'Azul' },
          { code: 'VAR-2', name: 'Lana Rústica Rojo', sale_price: 2500, attribute_value: 'Rojo' }
        ]
      )

      // Movemos el padre a la subcategoría 3 (Lana Merino)
      productService.bulkUpdateCategory([parent.id!], 3)

      const updatedParent = productService.getProductById(parent.id!)
      const variations = productService.getVariations(parent.id!)

      expect(updatedParent?.category_id).toBe(3)
      expect(variations).toHaveLength(2)
      expect(variations[0].category_id).toBe(3)
      expect(variations[1].category_id).toBe(3)
    })
  })

  describe('groupProductsAsVariable (Agrupar simples en producto variable)', () => {
    it('crea el padre variable y convierte productos simples en variaciones conservando código y stock', () => {
      // Creamos 3 productos simples que vinieron del Excel plano
      const s1 = productService.upsertProduct({
        code: '7801111',
        name: 'Algodón Rústico Azul',
        sale_price: 3200,
        cost_price: 1800,
        stock: 40,
        min_stock: 10,
        category_id: 1
      })

      const s2 = productService.upsertProduct({
        code: '7802222',
        name: 'Algodón Rústico Rojo',
        sale_price: 3200,
        cost_price: 1800,
        stock: 25,
        min_stock: 5,
        category_id: 1
      })

      // Agrupamos bajo el producto variable "Algodón Rústico"
      const groupRes = productService.groupProductsAsVariable({
        parentName: 'Algodón Rústico',
        categoryId: 2,
        attributeName: 'Color',
        items: [
          { productId: s1.id!, attributeValue: 'Azul', name: 'Algodón Rústico Azul' },
          { productId: s2.id!, attributeValue: 'Rojo', name: 'Algodón Rústico Rojo' }
        ]
      })

      expect(groupRes.count).toBe(2)
      expect(groupRes.parentId).toBeGreaterThan(0)

      // Verificar producto padre
      const parent = productService.getProductById(groupRes.parentId)
      expect(parent).not.toBeNull()
      expect(parent?.name).toBe('Algodón Rústico')
      expect(parent?.product_type).toBe('variable')
      expect(parent?.attribute_name).toBe('Color')
      expect(parent?.category_id).toBe(2)
      expect(parent?.code).toBeNull()

      // Verificar variaciones convertidas
      const v1 = productService.getProductByCode('7801111')
      const v2 = productService.getProductByCode('7802222')

      expect(v1?.product_type).toBe('variation')
      expect(v1?.parent_id).toBe(parent?.id)
      expect(v1?.attribute_name).toBe('Color')
      expect(v1?.attribute_value).toBe('Azul')
      expect(v1?.stock).toBe(40) // Stock preservado intacto
      expect(v1?.sale_price).toBe(3200) // Precio preservado
      expect(v1?.cost_price).toBe(1800) // Costo preservado

      expect(v2?.product_type).toBe('variation')
      expect(v2?.parent_id).toBe(parent?.id)
      expect(v2?.attribute_name).toBe('Color')
      expect(v2?.attribute_value).toBe('Rojo')
      expect(v2?.stock).toBe(25) // Stock preservado intacto

      // Verificar que el listado de variaciones del padre retorne ambos
      const children = productService.getVariations(parent!.id!)
      expect(children).toHaveLength(2)
      expect(children.map((c) => c.code)).toContain('7801111')
      expect(children.map((c) => c.code)).toContain('7802222')
    })

    it('valida que el nombre del padre y del atributo sean obligatorios', () => {
      const p = productService.upsertProduct({
        code: 'TEST-1',
        name: 'Producto Test',
        sale_price: 1000
      })

      expect(() =>
        productService.groupProductsAsVariable({
          parentName: '',
          categoryId: null,
          attributeName: 'Color',
          items: [{ productId: p.id!, attributeValue: 'Azul' }]
        })
      ).toThrow('nombre del producto variable')

      expect(() =>
        productService.groupProductsAsVariable({
          parentName: 'Producto Padre',
          categoryId: null,
          attributeName: '',
          items: [{ productId: p.id!, attributeValue: 'Azul' }]
        })
      ).toThrow('nombre del atributo')
    })
  })

  describe('bulkSoftDelete (Eliminación lógica en lote)', () => {
    it('desactiva múltiples productos y sus variaciones en cascada', () => {
      const p1 = productService.upsertProduct({
        code: 'DEL-1',
        name: 'Producto para eliminar 1',
        sale_price: 1000
      })
      const p2 = productService.upsertProduct({
        code: 'DEL-2',
        name: 'Producto para eliminar 2',
        sale_price: 2000
      })

      const res = productService.bulkSoftDelete([p1.id!, p2.id!])
      expect(res.deletedCount).toBe(2)

      // Ya no deben figurar como activos
      expect(productService.getProductByCode('DEL-1', false)).toBeNull()
      expect(productService.getProductByCode('DEL-2', false)).toBeNull()

      // Pero sí existen con includeInactive = true (auditoría/kardex)
      expect(productService.getProductByCode('DEL-1', true)?.active).toBe(0)
      expect(productService.getProductByCode('DEL-2', true)?.active).toBe(0)
    })
  })

  describe('Edición de Código de Producto y Preservación de Kardex', () => {
    it('al modificar el código de un producto migra los movimientos de kardex y preserva integridad referencial', () => {
      const prod = productService.upsertProduct({
        code: 'ORIGINAL-CODE-01',
        name: 'Madeja Lana Celeste',
        sale_price: 4500,
        stock: 30
      })

      // Insertar movimiento de kardex previo
      db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, created_at)
        VALUES (?, ?, 'ajuste', 'Ajuste inicial de inventario', datetime('now'))
      `).run('ORIGINAL-CODE-01', 30)

      // Actualizar el código del producto
      const updated = productService.upsertProduct({
        id: prod.id,
        code: 'UPDATED-CODE-02',
        name: 'Madeja Lana Celeste Modificada',
        sale_price: 4800,
        stock: 30
      })

      expect(updated.code).toBe('UPDATED-CODE-02')

      // Verificar que el kardex migró al nuevo código
      const movements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ?')
        .all('UPDATED-CODE-02') as any[]

      expect(movements).toHaveLength(1)
      expect(movements[0].delta).toBe(30)

      // Verificar que el código antiguo ya no tiene movimientos
      const oldMovements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ?')
        .all('ORIGINAL-CODE-01')

      expect(oldMovements).toHaveLength(0)
    })
  })

  describe('Sincronización masiva de campos desde el Producto Padre a sus Variaciones', () => {
    it('sincroniza precio de venta, precio de costo y stock mínimo a todas las variaciones al activar sync_variations', () => {
      const { parent } = productService.saveVariableProduct(
        {
          name: 'Algodón Rústico',
          category_id: 1,
          attribute_name: 'Color',
          sale_price: 3000,
          cost_price: 1500,
          min_stock: 5
        },
        [
          { code: 'ALG-AZUL', name: 'Algodón Rústico Azul', sale_price: 3000, cost_price: 1500, min_stock: 5, attribute_value: 'Azul' },
          { code: 'ALG-ROJO', name: 'Algodón Rústico Rojo', sale_price: 3000, cost_price: 1500, min_stock: 5, attribute_value: 'Rojo' }
        ]
      )

      // Actualizamos el padre con sync_variations: true
      productService.upsertProduct({
        id: parent.id,
        name: 'Algodón Rústico Premium',
        product_type: 'variable',
        category_id: 2,
        attribute_name: 'Color',
        sale_price: 3800,
        cost_price: 2000,
        min_stock: 10,
        sync_variations: true
      })

      const variations = productService.getVariations(parent.id!)
      expect(variations).toHaveLength(2)

      for (const v of variations) {
        expect(v.name).toContain('Algodón Rústico Premium')
        expect(v.category_id).toBe(2)
        expect(v.sale_price).toBe(3800)
        expect(v.cost_price).toBe(2000)
        expect(v.min_stock).toBe(10)
      }
    })

    it('conserva los precios individuales de las variaciones si sync_variations es false', () => {
      const { parent } = productService.saveVariableProduct(
        {
          name: 'Algodón Rústico',
          category_id: 1,
          attribute_name: 'Color',
          sale_price: 3000
        },
        [
          { code: 'ALG-1', name: 'Algodón Rústico Azul', sale_price: 3000, attribute_value: 'Azul' },
          { code: 'ALG-2', name: 'Algodón Rústico Dorado', sale_price: 3500, attribute_value: 'Dorado' }
        ]
      )

      // Actualizamos solo nombre y categoría del padre sin sync_variations
      productService.upsertProduct({
        id: parent.id,
        name: 'Algodón Rústico Plus',
        product_type: 'variable',
        category_id: 2,
        attribute_name: 'Color',
        sale_price: 4000,
        sync_variations: false
      })

      const variations = productService.getVariations(parent.id!)
      expect(variations[0].name).toBe('Algodón Rústico Plus Azul')
      expect(variations[0].sale_price).toBe(3000) // Se mantuvo intacto
      expect(variations[1].name).toBe('Algodón Rústico Plus Dorado')
      expect(variations[1].sale_price).toBe(3500) // Se mantuvo intacto
    })
  })
})
