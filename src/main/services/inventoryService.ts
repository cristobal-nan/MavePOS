import Database from 'better-sqlite3'
import {
  AdjustStockInput,
  InventoryMovement,
  InventoryMovementDetail,
  MovementType,
  Product,
  ProductSearchResult
} from '../../shared/types'

export class InventoryService {
  constructor(private db: Database.Database) {}

  adjustStock(input: AdjustStockInput): { product: Product; movement: InventoryMovement } {
    const trimmedCode = input.product_code.trim()
    const trimmedReason = input.reason ? input.reason.trim() : ''

    if (!trimmedCode) {
      throw new Error('El código del producto es obligatorio para ajustar inventario')
    }
    if (!trimmedReason) {
      throw new Error('Debe especificar un motivo para el ajuste de inventario')
    }

    const tx = this.db.transaction(() => {
      const product = this.db
        .prepare('SELECT * FROM products WHERE code = ? AND active = 1')
        .get(trimmedCode) as Product | undefined

      if (!product) {
        throw new Error(`Producto con código "${trimmedCode}" no encontrado o no está activo`)
      }

      let delta: number
      let newStock: number

      if (input.new_stock !== undefined) {
        newStock = input.new_stock
        delta = newStock - product.stock
      } else if (input.delta !== undefined) {
        delta = input.delta
        newStock = product.stock + delta
      } else {
        throw new Error('Debe indicar la nueva cantidad de stock o la variación (delta)')
      }

      if (newStock < 0) {
        throw new Error(`El inventario no puede quedar en negativo (stock actual: ${product.stock}, ajuste: ${delta})`)
      }

      if (delta === 0) {
        throw new Error('El ajuste no genera ningún cambio en el stock actual')
      }

      const now = new Date().toISOString()

      // 1. Actualizar stock del producto
      this.db
        .prepare('UPDATE products SET stock = ?, updated_at = ? WHERE code = ?')
        .run(newStock, now, trimmedCode)

      // 2. Registrar movimiento en inventory_movements
      const res = this.db
        .prepare(`
          INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
          VALUES (?, ?, 'ajuste', ?, NULL, ?)
        `)
        .run(trimmedCode, delta, trimmedReason, now)

      const movement: InventoryMovement = {
        id: Number(res.lastInsertRowid),
        product_code: trimmedCode,
        delta,
        type: 'ajuste',
        reason: trimmedReason,
        ref_sale_id: null,
        created_at: now
      }

      const updatedProduct: Product = {
        ...product,
        stock: newStock,
        updated_at: now
      }

      return { product: updatedProduct, movement }
    })

    return tx()
  }

  getLowStockProducts(limit = 100, offset = 0): (ProductSearchResult & { min_stock: number })[] {
    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        pc.name AS parent_category_name,
        parent.name AS parent_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN products parent ON p.parent_id = parent.id
      WHERE p.active = 1
        AND p.product_type IN ('simple', 'variation')
        AND p.stock <= p.min_stock
      ORDER BY p.stock ASC, p.name ASC
      LIMIT ? OFFSET ?
    `
    return this.db.prepare(sql).all(limit, offset) as (ProductSearchResult & { min_stock: number })[]
  }

  getMovementsByDate(dateStr?: string, type?: MovementType): InventoryMovementDetail[] {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10)
    const conditions: string[] = ['m.created_at LIKE ?']
    const params: any[] = [`${targetDate}%`]

    if (type) {
      conditions.push('m.type = ?')
      params.push(type)
    }

    const sql = `
      SELECT
        m.*,
        p.name AS product_name,
        p.attribute_value,
        parent.name AS parent_name,
        s.folio AS sale_folio
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_code = p.code
      LEFT JOIN products parent ON p.parent_id = parent.id
      LEFT JOIN sales s ON m.ref_sale_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.created_at DESC, m.id DESC
    `

    return this.db.prepare(sql).all(...params) as InventoryMovementDetail[]
  }

  getProductKardex(productCode: string, limit = 100): InventoryMovementDetail[] {
    const trimmed = productCode.trim()
    const sql = `
      SELECT
        m.*,
        p.name AS product_name,
        p.attribute_value,
        parent.name AS parent_name,
        s.folio AS sale_folio
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_code = p.code
      LEFT JOIN products parent ON p.parent_id = parent.id
      LEFT JOIN sales s ON m.ref_sale_id = s.id
      WHERE m.product_code = ?
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `
    return this.db.prepare(sql).all(trimmed, limit) as InventoryMovementDetail[]
  }
}
