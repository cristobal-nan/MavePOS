import Database from 'better-sqlite3'
import {
  Category,
  Product,
  ProductInput,
  ProductSearchResult,
  ProductSearchOptions,
  GroupAsVariableInput
} from '../../shared/types'
import { normalizeSearchName } from '../db/utils'

export class ProductService {
  constructor(private db: Database.Database) {}

  // ----------------------------------------------------
  // Categories (Strict 2-level hierarchy: Depto -> Subcat)
  // ----------------------------------------------------

  getAllCategories(): Category[] {
    const stmt = this.db.prepare('SELECT * FROM categories ORDER BY name ASC')
    return stmt.all() as Category[]
  }

  saveCategory(name: string, parentId: number | null = null, id?: number): Category {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('El nombre de la categoría no puede estar vacío')
    }

    if (parentId !== null) {
      // Validate that parent category exists and is a root category (level 1)
      const parent = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(parentId) as Category | undefined
      if (!parent) {
        throw new Error('La categoría padre especificada no existe')
      }
      if (parent.parent_id !== null) {
        throw new Error('No se permiten más de 2 niveles de categorías (Departamento → Subcategoría)')
      }
    }

    if (id) {
      // If updating, check that this category doesn't have children if setting parentId
      if (parentId !== null) {
        const hasChildren = this.db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(id) as { count: number }
        if (hasChildren.count > 0) {
          throw new Error('No se puede asignar un padre a una categoría que ya contiene subcategorías')
        }
      }

      this.db
        .prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?')
        .run(trimmedName, parentId, id)
      return { id, name: trimmedName, parent_id: parentId }
    } else {
      const result = this.db
        .prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)')
        .run(trimmedName, parentId)
      return { id: Number(result.lastInsertRowid), name: trimmedName, parent_id: parentId }
    }
  }

  deleteCategory(id: number): void {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }

  // ----------------------------------------------------
  // Products (Simple, Variable & Variations)
  // ----------------------------------------------------

  private attachSuppliersToProduct(product: Product): void {
    if (!product.id) return
    const suppRows = this.db
      .prepare(`
        SELECT s.id, s.name, s.search_name, s.active, s.created_at, s.updated_at
        FROM product_suppliers ps
        JOIN suppliers s ON s.id = ps.supplier_id
        WHERE ps.product_id = ?
        ORDER BY s.name ASC
      `)
      .all(product.id) as any[]
    product.supplier_ids = suppRows.map((s) => s.id)
    product.suppliers = suppRows
  }

  generateAvailableDeletedCode(baseCode: string): string {
    const cleanBase = baseCode.replace(/_deleted\d*$/, '')
    let index = 1
    let candidate = `${cleanBase}_deleted${index}`
    while (this.db.prepare('SELECT 1 FROM products WHERE code = ?').get(candidate)) {
      index++
      candidate = `${cleanBase}_deleted${index}`
    }
    return candidate
  }

  checkProductCodeAvailable(code: string, excludeProductId?: number): { available: boolean; conflictProductName?: string } {
    const trimmed = (code || '').trim()
    if (!trimmed) return { available: true }

    if (trimmed.toUpperCase() === 'COMÚN' || trimmed.toUpperCase() === 'COMUN') {
      return { available: false, conflictProductName: 'Código reservado exclusivamente por el sistema' }
    }

    let query = 'SELECT id, name FROM products WHERE code = ? COLLATE NOCASE'
    const params: any[] = [trimmed]

    if (excludeProductId) {
      query += ' AND id != ?'
      params.push(excludeProductId)
    }

    const match = this.db.prepare(query).get(...params) as { id: number; name: string } | undefined
    if (match) {
      return { available: false, conflictProductName: match.name }
    }

    return { available: true }
  }

  getProductByCode(code: string, includeInactive = false): Product | null {
    const trimmed = (code || '').trim()
    if (!trimmed) return null

    const baseWhere = includeInactive ? '' : ' AND active = 1'

    // 1. Coincidencia exacta literal
    let row = this.db
      .prepare(`SELECT * FROM products WHERE code = ?${baseWhere}`)
      .get(trimmed) as Product | undefined

    // 2. Coincidencia exacta insensible a mayúsculas
    if (!row) {
      row = this.db
        .prepare(`SELECT * FROM products WHERE code = ? COLLATE NOCASE${baseWhere}`)
        .get(trimmed) as Product | undefined
    }

    // 3. Tolerancia de ceros a la izquierda (ej: '03.19234' vs '3.19234', '007542' vs '7542')
    if (!row) {
      const stripped = trimmed.replace(/^0+/, '') || '0'
      if (stripped !== trimmed) {
        row = this.db
          .prepare(`SELECT * FROM products WHERE code = ? COLLATE NOCASE${baseWhere}`)
          .get(stripped) as Product | undefined
      }

      if (!row) {
        row = this.db
          .prepare(
            `SELECT * FROM products WHERE COALESCE(NULLIF(LTRIM(code, '0'), ''), '0') = ? COLLATE NOCASE${baseWhere} LIMIT 1`
          )
          .get(stripped) as Product | undefined
      }
    }

    if (row) this.attachSuppliersToProduct(row)
    return row || null
  }

  getProductById(id: number, includeInactive = false): Product | null {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE id = ?'
      : 'SELECT * FROM products WHERE id = ? AND active = 1'
    const row = this.db.prepare(query).get(id) as Product | undefined
    if (row) this.attachSuppliersToProduct(row)
    return row || null
  }

  getVariations(parentId: number, includeInactive = false): Product[] {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE parent_id = ? ORDER BY id ASC'
      : 'SELECT * FROM products WHERE parent_id = ? AND active = 1 ORDER BY id ASC'
    const rows = this.db.prepare(query).all(parentId) as Product[]
    for (const r of rows) {
      this.attachSuppliersToProduct(r)
    }
    return rows
  }

  upsertProduct(input: ProductInput): Product {
    const productType = input.product_type || 'simple'
    const trimmedName = input.name.trim()
    const trimmedCode = input.code ? input.code.trim() : null
    const parentId = input.parent_id !== undefined ? input.parent_id : null
    const attributeName = input.attribute_name ? input.attribute_name.trim() : null
    const attributeValue = input.attribute_value ? input.attribute_value.trim() : null
    const costPrice = input.cost_price !== undefined ? input.cost_price : null
    const stock = input.stock !== undefined ? input.stock : 0
    const minStock = input.min_stock !== undefined ? input.min_stock : 0
    const categoryId = input.category_id || null
    const salePrice = input.sale_price !== undefined ? input.sale_price : 0

    if (!trimmedName) {
      throw new Error('El nombre de producto no puede estar vacío')
    }

    if (productType === 'simple' || productType === 'variation') {
      if (!trimmedCode) {
        throw new Error('El código de producto no puede estar vacío para productos simples o variaciones')
      }
      if (salePrice < 0 || !Number.isInteger(salePrice)) {
        throw new Error('El precio de venta debe ser un entero positivo en CLP')
      }
    }

    if (productType === 'variation' && !parentId) {
      throw new Error('Una variación debe estar asociada a un producto padre')
    }

    if (trimmedCode && (trimmedCode.toUpperCase() === 'COMÚN' || trimmedCode.toUpperCase() === 'COMUN')) {
      throw new Error("El código 'COMÚN' está reservado exclusivamente por el sistema.")
    }

    const searchName = normalizeSearchName(trimmedName)
    const now = new Date().toISOString()

    let existing: Product | undefined
    if (input.id) {
      existing = this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as Product | undefined
      if (!existing) {
        throw new Error(`Producto con ID ${input.id} no encontrado para actualizar.`)
      }
    }

    if (trimmedCode) {
      let duplicateQuery = 'SELECT id, name FROM products WHERE code = ? COLLATE NOCASE'
      const duplicateParams: any[] = [trimmedCode]
      if (input.id) {
        duplicateQuery += ' AND id != ?'
        duplicateParams.push(input.id)
      }
      const duplicate = this.db.prepare(duplicateQuery).get(...duplicateParams) as { id: number; name: string } | undefined
      if (duplicate) {
        throw new Error(
          `El código '${trimmedCode}' ya está registrado en el producto '${duplicate.name}'. Cada producto debe tener un código único.`
        )
      }
    }

    let targetId: number
    if (existing) {
      targetId = existing.id!
      const oldCode = existing.code
      const isCodeChanged = Boolean(trimmedCode && oldCode && trimmedCode !== oldCode)

      const updateTx = this.db.transaction(() => {
        if (isCodeChanged) {
          this.db.exec('PRAGMA defer_foreign_keys = ON;')
        }

        this.db.prepare(`
          UPDATE products SET
            code = ?,
            name = ?,
            search_name = ?,
            product_type = ?,
            parent_id = ?,
            attribute_name = ?,
            attribute_value = ?,
            sale_price = ?,
            cost_price = ?,
            category_id = ?,
            stock = ?,
            min_stock = ?,
            active = 1,
            updated_at = ?
          WHERE id = ?
        `).run(
          trimmedCode,
          trimmedName,
          searchName,
          productType,
          parentId,
          attributeName,
          attributeValue,
          salePrice,
          costPrice,
          categoryId,
          stock,
          minStock,
          now,
          targetId
        )

        if (isCodeChanged && oldCode) {
          // Migrar historial de kardex e items de venta al nuevo código sin perder referencias
          this.db.prepare('UPDATE inventory_movements SET product_code = ? WHERE product_code = ?').run(trimmedCode, oldCode)
          this.db.prepare('UPDATE sale_items SET product_code = ? WHERE product_code = ?').run(trimmedCode, oldCode)
        }

        // Si es un producto variable padre y cambió su nombre o categoría, sincronizar sus variaciones activas
        if (productType === 'variable') {
          const children = this.db
            .prepare('SELECT id, attribute_value FROM products WHERE parent_id = ? AND active = 1')
            .all(targetId) as { id: number; attribute_value: string | null }[]

          for (const child of children) {
            const childName = `${trimmedName} ${child.attribute_value || ''}`.trim()
            const childSearchName = normalizeSearchName(childName)

            if (input.sync_variations) {
              this.db.prepare(`
                UPDATE products SET
                  name = ?,
                  search_name = ?,
                  category_id = ?,
                  attribute_name = ?,
                  sale_price = CASE WHEN ? > 0 THEN ? ELSE sale_price END,
                  cost_price = CASE WHEN ? IS NOT NULL THEN ? ELSE cost_price END,
                  min_stock = CASE WHEN ? >= 0 THEN ? ELSE min_stock END,
                  updated_at = ?
                WHERE id = ?
              `).run(
                childName,
                childSearchName,
                categoryId,
                attributeName,
                salePrice,
                salePrice,
                costPrice,
                costPrice,
                minStock,
                minStock,
                now,
                child.id
              )
            } else {
              this.db.prepare(`
                UPDATE products SET
                  name = ?,
                  search_name = ?,
                  category_id = ?,
                  attribute_name = ?,
                  updated_at = ?
                WHERE id = ?
              `).run(childName, childSearchName, categoryId, attributeName, now, child.id)
            }
          }
        }
      })

      updateTx()
    } else {
      const result = this.db.prepare(`
        INSERT INTO products (
          code, name, search_name, product_type, parent_id,
          attribute_name, attribute_value, sale_price, cost_price,
          category_id, stock, min_stock, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        trimmedCode,
        trimmedName,
        searchName,
        productType,
        parentId,
        attributeName,
        attributeValue,
        salePrice,
        costPrice,
        categoryId,
        stock,
        minStock,
        now,
        now
      )
      targetId = Number(result.lastInsertRowid)

      if (productType !== 'variable' && stock > 0 && trimmedCode) {
        this.db.prepare(`
          INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
          VALUES (?, ?, 'inicial', 'Stock inicial (creación de producto)', NULL, ?)
        `).run(trimmedCode, stock, now)
      }
    }

    // Persist suppliers if provided
    if (input.supplier_ids !== undefined) {
      this.db.prepare('DELETE FROM product_suppliers WHERE product_id = ?').run(targetId)
      const insertSupplierStmt = this.db.prepare('INSERT OR IGNORE INTO product_suppliers (product_id, supplier_id) VALUES (?, ?)')
      for (const sId of input.supplier_ids) {
        insertSupplierStmt.run(targetId, sId)
      }

      // Si es producto variable, sincronizar proveedores en sus variaciones
      if (productType === 'variable') {
        const children = this.db.prepare('SELECT id FROM products WHERE parent_id = ? AND active = 1').all(targetId) as { id: number }[]
        for (const child of children) {
          this.db.prepare('DELETE FROM product_suppliers WHERE product_id = ?').run(child.id)
          for (const sId of input.supplier_ids) {
            insertSupplierStmt.run(child.id, sId)
          }
        }
      }
    }

    return this.getProductById(targetId, true)!
  }

  saveVariableProduct(
    parentInput: ProductInput,
    variationsInput: ProductInput[]
  ): { parent: Product; variations: Product[] } {
    // Validar duplicados entre las variaciones mismas del formulario
    const seenVariationCodes = new Map<string, number>()
    for (let i = 0; i < variationsInput.length; i++) {
      const vCode = variationsInput[i].code?.trim()
      if (vCode) {
        const upper = vCode.toUpperCase()
        if (seenVariationCodes.has(upper)) {
          const firstIdx = seenVariationCodes.get(upper)! + 1
          throw new Error(
            `El código '${vCode}' está repetido en la variación #${i + 1} y en la variación #${firstIdx}. Cada variación debe tener un código único.`
          )
        }
        seenVariationCodes.set(upper, i)
      }
    }

    const tx = this.db.transaction(() => {
      const parent = this.upsertProduct({
        ...parentInput,
        product_type: 'variable',
        parent_id: null,
        sale_price: parentInput.sale_price || 0,
        stock: parentInput.stock || 0
      })

      const savedVariations: Product[] = []
      const savedVariationIds = new Set<number>()

      for (const varInput of variationsInput) {
        const saved = this.upsertProduct({
          ...varInput,
          product_type: 'variation',
          parent_id: parent.id,
          attribute_name: varInput.attribute_name || parentInput.attribute_name,
          category_id: varInput.category_id || parentInput.category_id
        })
        savedVariations.push(saved)
        if (saved.id) savedVariationIds.add(saved.id)
      }

      // Soft delete any removed variation
      if (parent.id) {
        const existingVariations = this.getVariations(parent.id)
        for (const ev of existingVariations) {
          if (ev.id && !savedVariationIds.has(ev.id)) {
            this.softDeleteProduct(ev.id)
          }
        }
      }

      return { parent, variations: savedVariations }
    })

    return tx()
  }

  softDeleteProduct(codeOrId: string | number): boolean {
    const now = new Date().toISOString()
    const tx = this.db.transaction(() => {
      let prod: Product | undefined
      if (typeof codeOrId === 'number' || /^\d+$/.test(String(codeOrId))) {
        prod = this.db.prepare('SELECT * FROM products WHERE id = ?').get(Number(codeOrId)) as Product | undefined
      }
      if (!prod) {
        prod = this.db.prepare('SELECT * FROM products WHERE code = ?').get(String(codeOrId)) as Product | undefined
      }
      if (!prod) return false

      this.db.exec('PRAGMA defer_foreign_keys = ON;')

      if (prod.code && prod.code !== 'COMÚN') {
        const deletedCode = this.generateAvailableDeletedCode(prod.code)
        this.db.prepare('UPDATE products SET code = ?, active = 0, updated_at = ? WHERE id = ?').run(deletedCode, now, prod.id)
        this.db.prepare('UPDATE inventory_movements SET product_code = ? WHERE product_code = ?').run(deletedCode, prod.code)
        this.db.prepare('UPDATE sale_items SET product_code = ? WHERE product_code = ?').run(deletedCode, prod.code)
      } else {
        this.db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now, prod.id)
      }

      if (prod.product_type === 'variable') {
        const children = this.db.prepare('SELECT id, code FROM products WHERE parent_id = ?').all(prod.id) as { id: number; code: string | null }[]
        for (const child of children) {
          if (child.code && child.code !== 'COMÚN') {
            const childDeletedCode = this.generateAvailableDeletedCode(child.code)
            this.db.prepare('UPDATE products SET code = ?, active = 0, updated_at = ? WHERE id = ?').run(childDeletedCode, now, child.id)
            this.db.prepare('UPDATE inventory_movements SET product_code = ? WHERE product_code = ?').run(childDeletedCode, child.code)
            this.db.prepare('UPDATE sale_items SET product_code = ? WHERE product_code = ?').run(childDeletedCode, child.code)
          } else {
            this.db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now, child.id)
          }
        }
      }
      return true
    })
    return tx()
  }

  bulkUpdateCategory(
    productIds: number[],
    categoryId?: number | null,
    supplierIds?: number[]
  ): { updatedCount: number } {
    if (!productIds || productIds.length === 0) return { updatedCount: 0 }

    const now = new Date().toISOString()
    const tx = this.db.transaction(() => {
      const placeholders = productIds.map(() => '?').join(',')
      let changes = 0

      if (categoryId !== undefined) {
        // Update directly selected products
        const updateDirect = this.db.prepare(`
          UPDATE products
          SET category_id = ?, updated_at = ?
          WHERE id IN (${placeholders})
        `)
        const res = updateDirect.run(categoryId, now, ...productIds)
        changes = res.changes

        // Also cascade to variations if any selected product was a variable parent
        const updateChildren = this.db.prepare(`
          UPDATE products
          SET category_id = ?, updated_at = ?
          WHERE parent_id IN (${placeholders})
        `)
        updateChildren.run(categoryId, now, ...productIds)
      }

      if (supplierIds !== undefined) {
        const allTargetIds = this.db
          .prepare(
            `SELECT id FROM products WHERE id IN (${placeholders}) OR parent_id IN (${placeholders})`
          )
          .all(...productIds, ...productIds) as { id: number }[]

        const insertSuppStmt = this.db.prepare(
          'INSERT OR IGNORE INTO product_suppliers (product_id, supplier_id) VALUES (?, ?)'
        )

        for (const target of allTargetIds) {
          this.db.prepare('DELETE FROM product_suppliers WHERE product_id = ?').run(target.id)
          for (const sId of supplierIds) {
            insertSuppStmt.run(target.id, sId)
          }
        }
      }

      return { updatedCount: changes || productIds.length }
    })

    return tx()
  }

  groupProductsAsVariable(input: GroupAsVariableInput): { parentId: number; count: number } {
    const { parentName, categoryId, attributeName, items, supplierIds } = input
    const trimmedParentName = parentName.trim()
    const trimmedAttr = attributeName.trim()

    if (!trimmedParentName) {
      throw new Error('El nombre del producto variable no puede estar vacío.')
    }
    if (!trimmedAttr) {
      throw new Error('El nombre del atributo no puede estar vacío (ej: Color, Talla).')
    }
    if (!items || items.length === 0) {
      throw new Error('Debes seleccionar al menos un producto para agrupar como variación.')
    }

    const now = new Date().toISOString()
    const tx = this.db.transaction(() => {
      // 1. Create the parent variable product
      const parentSearchName = normalizeSearchName(trimmedParentName)
      const insertParentStmt = this.db.prepare(`
        INSERT INTO products (
          code, name, search_name, product_type, parent_id, attribute_name, attribute_value,
          sale_price, cost_price, category_id, stock, min_stock, active, created_at, updated_at
        ) VALUES (
          NULL, ?, ?, 'variable', NULL, ?, NULL,
          0, NULL, ?, 0, 0, 1, ?, ?
        )
      `)

      const parentRes = insertParentStmt.run(
        trimmedParentName,
        parentSearchName,
        trimmedAttr,
        categoryId,
        now,
        now
      )
      const parentId = Number(parentRes.lastInsertRowid)

      // Associate suppliers if provided
      if (supplierIds && supplierIds.length > 0) {
        const insertSuppStmt = this.db.prepare(
          'INSERT OR IGNORE INTO product_suppliers (product_id, supplier_id) VALUES (?, ?)'
        )
        for (const sId of supplierIds) {
          insertSuppStmt.run(parentId, sId)
          for (const item of items) {
            insertSuppStmt.run(item.productId, sId)
          }
        }
      }

      // 2. Prepared statements for updating child items into variations
      const getProductStmt = this.db.prepare('SELECT * FROM products WHERE id = ?')
      const updateToVariationStmt = this.db.prepare(`
        UPDATE products SET
          product_type = 'variation',
          parent_id = ?,
          attribute_name = ?,
          attribute_value = ?,
          name = ?,
          search_name = ?,
          category_id = COALESCE(?, category_id),
          updated_at = ?
        WHERE id = ?
      `)

      let count = 0
      for (const item of items) {
        const prod = getProductStmt.get(item.productId) as Product | undefined
        if (!prod) continue

        const attrVal = (item.attributeValue || '').trim()
        const variationName = item.name && item.name.trim() !== ''
          ? item.name.trim()
          : attrVal
            ? `${trimmedParentName} ${attrVal}`
            : prod.name
        const variationSearchName = normalizeSearchName(variationName)

        updateToVariationStmt.run(
          parentId,
          trimmedAttr,
          attrVal || null,
          variationName,
          variationSearchName,
          categoryId,
          now,
          item.productId
        )
        count++
      }

      return { parentId, count }
    })

    return tx()
  }

  bulkSoftDelete(productIds: number[]): { deletedCount: number } {
    if (!productIds || productIds.length === 0) return { deletedCount: 0 }

    const now = new Date().toISOString()
    const tx = this.db.transaction(() => {
      this.db.exec('PRAGMA defer_foreign_keys = ON;')
      const placeholders = productIds.map(() => '?').join(',')

      // Obtener todos los productos afectados (directos y variaciones hijas de padres variables)
      const targetProducts = this.db
        .prepare(`
          SELECT id, code FROM products
          WHERE id IN (${placeholders}) OR parent_id IN (${placeholders})
        `)
        .all(...productIds, ...productIds) as { id: number; code: string | null }[]

      for (const prod of targetProducts) {
        if (prod.code && prod.code !== 'COMÚN') {
          const deletedCode = this.generateAvailableDeletedCode(prod.code)
          this.db.prepare('UPDATE products SET code = ?, active = 0, updated_at = ? WHERE id = ?').run(deletedCode, now, prod.id)
          this.db.prepare('UPDATE inventory_movements SET product_code = ? WHERE product_code = ?').run(deletedCode, prod.code)
          this.db.prepare('UPDATE sale_items SET product_code = ? WHERE product_code = ?').run(deletedCode, prod.code)
        } else {
          this.db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now, prod.id)
        }
      }

      return { deletedCount: targetProducts.length }
    })

    return tx()
  }

  getActiveProducts(limit = 100, offset = 0): Product[] {
    return this.db
      .prepare('SELECT * FROM products WHERE active = 1 ORDER BY name ASC LIMIT ? OFFSET ?')
      .all(limit, offset) as Product[]
  }

  // ----------------------------------------------------
  // Product Search Engine (% wildcard algorithm)
  // ----------------------------------------------------

  searchProducts(options: ProductSearchOptions = {}): ProductSearchResult[] {
    const {
      query = '',
      categoryId = null,
      supplierId = null,
      productType,
      parentId = null,
      onlySellable = false,
      limit = 200,
      offset = 0,
      orderBy = 'name',
      orderDir = 'ASC',
      includeInactive = false
    } = options

    const conditions: string[] = []
    const params: any[] = []

    // Active status filter (soft delete check)
    if (!includeInactive) {
      conditions.push('p.active = 1')
    }

    // Category filter: match either direct category, subcategory of parent, or parent's category
    if (categoryId !== null && categoryId !== undefined) {
      conditions.push('(p.category_id = ? OR c.parent_id = ? OR parent.category_id = ?)')
      params.push(categoryId, categoryId, categoryId)
    }

    // Supplier filter
    if (supplierId !== null && supplierId !== undefined) {
      conditions.push(`(
        EXISTS (SELECT 1 FROM product_suppliers ps WHERE ps.product_id = p.id AND ps.supplier_id = ?)
        OR EXISTS (SELECT 1 FROM product_suppliers psp WHERE psp.product_id = parent.id AND psp.supplier_id = ?)
      )`)
      params.push(supplierId, supplierId)
    }

    // Product Type filter
    if (productType && productType !== 'all') {
      conditions.push('p.product_type = ?')
      params.push(productType)
    } else if (onlySellable) {
      conditions.push("p.product_type IN ('simple', 'variation')")
    }

    // Parent product filter (for getting variations of a specific product)
    if (parentId !== null && parentId !== undefined) {
      conditions.push('p.parent_id = ?')
      params.push(parentId)
    }

    // Algorithm from Specification Section 5
    const rawInput = query.trim()
    if (rawInput) {
      const startsWithPercent = rawInput.startsWith('%')
      const rawFragments = rawInput.split('%')

      // Filter and normalize fragments
      const fragments: { text: string; isInitial: boolean }[] = []
      rawFragments.forEach((frag, idx) => {
        const normalized = normalizeSearchName(frag)
        if (normalized.length > 0) {
          // Escape wildcard _ in SQL
          const escaped = normalized.replace(/\\/g, '\\\\').replace(/_/g, '\\_')
          const isInitial = idx === 0 && !startsWithPercent
          fragments.push({ text: escaped, isInitial })
        }
      })

      if (fragments.length > 0) {
        // Combined with AND
        const nameConditions: string[] = []
        fragments.forEach((f) => {
          const pattern = f.isInitial ? `${f.text}%` : `%${f.text}%`
          nameConditions.push("(p.search_name LIKE ? ESCAPE '\\' OR (parent.search_name IS NOT NULL AND parent.search_name LIKE ? ESCAPE '\\'))")
          params.push(pattern, pattern)
        })

        // Also check if raw query matches code literally (Section 5.3) with leading zero tolerance
        if (!rawInput.includes('%')) {
          const trimmedInput = rawInput.trim()
          const stripped = trimmedInput.replace(/^0+/, '') || '0'
          if (stripped !== trimmedInput) {
            conditions.push(
              `(${nameConditions.join(' AND ')} OR p.code = ? COLLATE NOCASE OR p.code = ? COLLATE NOCASE OR COALESCE(NULLIF(LTRIM(p.code, '0'), ''), '0') = ? COLLATE NOCASE)`
            )
            params.push(trimmedInput, stripped, stripped)
          } else {
            conditions.push(
              `(${nameConditions.join(' AND ')} OR p.code = ? COLLATE NOCASE OR COALESCE(NULLIF(LTRIM(p.code, '0'), ''), '0') = ? COLLATE NOCASE)`
            )
            params.push(trimmedInput, stripped)
          }
        } else {
          conditions.push(`(${nameConditions.join(' AND ')})`)
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const safeOrderDir = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    let orderClause: string
    if (orderBy === 'stock') {
      orderClause = `ORDER BY p.stock ${safeOrderDir}, COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC, p.id ASC`
    } else if (orderBy === 'sale_price') {
      orderClause = `ORDER BY p.sale_price ${safeOrderDir}, COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC, p.id ASC`
    } else {
      // Orden alfabético según el producto padre (o simple), con el padre variable primero, y luego sus variaciones
      orderClause = `ORDER BY COALESCE(parent.search_name, p.search_name) ${safeOrderDir}, CASE WHEN p.product_type = 'variable' THEN 0 ELSE 1 END ASC, p.search_name ${safeOrderDir}, p.id ASC`
    }

    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        pc.name AS parent_category_name,
        parent.name AS parent_name,
        (SELECT COUNT(*) FROM products v WHERE v.parent_id = p.id AND v.active = 1) AS variations_count,
        (
          SELECT GROUP_CONCAT(s.id || ':' || s.name, ';;')
          FROM product_suppliers ps
          JOIN suppliers s ON s.id = ps.supplier_id
          WHERE ps.product_id = p.id OR (p.parent_id IS NOT NULL AND ps.product_id = p.parent_id)
        ) AS raw_suppliers
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN products parent ON p.parent_id = parent.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `

    params.push(limit, offset)

    const rows = this.db.prepare(sql).all(...params) as any[]

    return rows.map((row) => {
      let suppliers: { id: number; name: string }[] = []
      if (row.raw_suppliers) {
        suppliers = String(row.raw_suppliers)
          .split(';;')
          .map((pair) => {
            const [idStr, ...nameParts] = pair.split(':')
            return { id: Number(idStr), name: nameParts.join(':') }
          })

        // Remove duplicate suppliers if both parent and child had them
        const seen = new Set<number>()
        suppliers = suppliers.filter((s) => {
          if (seen.has(s.id)) return false
          seen.add(s.id)
          return true
        })
      }
      delete row.raw_suppliers
      row.suppliers = suppliers

      const catName = row.category_name || (row.parent_id ? row.parent_category_name : null) || ''
      const suppNames = suppliers.map((s) => s.name).join(' / ')
      if (catName && suppNames) {
        row.category_display = `${catName} - ${suppNames}`
      } else if (catName) {
        row.category_display = catName
      } else if (suppNames) {
        row.category_display = suppNames
      } else {
        row.category_display = 'Sin Categoría'
      }

      return row as ProductSearchResult
    })
  }

  seedSampleData(): void {
    const existingCount = this.db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get() as { count: number }
    if (existingCount.count > 0) {
      return // Don't duplicate if already seeded
    }

    // Categorías de 2 niveles
    const deptoUkryl = this.saveCategory('Ukryl', null)
    const subcatLanas = this.saveCategory('Lanas', deptoUkryl.id)
    const subcatHilos = this.saveCategory('Hilos', deptoUkryl.id)

    const deptoAccesorios = this.saveCategory('Accesorios', null)
    const subcatAgujas = this.saveCategory('Agujas y Crochet', deptoAccesorios.id)
    const subcatEstuches = this.saveCategory('Estuches', deptoAccesorios.id)

    // Producto Variable 1: Algodón Rústico con sus variaciones por Color
    this.saveVariableProduct(
      {
        name: 'Algodón Rústico',
        product_type: 'variable',
        category_id: subcatHilos.id,
        attribute_name: 'Color'
      },
      [
        {
          code: '7801001',
          name: 'Algodón negro',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Negro',
          sale_price: 3500,
          cost_price: 2100,
          category_id: subcatHilos.id,
          stock: 45,
          min_stock: 10
        },
        {
          code: '7801002',
          name: 'Algodón azul',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Azul',
          sale_price: 3500,
          cost_price: 2100,
          category_id: subcatHilos.id,
          stock: 30,
          min_stock: 10
        },
        {
          code: '7801003',
          name: 'Algodón natural',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Natural',
          sale_price: 3500,
          cost_price: 2100,
          category_id: subcatHilos.id,
          stock: 55,
          min_stock: 10
        },
        {
          code: '7801004',
          name: 'Algodón premium negro',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Premium Negro',
          sale_price: 4990,
          cost_price: 3000,
          category_id: subcatHilos.id,
          stock: 18,
          min_stock: 5
        }
      ]
    )

    // Producto Variable 2: Lana Merino con sus variaciones por Color
    this.saveVariableProduct(
      {
        name: 'Lana Merino',
        product_type: 'variable',
        category_id: subcatLanas.id,
        attribute_name: 'Color'
      },
      [
        {
          code: '7801006',
          name: 'Lana negro',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Negro',
          sale_price: 5990,
          cost_price: 3800,
          category_id: subcatLanas.id,
          stock: 25,
          min_stock: 5
        },
        {
          code: '7801010',
          name: 'Lana Merino Blanco',
          product_type: 'variation',
          attribute_name: 'Color',
          attribute_value: 'Blanco',
          sale_price: 5990,
          cost_price: 3800,
          category_id: subcatLanas.id,
          stock: 4,
          min_stock: 10
        }
      ]
    )

    // Productos Simples
    const simpleSamples: ProductInput[] = [
      {
        code: '7801005',
        name: 'Algodón económico negro barato',
        product_type: 'simple',
        sale_price: 2500,
        cost_price: 1500,
        category_id: subcatHilos.id,
        stock: 80,
        min_stock: 15
      },
      {
        code: '7801007',
        name: 'Hilo negro',
        product_type: 'simple',
        sale_price: 1990,
        cost_price: 1100,
        category_id: subcatHilos.id,
        stock: 100,
        min_stock: 20
      },
      {
        code: '7801008',
        name: 'Estuche de algodón',
        product_type: 'simple',
        sale_price: 7990,
        cost_price: 4500,
        category_id: subcatEstuches.id,
        stock: 12,
        min_stock: 3
      },
      {
        code: '7801009',
        name: 'Crochet Aluminio 4.0mm',
        product_type: 'simple',
        sale_price: 2200,
        cost_price: 1200,
        category_id: subcatAgujas.id,
        stock: 40,
        min_stock: 8
      },
      {
        code: '7801011',
        name: 'Aguja Circular 80cm 5.0mm',
        product_type: 'simple',
        sale_price: 3490,
        cost_price: 1900,
        category_id: subcatAgujas.id,
        stock: 0,
        min_stock: 5
      }
    ]

    for (const s of simpleSamples) {
      this.upsertProduct(s)
    }
  }
}
