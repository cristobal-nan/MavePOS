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

    let typeFilter = ''
    if (type) {
      typeFilter = 'AND am.type = ?'
    }

    const sql = `
      WITH product_codes_on_date AS (
        SELECT DISTINCT product_code
        FROM inventory_movements
        WHERE created_at LIKE ?
      ),
      all_movements_for_these_products AS (
        SELECT
          m.*,
          COALESCE(p.stock, (SELECT SUM(delta) FROM inventory_movements WHERE product_code = m.product_code)) AS current_product_stock,
          COALESCE(
            SUM(m.delta) OVER (
              PARTITION BY m.product_code
              ORDER BY m.created_at DESC, m.id DESC
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS delta_after_this
        FROM inventory_movements m
        JOIN product_codes_on_date pcd ON m.product_code = pcd.product_code
        LEFT JOIN products p ON m.product_code = p.code
      ),
      ranked AS (
        SELECT
          am.*,
          p.name AS product_name,
          p.attribute_value,
          parent.name AS parent_name,
          s.folio AS sale_folio,
          (am.current_product_stock - am.delta_after_this) AS stock_after,
          (am.current_product_stock - am.delta_after_this - am.delta) AS stock_before
        FROM all_movements_for_these_products am
        LEFT JOIN products p ON am.product_code = p.code
        LEFT JOIN products parent ON p.parent_id = parent.id
        LEFT JOIN sales s ON am.ref_sale_id = s.id
        WHERE am.created_at LIKE ?
        ${typeFilter}
      )
      SELECT
        id,
        product_code,
        delta,
        type,
        reason,
        ref_sale_id,
        created_at,
        product_name,
        attribute_value,
        parent_name,
        sale_folio,
        stock_after,
        stock_before
      FROM ranked
      ORDER BY created_at DESC, id DESC
    `

    const finalParams = [`${targetDate}%`, `${targetDate}%`]
    if (type) {
      finalParams.push(type)
    }

    return this.db.prepare(sql).all(...finalParams) as InventoryMovementDetail[]
  }

  getProductKardex(productCode: string, limit = 100): InventoryMovementDetail[] {
    const trimmed = productCode.trim()
    const prod = this.db
      .prepare("SELECT code FROM products WHERE code = ? OR LTRIM(code, '0') = LTRIM(?, '0') LIMIT 1")
      .get(trimmed, trimmed) as { code: string } | undefined
    const actualCode = prod ? prod.code : trimmed

    const sql = `
      WITH ranked AS (
        SELECT
          m.*,
          p.name AS product_name,
          p.attribute_value,
          parent.name AS parent_name,
          s.folio AS sale_folio,
          COALESCE(p.stock, (SELECT SUM(delta) FROM inventory_movements WHERE product_code = m.product_code)) AS current_product_stock,
          COALESCE(
            SUM(m.delta) OVER (
              ORDER BY m.created_at DESC, m.id DESC
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          ) AS delta_after_this
        FROM inventory_movements m
        LEFT JOIN products p ON m.product_code = p.code
        LEFT JOIN products parent ON p.parent_id = parent.id
        LEFT JOIN sales s ON m.ref_sale_id = s.id
        WHERE m.product_code = ?
      )
      SELECT
        id,
        product_code,
        delta,
        type,
        reason,
        ref_sale_id,
        created_at,
        product_name,
        attribute_value,
        parent_name,
        sale_folio,
        (current_product_stock - delta_after_this) AS stock_after,
        (current_product_stock - delta_after_this - delta) AS stock_before
      FROM ranked
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `
    return this.db.prepare(sql).all(actualCode, limit) as InventoryMovementDetail[]
  }
}
