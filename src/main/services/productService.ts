import Database from 'better-sqlite3'
import { Category, Family, Product, ProductInput, ProductSearchResult, ProductSearchOptions } from '../../shared/types'
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
    // If deleted, children will have parent_id set to null via foreign key ON DELETE SET NULL
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  }

  // ----------------------------------------------------
  // Families
  // ----------------------------------------------------

  getAllFamilies(): Family[] {
    const stmt = this.db.prepare('SELECT * FROM families ORDER BY name ASC')
    return stmt.all() as Family[]
  }

  saveFamily(name: string, categoryId: number | null = null, id?: number): Family {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('El nombre de la familia no puede estar vacío')
    }

    const now = new Date().toISOString()
    if (id) {
      this.db
        .prepare('UPDATE families SET name = ?, category_id = ? WHERE id = ?')
        .run(trimmedName, categoryId, id)
      const updated = this.db.prepare('SELECT * FROM families WHERE id = ?').get(id) as Family
      return updated
    } else {
      const result = this.db
        .prepare('INSERT INTO families (name, category_id, created_at) VALUES (?, ?, ?)')
        .run(trimmedName, categoryId, now)
      return { id: Number(result.lastInsertRowid), name: trimmedName, category_id: categoryId, created_at: now }
    }
  }

  deleteFamily(id: number): void {
    this.db.prepare('DELETE FROM families WHERE id = ?').run(id)
  }

  // ----------------------------------------------------
  // Products (Upsert, Soft Delete, Retrieval)
  // ----------------------------------------------------

  getProductByCode(code: string, includeInactive = false): Product | null {
    const query = includeInactive
      ? 'SELECT * FROM products WHERE code = ?'
      : 'SELECT * FROM products WHERE code = ? AND active = 1'
    const row = this.db.prepare(query).get(code) as Product | undefined
    return row || null
  }

  upsertProduct(input: ProductInput): Product {
    const trimmedCode = input.code.trim()
    const trimmedName = input.name.trim()

    if (!trimmedCode) {
      throw new Error('El código de producto no puede estar vacío')
    }
    if (!trimmedName) {
      throw new Error('El nombre de producto no puede estar vacío')
    }
    if (input.sale_price < 0 || !Number.isInteger(input.sale_price)) {
      throw new Error('El precio de venta debe ser un entero positivo en CLP')
    }

    const searchName = normalizeSearchName(trimmedName)
    const now = new Date().toISOString()
    const costPrice = input.cost_price !== undefined ? input.cost_price : null
    const stock = input.stock !== undefined ? input.stock : 0
    const minStock = input.min_stock !== undefined ? input.min_stock : 0
    const categoryId = input.category_id || null
    const familyId = input.family_id || null
    const variantLabel = input.variant_label ? input.variant_label.trim() : null

    const existing = this.db.prepare('SELECT * FROM products WHERE code = ?').get(trimmedCode) as Product | undefined

    if (existing) {
      this.db.prepare(`
        UPDATE products SET
          name = ?,
          search_name = ?,
          sale_price = ?,
          cost_price = ?,
          category_id = ?,
          family_id = ?,
          variant_label = ?,
          stock = ?,
          min_stock = ?,
          active = 1,
          updated_at = ?
        WHERE code = ?
      `).run(
        trimmedName,
        searchName,
        input.sale_price,
        costPrice,
        categoryId,
        familyId,
        variantLabel,
        stock,
        minStock,
        now,
        trimmedCode
      )
    } else {
      this.db.prepare(`
        INSERT INTO products (
          code, name, search_name, sale_price, cost_price,
          category_id, family_id, variant_label,
          stock, min_stock, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        trimmedCode,
        trimmedName,
        searchName,
        input.sale_price,
        costPrice,
        categoryId,
        familyId,
        variantLabel,
        stock,
        minStock,
        now,
        now
      )
    }

    return this.getProductByCode(trimmedCode, true)!
  }

  softDeleteProduct(code: string): boolean {
    const now = new Date().toISOString()
    const result = this.db
      .prepare('UPDATE products SET active = 0, updated_at = ? WHERE code = ?')
      .run(now, code)
    return result.changes > 0
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
      familyId = null,
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

    // Category filter: match either direct category or subcategory of parent category
    if (categoryId !== null && categoryId !== undefined) {
      conditions.push('(p.category_id = ? OR c.parent_id = ?)')
      params.push(categoryId, categoryId)
    }

    // Family filter
    if (familyId !== null && familyId !== undefined) {
      conditions.push('p.family_id = ?')
      params.push(familyId)
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
        f.name AS family_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN families f ON p.family_id = f.id
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

    // Familias
    const famAlgodon = this.saveFamily('Algodón Rústico', subcatHilos.id)
    const famMerino = this.saveFamily('Lana Merino', subcatLanas.id)

    // Catálogo de muestra completo
    const samples: ProductInput[] = [
      {
        code: '7801001',
        name: 'Algodón negro',
        sale_price: 3500,
        cost_price: 2100,
        category_id: subcatHilos.id,
        family_id: famAlgodon.id,
        variant_label: 'Negro',
        stock: 45,
        min_stock: 10
      },
      {
        code: '7801002',
        name: 'Algodón azul',
        sale_price: 3500,
        cost_price: 2100,
        category_id: subcatHilos.id,
        family_id: famAlgodon.id,
        variant_label: 'Azul',
        stock: 30,
        min_stock: 10
      },
      {
        code: '7801003',
        name: 'Algodón natural',
        sale_price: 3500,
        cost_price: 2100,
        category_id: subcatHilos.id,
        family_id: famAlgodon.id,
        variant_label: 'Natural',
        stock: 55,
        min_stock: 10
      },
      {
        code: '7801004',
        name: 'Algodón premium negro',
        sale_price: 4990,
        cost_price: 3000,
        category_id: subcatHilos.id,
        family_id: famAlgodon.id,
        variant_label: 'Premium Negro',
        stock: 18,
        min_stock: 5
      },
      {
        code: '7801005',
        name: 'Algodón económico negro barato',
        sale_price: 2500,
        cost_price: 1500,
        category_id: subcatHilos.id,
        stock: 80,
        min_stock: 15
      },
      {
        code: '7801006',
        name: 'Lana negro',
        sale_price: 5990,
        cost_price: 3800,
        category_id: subcatLanas.id,
        family_id: famMerino.id,
        variant_label: 'Negro',
        stock: 25,
        min_stock: 5
      },
      {
        code: '7801007',
        name: 'Hilo negro',
        sale_price: 1990,
        cost_price: 1100,
        category_id: subcatHilos.id,
        stock: 100,
        min_stock: 20
      },
      {
        code: '7801008',
        name: 'Estuche de algodón',
        sale_price: 7990,
        cost_price: 4500,
        category_id: subcatEstuches.id,
        stock: 12,
        min_stock: 3
      },
      {
        code: '7801009',
        name: 'Crochet Aluminio 4.0mm',
        sale_price: 2200,
        cost_price: 1200,
        category_id: subcatAgujas.id,
        stock: 40,
        min_stock: 8
      },
      {
        code: '7801010',
        name: 'Lana Merino Blanco',
        sale_price: 5990,
        cost_price: 3800,
        category_id: subcatLanas.id,
        family_id: famMerino.id,
        variant_label: 'Blanco',
        stock: 4,
        min_stock: 10
      },
      {
        code: '7801011',
        name: 'Aguja Circular 80cm 5.0mm',
        sale_price: 3490,
        cost_price: 1900,
        category_id: subcatAgujas.id,
        stock: 0,
        min_stock: 5
      }
    ]

    for (const s of samples) {
      this.upsertProduct(s)
    }
  }
}
