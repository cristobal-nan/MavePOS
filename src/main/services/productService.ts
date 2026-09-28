import Database from 'better-sqlite3'
import { Category, Product, ProductInput, ProductSearchResult, ProductSearchOptions } from '../../shared/types'
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

  getProductByCode(code: string, includeInactive = false): Product | null {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE code = ?'
      : 'SELECT * FROM products WHERE code = ? AND active = 1'
    const row = this.db.prepare(query).get(code) as Product | undefined
    return row || null
  }

  getProductById(id: number, includeInactive = false): Product | null {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE id = ?'
      : 'SELECT * FROM products WHERE id = ? AND active = 1'
    const row = this.db.prepare(query).get(id) as Product | undefined
    return row || null
  }

  getVariations(parentId: number, includeInactive = false): Product[] {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE parent_id = ? ORDER BY id ASC'
      : 'SELECT * FROM products WHERE parent_id = ? AND active = 1 ORDER BY id ASC'
    return this.db.prepare(query).all(parentId) as Product[]
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

    const searchName = normalizeSearchName(trimmedName)
    const now = new Date().toISOString()

    let existing: Product | undefined
    if (input.id) {
      existing = this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as Product | undefined
    } else if (trimmedCode) {
      existing = this.db.prepare('SELECT * FROM products WHERE code = ?').get(trimmedCode) as Product | undefined
    }

    if (existing) {
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
        existing.id
      )
      return this.getProductById(existing.id!, true)!
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
      return this.getProductById(Number(result.lastInsertRowid), true)!
    }
  }

  saveVariableProduct(
    parentInput: ProductInput,
    variationsInput: ProductInput[]
  ): { parent: Product; variations: Product[] } {
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

      this.db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(now, prod.id)
      if (prod.product_type === 'variable') {
        this.db.prepare('UPDATE products SET active = 0, updated_at = ? WHERE parent_id = ?').run(now, prod.id)
      }
      return true
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

    // Product Type filter
    if (productType) {
      conditions.push('p.product_type = ?')
      params.push(productType)
    }

    // Parent product filter (for getting variations of a specific product)
    if (parentId !== null && parentId !== undefined) {
      conditions.push('p.parent_id = ?')
      params.push(parentId)
    }

    // Only sellable products filter (simple + variations, excluding variable parents)
    if (onlySellable) {
      conditions.push("p.product_type IN ('simple', 'variation')")
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
          nameConditions.push("p.search_name LIKE ? ESCAPE '\\'")
          params.push(pattern)
        })

        // Also check if raw query matches code literally (Section 5.3)
        if (!rawInput.includes('%')) {
          conditions.push(`(${nameConditions.join(' AND ')} OR p.code = ?)`)
          params.push(rawInput.trim())
        } else {
          conditions.push(`(${nameConditions.join(' AND ')})`)
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Allowed sort columns
    const safeOrderBy = ['name', 'stock', 'sale_price'].includes(orderBy) ? `p.${orderBy}` : 'p.name'
    const safeOrderDir = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const sql = `
      SELECT
        p.*,
        c.name AS category_name,
        pc.name AS parent_category_name,
        parent.name AS parent_name,
        (SELECT COUNT(*) FROM products v WHERE v.parent_id = p.id AND v.active = 1) AS variations_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN products parent ON p.parent_id = parent.id
      ${whereClause}
      ORDER BY ${safeOrderBy} ${safeOrderDir}
      LIMIT ? OFFSET ?
    `

    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as ProductSearchResult[]
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
