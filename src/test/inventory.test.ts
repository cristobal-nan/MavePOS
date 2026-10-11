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

  describe('Edición de Motivos y Cancelación de Ajustes', () => {
    it('obtiene los últimos N ajustes con su indicador de último movimiento', () => {
      productService.upsertProduct({
        code: 'PROD_ADJ_TEST',
        name: 'Hilo Mercerizado 100g',
        product_type: 'simple',
        sale_price: 2500,
        stock: 10,
        min_stock: 2
      })

      inventoryService.adjustStock({
        product_code: 'PROD_ADJ_TEST',
        delta: 5,
        type: 'ajuste',
        reason: 'Recuento físico inicial erróneo'
      })

      const recent = inventoryService.getRecentAdjustments(5)
      expect(recent.length).toBeGreaterThan(0)
      const target = recent.find((r) => r.product_code === 'PROD_ADJ_TEST')
      expect(target).toBeDefined()
      expect(target?.delta).toBe(5)
      expect(target?.reason).toBe('Recuento físico inicial erróneo')
      expect(target?.is_last_product_movement).toBe(true)
    })

    it('permite actualizar el motivo de un ajuste y se refleja en kardex y reporte', () => {
      productService.upsertProduct({
        code: 'PROD_REASON_TEST',
        name: 'Aguja Crochet 3.5mm',
        product_type: 'simple',
        sale_price: 1800,
        stock: 20,
        min_stock: 5
      })

      const adj = inventoryService.adjustStock({
        product_code: 'PROD_REASON_TEST',
        delta: -2,
        type: 'ajuste',
        reason: 'Motivo con error tipográfico'
      })

      const updated = inventoryService.updateMovementReason(adj.movement.id, 'Merma por embalaje roto')
      expect(updated.id).toBe(adj.movement.id)
      expect(updated.reason).toBe('Merma por embalaje roto')

      const kardex = inventoryService.getProductKardex('PROD_REASON_TEST')
      expect(kardex[0].reason).toBe('Merma por embalaje roto')
    })

    it('no permite editar el motivo de un movimiento que no sea de tipo ajuste manual', () => {
      productService.upsertProduct({
        code: 'PROD_NO_ADJ_REASON',
        name: 'Tijera Zigzag',
        product_type: 'simple',
        sale_price: 3500,
        stock: 10,
        min_stock: 2
      })

      // El producto creado tiene un movimiento de stock 'inicial'
      const kardex = inventoryService.getProductKardex('PROD_NO_ADJ_REASON')
      expect(kardex.length).toBe(1)
      expect(kardex[0].type).toBe('inicial')

      expect(() => {
        inventoryService.updateMovementReason(kardex[0].id, 'Intento de modificar motivo inicial')
      }).toThrow('Solo se pueden editar motivos de movimientos de tipo ajuste.')
    })

    it('no permite editar el motivo de un ajuste que tenga más de 7 días de antigüedad', () => {
      productService.upsertProduct({
        code: 'PROD_OLD_REASON',
        name: 'Hilo Rústico Antiguo',
        product_type: 'simple',
        sale_price: 1000,
        stock: 10,
        min_stock: 2
      })

      const adj = inventoryService.adjustStock({
        product_code: 'PROD_OLD_REASON',
        delta: 2,
        type: 'ajuste',
        reason: 'Ajuste antiguo'
      })

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare('UPDATE inventory_movements SET created_at = ? WHERE id = ?').run(
        eightDaysAgo,
        adj.movement.id
      )

      expect(() => {
        inventoryService.updateMovementReason(adj.movement.id, 'Intento de modificar motivo viejo')
      }).toThrow('No se puede editar el motivo de un ajuste con más de 7 días de antigüedad.')

      const kardex = inventoryService.getProductKardex('PROD_OLD_REASON')
      const target = kardex.find((m) => m.id === adj.movement.id)
      expect(target).toBeDefined()
      expect(target?.can_edit_reason).toBe(false)
      expect(target?.cannot_edit_reason).toMatch(/7 días/i)
    })

    it('cancela un ajuste si es el único movimiento posterior y revierte el stock', () => {
      productService.upsertProduct({
        code: 'PROD_CANCEL_TEST',
        name: 'Cinta Métrica 1.5m',
        product_type: 'simple',
        sale_price: 1200,
        stock: 10,
        min_stock: 2
      })

      const adj = inventoryService.adjustStock({
        product_code: 'PROD_CANCEL_TEST',
        delta: 4,
        type: 'ajuste',
        reason: 'Ajuste que debe revertirse'
      })

      // El stock subió a 14
      let prod = productService.getProductByCode('PROD_CANCEL_TEST')
      expect(prod?.stock).toBe(14)

      const preview = inventoryService.getAdjustmentCancellationPreview(adj.movement.id)
      expect(preview.can_cancel).toBe(true)
      expect(preview.movements_to_revert).toHaveLength(1)
      expect(preview.current_stock).toBe(14)
      expect(preview.projected_stock).toBe(10)
      expect(preview.total_delta).toBe(4)

      const result = inventoryService.cancelAdjustment(adj.movement.id)
      expect(result.revertedMovement.id).toBe(adj.movement.id)
      expect(result.revertedMovements).toHaveLength(1)
      expect(result.revertedMovement.product_code).toBe('PROD_CANCEL_TEST')
      expect(result.newStock).toBe(10)

      // Verificamos que el stock en base de datos volvió a 10
      prod = productService.getProductByCode('PROD_CANCEL_TEST')
      expect(prod?.stock).toBe(10)

      // Verificamos que el movimiento fue eliminado del kardex
      const kardex = inventoryService.getProductKardex('PROD_CANCEL_TEST')
      const foundInKardex = kardex.find((m) => m.id === adj.movement.id)
      expect(foundInKardex).toBeUndefined()
    })

    it('cancela en cascada múltiples ajustes posteriores (hasta 5) y restaura el stock', () => {
      productService.upsertProduct({
        code: 'PROD_CASCADE_OK',
        name: 'Hilos Variados',
        product_type: 'simple',
        sale_price: 500,
        stock: 20,
        min_stock: 5
      })

      const adj1 = inventoryService.adjustStock({
        product_code: 'PROD_CASCADE_OK',
        delta: 5,
        type: 'ajuste',
        reason: 'Ajuste 1 (+5)'
      })
      const adj2 = inventoryService.adjustStock({
        product_code: 'PROD_CASCADE_OK',
        delta: -3,
        type: 'ajuste',
        reason: 'Ajuste 2 (-3)'
      })
      const adj3 = inventoryService.adjustStock({
        product_code: 'PROD_CASCADE_OK',
        delta: 8,
        type: 'ajuste',
        reason: 'Ajuste 3 (+8)'
      })

      // Stock actual: 20 + 5 - 3 + 8 = 30
      let prod = productService.getProductByCode('PROD_CASCADE_OK')
      expect(prod?.stock).toBe(30)

      // Vista previa de cancelar desde adj1
      const preview = inventoryService.getAdjustmentCancellationPreview(adj1.movement.id)
      expect(preview.can_cancel).toBe(true)
      expect(preview.movements_to_revert).toHaveLength(3)
      expect(preview.total_delta).toBe(10) // 5 - 3 + 8
      expect(preview.projected_stock).toBe(20)

      // Ejecutar cancelación en cascada
      const result = inventoryService.cancelAdjustment(adj1.movement.id)
      expect(result.newStock).toBe(20)
      expect(result.revertedMovements).toHaveLength(3)

      prod = productService.getProductByCode('PROD_CASCADE_OK')
      expect(prod?.stock).toBe(20)

      // Los 3 movimientos fueron eliminados
      const kardex = inventoryService.getProductKardex('PROD_CASCADE_OK')
      const ids = [adj1.movement.id, adj2.movement.id, adj3.movement.id]
      const remaining = kardex.filter((m) => ids.includes(m.id))
      expect(remaining).toHaveLength(0)
    })

    it('no permite cancelar si la cadena a revertir excede el límite máximo de 5 movimientos', () => {
      productService.upsertProduct({
        code: 'PROD_LIMIT_6',
        name: 'Cordón de Algodón',
        product_type: 'simple',
        sale_price: 900,
        stock: 10,
        min_stock: 2
      })

      // Crear 6 ajustes
      const adjustments: number[] = []
      for (let i = 1; i <= 6; i++) {
        const res = inventoryService.adjustStock({
          product_code: 'PROD_LIMIT_6',
          delta: 1,
          type: 'ajuste',
          reason: `Ajuste paso ${i}`
        })
        adjustments.push(res.movement.id)
      }

      // Intentar cancelar el primer ajuste (cadena de 6 movimientos)
      const preview = inventoryService.getAdjustmentCancellationPreview(adjustments[0])
      expect(preview.can_cancel).toBe(false)
      expect(preview.reason).toMatch(/límite máximo de 5 movimientos/i)

      expect(() => {
        inventoryService.cancelAdjustment(adjustments[0])
      }).toThrow(/límite máximo de 5 movimientos/i)

      // Pero el ajuste #2 tiene 5 movimientos (del 2 al 6): SÍ es cancelable
      const preview2 = inventoryService.getAdjustmentCancellationPreview(adjustments[1])
      expect(preview2.can_cancel).toBe(true)
      expect(preview2.movements_to_revert).toHaveLength(5)
    })

    it('no permite cancelar un ajuste si existe una venta o movimiento no manual posterior', () => {
      productService.upsertProduct({
        code: 'PROD_NON_ADJ_CHAIN',
        name: 'Lana Grossa',
        product_type: 'simple',
        sale_price: 1500,
        stock: 20,
        min_stock: 5
      })

      const adj = inventoryService.adjustStock({
        product_code: 'PROD_NON_ADJ_CHAIN',
        delta: 10,
        type: 'ajuste',
        reason: 'Ingreso inicial'
      })

      // Simular una venta posterior registrada en inventory_movements
      db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, created_at)
        VALUES (?, ?, 'venta', 'Venta #1', datetime('now'))
      `).run('PROD_NON_ADJ_CHAIN', -2)

      const preview = inventoryService.getAdjustmentCancellationPreview(adj.movement.id)
      expect(preview.can_cancel).toBe(false)
      expect(preview.reason).toMatch(/no son ajustes/i)

      expect(() => {
        inventoryService.cancelAdjustment(adj.movement.id)
      }).toThrow(/no son ajustes/i)
    })

    it('permite cancelar ajustes ocurridos después de una venta sin afectar la venta previa', () => {
      productService.upsertProduct({
        code: 'PROD_AFTER_SALE',
        name: 'Palillo Circular',
        product_type: 'simple',
        sale_price: 2500,
        stock: 30,
        min_stock: 5
      })

      // 1. Venta previa
      db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, created_at)
        VALUES (?, ?, 'venta', 'Venta #100', datetime('now', '-1 hour'))
      `).run('PROD_AFTER_SALE', -5)

      // 2. Dos ajustes manuales posteriores a la venta
      const adj1 = inventoryService.adjustStock({
        product_code: 'PROD_AFTER_SALE',
        delta: 3,
        type: 'ajuste',
        reason: 'Ajuste post-venta 1'
      })
      const adj2 = inventoryService.adjustStock({
        product_code: 'PROD_AFTER_SALE',
        delta: -1,
        type: 'ajuste',
        reason: 'Ajuste post-venta 2'
      })

      // Cancelar adj1 debe ser permitido porque desde adj1 solo hay ajustes
      const preview = inventoryService.getAdjustmentCancellationPreview(adj1.movement.id)
      expect(preview.can_cancel).toBe(true)
      expect(preview.movements_to_revert).toHaveLength(2)

      const res = inventoryService.cancelAdjustment(adj1.movement.id)
      expect(res.revertedMovements).toHaveLength(2)

      // La venta sigue existiendo en el kardex intacta
      const kardex = inventoryService.getProductKardex('PROD_AFTER_SALE')
      const saleInKardex = kardex.find((m) => m.type === 'venta')
      expect(saleInKardex).toBeDefined()
    })

    it('no permite cancelar un ajuste si tiene más de 7 días de antigüedad', () => {
      productService.upsertProduct({
        code: 'PROD_OLD_CANCEL',
        name: 'Botón Vintage',
        product_type: 'simple',
        sale_price: 200,
        stock: 50,
        min_stock: 10
      })

      const adj = inventoryService.adjustStock({
        product_code: 'PROD_OLD_CANCEL',
        delta: 5,
        type: 'ajuste',
        reason: 'Ajuste hace 8 días'
      })

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      db.prepare('UPDATE inventory_movements SET created_at = ? WHERE id = ?').run(
        eightDaysAgo,
        adj.movement.id
      )

      const preview = inventoryService.getAdjustmentCancellationPreview(adj.movement.id)
      expect(preview.can_cancel).toBe(false)
      expect(preview.reason).toMatch(/más de 7 días/i)

      expect(() => {
        inventoryService.cancelAdjustment(adj.movement.id)
      }).toThrow(/más de 7 días/i)

      const kardex = inventoryService.getProductKardex('PROD_OLD_CANCEL')
      const target = kardex.find((m) => m.id === adj.movement.id)
      expect(target).toBeDefined()
      expect(target?.can_cancel).toBe(false)
      expect(target?.cannot_cancel_reason).toMatch(/más de 7 días/i)
    })
  })
})

