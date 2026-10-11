import Database from 'better-sqlite3'
import {
  AdjustmentCancellationPreview,
  AdjustStockInput,
  CancelAdjustmentResult,
  InventoryMovement,
  InventoryMovementDetail,
  MovementType,
  Product,
  ProductSearchResult
} from '../../shared/types'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function isOlderThanOneWeek(createdAt: string): boolean {
  const time = new Date(createdAt).getTime()
  if (isNaN(time)) return false
  return Date.now() - time > ONE_WEEK_MS
}

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
      let product = this.db
        .prepare('SELECT * FROM products WHERE code = ? AND active = 1')
        .get(trimmedCode) as Product | undefined

      if (!product) {
        const stripped = trimmedCode.replace(/^0+/, '') || '0'
        product = this.db
          .prepare(`
            SELECT * FROM products
            WHERE (code = ? COLLATE NOCASE OR COALESCE(NULLIF(LTRIM(code, '0'), ''), '0') = ? COLLATE NOCASE)
              AND active = 1
            LIMIT 1
          `)
          .get(stripped, stripped) as Product | undefined
      }

      if (!product) {
        throw new Error(`Producto con código "${trimmedCode}" no encontrado o no está activo`)
      }

      const canonicalCode = product.code || trimmedCode

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
        .run(newStock, now, canonicalCode)

      // 2. Registrar movimiento en inventory_movements
      const res = this.db
        .prepare(`
          INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
          VALUES (?, ?, 'ajuste', ?, NULL, ?)
        `)
        .run(canonicalCode, delta, trimmedReason, now)

      const movement: InventoryMovement = {
        id: Number(res.lastInsertRowid),
        product_code: canonicalCode,
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
          COALESCE(am.item_name, p.name) AS product_name,
          p.attribute_value,
          parent.name AS parent_name,
          s.folio AS sale_folio,
          CASE WHEN am.product_code = 'COMÚN' THEN 0 ELSE (am.current_product_stock - am.delta_after_this) END AS stock_after,
          CASE WHEN am.product_code = 'COMÚN' THEN 0 ELSE (am.current_product_stock - am.delta_after_this - am.delta) END AS stock_before
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
        stock_before,
        CASE WHEN delta_after_this = 0 THEN 1 ELSE 0 END AS is_last_product_movement
      FROM ranked
      ORDER BY created_at DESC, id DESC
    `

    const finalParams = [`${targetDate}%`, `${targetDate}%`]
    if (type) {
      finalParams.push(type)
    }

    const rows = this.db.prepare(sql).all(...finalParams) as any[]
    return rows.map((r) => {
      let can_cancel = false
      let cannot_cancel_reason: string | undefined = undefined
      let can_edit_reason = false
      let cannot_edit_reason: string | undefined = undefined

      if (r.type === 'ajuste') {
        const isOld = isOlderThanOneWeek(r.created_at)
        can_edit_reason = !isOld
        cannot_edit_reason = isOld
          ? 'No editable: han transcurrido más de 7 días desde el ajuste.'
          : undefined

        const elig = this.checkCancellationEligibility(r.product_code, r.id, r.created_at)
        can_cancel = elig.can_cancel
        cannot_cancel_reason = elig.cannot_cancel_reason
      } else {
        cannot_edit_reason = 'Solo se pueden editar motivos de movimientos de tipo ajuste.'
        cannot_cancel_reason = 'Solo se pueden cancelar movimientos de tipo ajuste.'
      }

      return {
        ...r,
        is_last_product_movement: Boolean(r.is_last_product_movement),
        can_cancel,
        cannot_cancel_reason,
        can_edit_reason,
        cannot_edit_reason
      }
    })
  }

  getProductKardex(productCode: string, limit?: number): InventoryMovementDetail[] {
    const trimmed = productCode.trim()
    const stripped = trimmed.replace(/^0+/, '') || '0'
    const prod = this.db
      .prepare(`
        SELECT code FROM products
        WHERE code = ? COLLATE NOCASE
           OR code = ? COLLATE NOCASE
           OR COALESCE(NULLIF(LTRIM(code, '0'), ''), '0') = ? COLLATE NOCASE
        LIMIT 1
      `)
      .get(trimmed, stripped, stripped) as { code: string } | undefined
    const actualCode = prod ? prod.code : trimmed

    const hasLimit = typeof limit === 'number' && limit > 0
    const limitClause = hasLimit ? 'LIMIT ?' : ''

    const sql = `
      WITH ranked AS (
        SELECT
          m.*,
          COALESCE(m.item_name, p.name) AS product_name,
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
        (current_product_stock - delta_after_this - delta) AS stock_before,
        CASE WHEN delta_after_this = 0 THEN 1 ELSE 0 END AS is_last_product_movement
      FROM ranked
      ORDER BY created_at DESC, id DESC
      ${limitClause}
    `
    const params = hasLimit ? [actualCode, limit] : [actualCode]
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map((r) => {
      let can_cancel = false
      let cannot_cancel_reason: string | undefined = undefined
      let can_edit_reason = false
      let cannot_edit_reason: string | undefined = undefined

      if (r.type === 'ajuste') {
        const isOld = isOlderThanOneWeek(r.created_at)
        can_edit_reason = !isOld
        cannot_edit_reason = isOld
          ? 'No editable: han transcurrido más de 7 días desde el ajuste.'
          : undefined

        const elig = this.checkCancellationEligibility(r.product_code, r.id, r.created_at)
        can_cancel = elig.can_cancel
        cannot_cancel_reason = elig.cannot_cancel_reason
      } else {
        cannot_edit_reason = 'Solo se pueden editar motivos de movimientos de tipo ajuste.'
        cannot_cancel_reason = 'Solo se pueden cancelar movimientos de tipo ajuste.'
      }

      return {
        ...r,
        is_last_product_movement: Boolean(r.is_last_product_movement),
        can_cancel,
        cannot_cancel_reason,
        can_edit_reason,
        cannot_edit_reason
      }
    })
  }

  /**
   * Obtiene los últimos N ajustes realizados en el inventario.
   */
  getRecentAdjustments(limit = 5): InventoryMovementDetail[] {
    const sql = `
      SELECT
        m.id,
        m.product_code,
        m.delta,
        m.type,
        m.reason,
        m.ref_sale_id,
        m.created_at,
        COALESCE(m.item_name, p.name) AS product_name,
        p.attribute_value,
        parent.name AS parent_name,
        NULL AS sale_folio,
        NULL AS stock_before,
        NULL AS stock_after,
        CASE
          WHEN (
            SELECT id FROM inventory_movements
            WHERE product_code = m.product_code
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          ) = m.id THEN 1
          ELSE 0
        END AS is_last_product_movement
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_code = p.code
      LEFT JOIN products parent ON p.parent_id = parent.id
      WHERE m.type = 'ajuste'
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `
    const rows = this.db.prepare(sql).all(limit) as any[]
    return rows.map((r) => {
      const isOld = isOlderThanOneWeek(r.created_at)
      const can_edit_reason = !isOld
      const cannot_edit_reason = isOld
        ? 'No editable: han transcurrido más de 7 días desde el ajuste.'
        : undefined

      const elig = this.checkCancellationEligibility(r.product_code, r.id, r.created_at)
      return {
        ...r,
        is_last_product_movement: Boolean(r.is_last_product_movement),
        can_cancel: elig.can_cancel,
        cannot_cancel_reason: elig.cannot_cancel_reason,
        can_edit_reason,
        cannot_edit_reason
      }
    })
  }

  /**
   * Edita el motivo de un movimiento de inventario existente de tipo ajuste.
   */
  updateMovementReason(movementId: number, newReason: string): InventoryMovementDetail {
    const trimmed = (newReason || '').trim()
    if (!trimmed) {
      throw new Error('El motivo del movimiento no puede estar vacío.')
    }

    const movement = this.db
      .prepare('SELECT * FROM inventory_movements WHERE id = ?')
      .get(movementId) as InventoryMovement | undefined

    if (!movement) {
      throw new Error(`No se encontró el movimiento con ID #${movementId}`)
    }

    if (movement.type !== 'ajuste') {
      throw new Error('Solo se pueden editar motivos de movimientos de tipo ajuste.')
    }

    if (isOlderThanOneWeek(movement.created_at)) {
      throw new Error('No se puede editar el motivo de un ajuste con más de 7 días de antigüedad.')
    }

    this.db
      .prepare('UPDATE inventory_movements SET reason = ? WHERE id = ?')
      .run(trimmed, movementId)

    // Devolver el detalle actualizado
    const sql = `
      SELECT
        m.*,
        COALESCE(m.item_name, p.name) AS product_name,
        p.attribute_value,
        parent.name AS parent_name,
        s.folio AS sale_folio
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_code = p.code
      LEFT JOIN products parent ON p.parent_id = parent.id
      LEFT JOIN sales s ON m.ref_sale_id = s.id
      WHERE m.id = ?
    `
    return this.db.prepare(sql).get(movementId) as InventoryMovementDetail
  }

  /**
   * Verifica de forma rápida si un ajuste manual es elegible para cancelación en cascada.
   */
  private checkCancellationEligibility(
    productCode: string,
    movementId: number,
    createdAt?: string
  ): { can_cancel: boolean; cannot_cancel_reason?: string } {
    if (createdAt && isOlderThanOneWeek(createdAt)) {
      return {
        can_cancel: false,
        cannot_cancel_reason: 'No revocable: han transcurrido más de 7 días desde el ajuste.'
      }
    }

    const checkStmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN type != 'ajuste' THEN 1 ELSE 0 END) AS non_adjustment_count
      FROM inventory_movements
      WHERE product_code = ? AND id >= ?
    `)
    const res = checkStmt.get(productCode, movementId) as {
      total_count: number
      non_adjustment_count: number
    }
    if (res.total_count > 5) {
      return {
        can_cancel: false,
        cannot_cancel_reason: 'No revocable: excede el límite máximo de 5 movimientos en la cadena a revertir.'
      }
    }
    if (res.non_adjustment_count > 0) {
      return {
        can_cancel: false,
        cannot_cancel_reason: 'No revocable: existen movimientos posteriores que no son ajustes (ventas, devoluciones, etc.).'
      }
    }
    return {
      can_cancel: true
    }
  }

  /**
   * Obtiene la vista previa de la cancelación en cascada de un ajuste de inventario.
   * Valida que la cadena contenga como máximo 5 movimientos y que todos sean de tipo 'ajuste'.
   */
  getAdjustmentCancellationPreview(movementId: number): AdjustmentCancellationPreview {
    const movement = this.db
      .prepare('SELECT * FROM inventory_movements WHERE id = ?')
      .get(movementId) as InventoryMovement | undefined

    if (!movement) {
      throw new Error(`No se encontró el movimiento con ID #${movementId}`)
    }

    if (movement.type !== 'ajuste') {
      throw new Error('Solo se pueden cancelar movimientos de tipo "ajuste"')
    }

    const product = this.db
      .prepare(`
        SELECT p.*, parent.name AS parent_name
        FROM products p
        LEFT JOIN products parent ON p.parent_id = parent.id
        WHERE p.code = ?
      `)
      .get(movement.product_code) as (Product & { parent_name?: string | null }) | undefined

    if (!product) {
      throw new Error(`Producto con código "${movement.product_code}" no encontrado`)
    }

    // Obtener todos los movimientos del producto desde este movimiento en adelante (orden cronológico ascendente)
    const subsequentSql = `
      SELECT
        m.*,
        COALESCE(m.item_name, p.name) AS product_name,
        p.attribute_value,
        parent.name AS parent_name,
        s.folio AS sale_folio
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_code = p.code
      LEFT JOIN products parent ON p.parent_id = parent.id
      LEFT JOIN sales s ON m.ref_sale_id = s.id
      WHERE m.product_code = ? AND m.id >= ?
      ORDER BY m.id ASC
    `
    const chain = this.db.prepare(subsequentSql).all(movement.product_code, movement.id) as InventoryMovementDetail[]

    let canCancel = true
    let reason: string | undefined = undefined

    if (isOlderThanOneWeek(movement.created_at)) {
      canCancel = false
      reason = 'No revocable: han transcurrido más de 7 días desde el ajuste.'
    } else if (chain.length > 5) {
      canCancel = false
      reason = 'No revocable: excede el límite máximo de 5 movimientos en la cadena a revertir.'
    } else {
      const hasNonAdjustment = chain.some((m) => m.type !== 'ajuste')
      if (hasNonAdjustment) {
        canCancel = false
        reason = 'No revocable: existen movimientos posteriores que no son ajustes manuales (ventas, devoluciones, etc.).'
      }
    }

    const totalDelta = chain.reduce((sum, m) => sum + m.delta, 0)
    const projectedStock = product.stock - totalDelta

    const displayName = product.parent_name
      ? `${product.parent_name} ${product.name}`
      : product.name

    return {
      can_cancel: canCancel,
      reason,
      movements_to_revert: chain,
      current_stock: product.stock,
      projected_stock: projectedStock,
      product_code: product.code || movement.product_code,
      product_name: displayName,
      total_delta: totalDelta
    }
  }

  /**
   * Cancela un movimiento de ajuste y revierte en cascada todos los movimientos posteriores
   * (hasta 5 movimientos en total, todos de tipo 'ajuste').
   * Revierte el stock atómicamente y elimina los registros de inventory_movements.
   */
  cancelAdjustment(movementId: number): CancelAdjustmentResult {
    const tx = this.db.transaction(() => {
      const preview = this.getAdjustmentCancellationPreview(movementId)

      if (!preview.can_cancel) {
        throw new Error(preview.reason || 'Este movimiento no se puede cancelar.')
      }

      const now = new Date().toISOString()

      // 1. Revertir el stock del producto
      this.db
        .prepare('UPDATE products SET stock = ?, updated_at = ? WHERE code = ?')
        .run(preview.projected_stock, now, preview.product_code)

      // 2. Eliminar físicamente todos los movimientos de la cadena
      const idsToDelete = preview.movements_to_revert.map((m) => m.id)
      const deleteStmt = this.db.prepare('DELETE FROM inventory_movements WHERE id = ?')
      for (const id of idsToDelete) {
        deleteStmt.run(id)
      }

      return {
        revertedMovement: preview.movements_to_revert[0],
        revertedMovements: preview.movements_to_revert,
        newStock: preview.projected_stock,
        product_code: preview.product_code
      }
    })

    return tx()
  }
}
