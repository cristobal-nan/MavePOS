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

    it('ajusta stock y consulta kardex tolerando ceros a la izquierda escaneados (ej: 03.19234 vs 3.19234)', () => {
      productService.upsertProduct({
        code: '3.19234',
        name: 'Madeja Lana 3.19234',
        sale_price: 3500,
        stock: 10,
        min_stock: 2
      })

      const res = inventoryService.adjustStock({
        product_code: '03.19234',
        delta: 5,
        reason: 'Ajuste con escáner de código con ceros'
      })

      expect(res.product.code).toBe('3.19234')
      expect(res.product.stock).toBe(15)
      expect(res.movement.product_code).toBe('3.19234')

      const kardex = inventoryService.getProductKardex('03.19234')
      expect(kardex.length).toBeGreaterThanOrEqual(1)
      expect(kardex[0].product_code).toBe('3.19234')
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
      expect(kardex).toHaveLength(4)

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

      expect(kardex[3].reason).toBe('Stock inicial (creación de producto)')
      expect(kardex[3].type).toBe('inicial')
      expect(kardex[3].delta).toBe(20)
      expect(kardex[3].stock_before).toBe(0)
      expect(kardex[3].stock_after).toBe(20)
    })
  })

  describe('Stock Inicial al Crear Productos y Variaciones', () => {
    it('registra movimiento tipo "inicial" al crear producto simple con stock > 0', () => {
      productService.upsertProduct({
        code: 'PROD_NEW_INIT',
        name: 'Aguja de Tejer Circular 4.0mm',
        product_type: 'simple',
        sale_price: 3200,
        stock: 15,
        min_stock: 3
      })

      const kardex = inventoryService.getProductKardex('PROD_NEW_INIT')
      expect(kardex).toHaveLength(1)
      expect(kardex[0].type).toBe('inicial')
      expect(kardex[0].delta).toBe(15)
      expect(kardex[0].reason).toBe('Stock inicial (creación de producto)')
      expect(kardex[0].stock_before).toBe(0)
      expect(kardex[0].stock_after).toBe(15)

      // Aparece también en movimientos del día
      const today = new Date().toISOString().slice(0, 10)
      const movements = inventoryService.getMovementsByDate(today, 'inicial')
      const found = movements.find((m) => m.product_code === 'PROD_NEW_INIT')
      expect(found).toBeDefined()
      expect(found?.delta).toBe(15)
      expect(found?.type).toBe('inicial')
      expect(found?.reason).toBe('Stock inicial (creación de producto)')
    })

    it('no genera movimiento de inventario si el producto se crea con stock 0', () => {
      productService.upsertProduct({
        code: 'PROD_ZERO_STOCK',
        name: 'Tijera Zigzag',
        product_type: 'simple',
        sale_price: 4500,
        stock: 0,
        min_stock: 2
      })

      const kardex = inventoryService.getProductKardex('PROD_ZERO_STOCK')
      expect(kardex).toHaveLength(0)
    })

    it('registra movimientos iniciales para cada variación nueva con stock > 0 en un producto variable', () => {
      productService.saveVariableProduct(
        {
          name: 'Trapillo Premium',
          attribute_name: 'Color'
        },
        [
          {
            code: 'TRAP_AMARILLO',
            name: 'Trapillo Premium Amarillo',
            attribute_value: 'Amarillo',
            sale_price: 4990,
            stock: 8,
            min_stock: 2
          },
          {
            code: 'TRAP_NEGRO',
            name: 'Trapillo Premium Negro',
            attribute_value: 'Negro',
            sale_price: 4990,
            stock: 0, // Sin stock inicial
            min_stock: 2
          }
        ]
      )

      // La variación con stock 8 debe tener movimiento inicial
      const kardexAmarillo = inventoryService.getProductKardex('TRAP_AMARILLO')
      expect(kardexAmarillo).toHaveLength(1)
      expect(kardexAmarillo[0].type).toBe('inicial')
      expect(kardexAmarillo[0].delta).toBe(8)
      expect(kardexAmarillo[0].reason).toBe('Stock inicial (creación de producto)')

      // La variación con stock 0 no debe tener movimiento
      const kardexNegro = inventoryService.getProductKardex('TRAP_NEGRO')
      expect(kardexNegro).toHaveLength(0)
    })
  })
})
