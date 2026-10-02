import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { ProductService } from '../main/services/productService'
import { InventoryService } from '../main/services/inventoryService'

describe('Fase 6: Control de Inventario, Ajustes, Alertas y Kardex', () => {
  let db: Database.Database
  let productService: ProductService
  let inventoryService: InventoryService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    productService = new ProductService(db)
    inventoryService = new InventoryService(db)

    // Crear categorías
    const cat = productService.saveCategory('Hilos')

    // Producto Simple inicial
    productService.upsertProduct({
      code: 'PROD_S1',
      name: 'Hilo de Coser Blanco',
      product_type: 'simple',
      sale_price: 1500,
      category_id: cat.id,
      stock: 20,
      min_stock: 5
    })

    // Producto Simple con stock bajo
    productService.upsertProduct({
      code: 'PROD_LOW',
      name: 'Crochet 3.0mm',
      product_type: 'simple',
      sale_price: 2500,
      category_id: cat.id,
      stock: 2,
      min_stock: 5
    })

    // Producto Variable con variaciones
    productService.saveVariableProduct(
      {
        name: 'Algodón Rústico',
        category_id: cat.id,
        attribute_name: 'Color'
      },
      [
        {
          code: 'VAR_AZUL',
          name: 'Algodón Rústico Azul',
          attribute_value: 'Azul',
          sale_price: 3500,
          stock: 3,
          min_stock: 5
        },
        {
          code: 'VAR_ROJO',
          name: 'Algodón Rústico Rojo',
          attribute_value: 'Rojo',
          sale_price: 3500,
          stock: 12,
          min_stock: 5
        }
      ]
    )
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Ajustes de Existencia (adjustStock)', () => {
    it('ajusta stock sumando delta positivo (+5) y registra movimiento tipo "ajuste"', () => {
      const res = inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: 5,
        reason: 'Recepción de mercadería extra'
      })

      expect(res.product.stock).toBe(25)
      expect(res.movement.delta).toBe(5)
      expect(res.movement.type).toBe('ajuste')
      expect(res.movement.reason).toBe('Recepción de mercadería extra')

      // Verificar en BD que el producto se actualizó
      const prodInDb = productService.getProductByCode('PROD_S1')
      expect(prodInDb?.stock).toBe(25)
    })

    it('ajusta stock restando delta negativo (-6) por merma', () => {
      const res = inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: -6,
        reason: 'Merma por producto dañado'
      })

      expect(res.product.stock).toBe(14)
      expect(res.movement.delta).toBe(-6)
      expect(res.movement.type).toBe('ajuste')

      const prodInDb = productService.getProductByCode('PROD_S1')
      expect(prodInDb?.stock).toBe(14)
    })

    it('ajusta stock mediante nueva existencia directa (reemplazo: 20 -> 35 => delta = +15)', () => {
      const res = inventoryService.adjustStock({
        product_code: 'PROD_S1',
        new_stock: 35,
        reason: 'Conteo físico de inventario'
      })

      expect(res.product.stock).toBe(35)
      expect(res.movement.delta).toBe(15)
      expect(res.movement.type).toBe('ajuste')
      expect(res.movement.reason).toBe('Conteo físico de inventario')
    })

    it('ajusta stock mediante nueva existencia directa hacia abajo (reemplazo: 20 -> 12 => delta = -8)', () => {
      const res = inventoryService.adjustStock({
        product_code: 'PROD_S1',
        new_stock: 12,
        reason: 'Ajuste tras inventario físico'
      })

      expect(res.product.stock).toBe(12)
      expect(res.movement.delta).toBe(-8)
      expect(res.movement.type).toBe('ajuste')
    })

    it('rechaza ajuste si el stock resultante fuera negativo (< 0)', () => {
      expect(() => {
        inventoryService.adjustStock({
          product_code: 'PROD_S1',
          delta: -30, // 20 - 30 = -10
          reason: 'Error de tipeo'
        })
      }).toThrow(/El inventario no puede quedar en negativo/)
    })

    it('rechaza ajuste si el delta resultante es 0 (sin cambio)', () => {
      expect(() => {
        inventoryService.adjustStock({
          product_code: 'PROD_S1',
          new_stock: 20, // Ya tiene 20
          reason: 'Sin cambios'
        })
      }).toThrow(/El ajuste no genera ningún cambio/)
    })

    it('rechaza ajuste sin motivo obligatorio', () => {
      expect(() => {
        inventoryService.adjustStock({
          product_code: 'PROD_S1',
          delta: 2,
          reason: '   '
        })
      }).toThrow(/Debe especificar un motivo/)
    })
  })

  describe('Alertas de Stock Bajo (getLowStockProducts)', () => {
    it('obtiene los productos con stock menor o igual al mínimo (stock <= min_stock)', () => {
      const lowStock = inventoryService.getLowStockProducts()

      // PROD_LOW (stock 2, min 5) y VAR_AZUL (stock 3, min 5) deben estar en la lista
      const codes = lowStock.map((p) => p.code)
      expect(codes).toContain('PROD_LOW')
      expect(codes).toContain('VAR_AZUL')

      // PROD_S1 (stock 20, min 5) y VAR_ROJO (stock 12, min 5) NO deben estar
      expect(codes).not.toContain('PROD_S1')
      expect(codes).not.toContain('VAR_ROJO')

      // El producto padre variable NO debe estar incluido
      expect(lowStock.some((p) => p.product_type === 'variable')).toBe(false)

      // Debe venir ordenado de menor stock a mayor
      expect(lowStock[0].stock).toBeLessThanOrEqual(lowStock[1].stock)
    })
  })

  describe('Reporte de Movimientos del Día (getMovementsByDate)', () => {
    it('obtiene los movimientos realizados filtrados por fecha', () => {
      inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: 10,
        reason: 'Ingreso lote 1'
      })

      inventoryService.adjustStock({
        product_code: 'VAR_AZUL',
        delta: -1,
        reason: 'Muestra comercial'
      })

      const today = new Date().toISOString().slice(0, 10)
      const movements = inventoryService.getMovementsByDate(today)

      expect(movements.length).toBeGreaterThanOrEqual(2)
      expect(movements[0].product_name).toBeDefined()
      const s1Movement = movements.find((m) => m.product_code === 'PROD_S1' && m.delta === 10)
      expect(s1Movement).toBeDefined()
      expect(s1Movement?.stock_before).toBe(20)
      expect(s1Movement?.stock_after).toBe(30)

      const varMovement = movements.find((m) => m.product_code === 'VAR_AZUL' && m.delta === -1)
      expect(varMovement).toBeDefined()
      expect(varMovement?.stock_before).toBe(3)
      expect(varMovement?.stock_after).toBe(2)
    })

    it('permite filtrar movimientos por tipo (ej: "ajuste")', () => {
      inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: 5,
        reason: 'Ajuste de prueba'
      })

      const today = new Date().toISOString().slice(0, 10)
      const ajustes = inventoryService.getMovementsByDate(today, 'ajuste')
      expect(ajustes.every((m) => m.type === 'ajuste')).toBe(true)
    })
  })

  describe('Kardex de Producto (getProductKardex)', () => {
    it('obtiene el historial cronológico completo de movimientos de un producto específico', () => {
      inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: 5,
        reason: 'Primer ajuste'
      })

      inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: -3,
        reason: 'Segundo ajuste'
      })

      inventoryService.adjustStock({
        product_code: 'PROD_S1',
        delta: 10,
        reason: 'Tercer ajuste'
      })

      const kardex = inventoryService.getProductKardex('PROD_S1')
      expect(kardex).toHaveLength(3)

      // Debe venir ordenado descendentemente por fecha/id (más reciente primero)
      expect(kardex[0].reason).toBe('Tercer ajuste')
      expect(kardex[0].stock_before).toBe(22)
      expect(kardex[0].stock_after).toBe(32)

      expect(kardex[1].reason).toBe('Segundo ajuste')
      expect(kardex[1].stock_before).toBe(25)
      expect(kardex[1].stock_after).toBe(22)

      expect(kardex[2].reason).toBe('Primer ajuste')
      expect(kardex[2].stock_before).toBe(20)
      expect(kardex[2].stock_after).toBe(25)
    })
  })
})
