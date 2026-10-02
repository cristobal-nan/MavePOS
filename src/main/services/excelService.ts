import path from 'path'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import {
  ExcelColumnMapping,
  ExcelParsePreview,
  ImportReportResult,
  ImportErrorDetail,
  ExportExcelResult
} from '../../shared/types'
import { normalizeSearchName } from '../db/utils'

export class ExcelService {
  constructor(private db: Database.Database) {}

  /**
   * Reads an Excel file and returns preview data along with automatically detected column mapping.
   */
  parseExcelFile(filePath: string): ExcelParsePreview {
    const workbook = XLSX.readFile(filePath, {
      type: 'file',
      cellDates: false,
      raw: false // Ensures values are read as formatted text (avoids scientific notation for barcodes)
    })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.')
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' })

    if (rawRows.length === 0) {
      throw new Error('La hoja de cálculo está vacía.')
    }

    // Find the header row (first row with at least 2 non-empty strings)
    let headerRowIndex = -1
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i]
      if (Array.isArray(row)) {
        const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
        if (nonEmpty.length >= 2) {
          headerRowIndex = i
          break
        }
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('No se encontraron encabezados válidos en las primeras filas del archivo Excel.')
    }

    const headerRow = rawRows[headerRowIndex] as any[]
    const headers: string[] = headerRow
      .map((h) => String(h || '').trim())
      .filter((h) => h !== '')

    const detectedMapping = this.detectColumnMapping(headers)

    // Build preview rows (first 10 data rows)
    const previewRows: Record<string, any>[] = []
    const totalDataRows = Math.max(0, rawRows.length - (headerRowIndex + 1))

    for (let r = headerRowIndex + 1; r < rawRows.length && previewRows.length < 10; r++) {
      const row = rawRows[r] as any[]
      if (!row || row.length === 0) continue

      const hasContent = row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
      if (!hasContent) continue

      const rowObj: Record<string, any> = {}
      for (let c = 0; c < headers.length; c++) {
        const headerName = headers[c]
        rowObj[headerName] = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : ''
      }
      previewRows.push(rowObj)
    }

    return {
      fileName: path.basename(filePath),
      sheetName,
      totalRows: totalDataRows,
      headers,
      detectedMapping,
      previewRows
    }
  }

  /**
   * Automatically detects mapping from headers based on common Spanish/English naming conventions.
   */
  private detectColumnMapping(headers: string[]): Partial<ExcelColumnMapping> {
    const mapping: Partial<ExcelColumnMapping> = {}

    const ALIASES: Record<keyof ExcelColumnMapping, string[]> = {
      code: ['CODIGO', 'CÓDIGO', 'COD', 'BARCODE', 'CODE', 'BARRA', 'CODIGO DE BARRA', 'CÓDIGO DE BARRA', 'COD. BARRA'],
      name: ['PRODUCTO', 'NOMBRE', 'DESCRIPCION', 'DESCRIPCIÓN', 'ITEM', 'NAME', 'ARTICULO', 'ARTÍCULO', 'DETALLE'],
      cost_price: ['P. COSTO', 'P.COSTO', 'P COSTO', 'COSTO', 'PRECIO COSTO', 'COST PRICE', 'COST'],
      sale_price: ['P. VENTA', 'P.VENTA', 'P VENTA', 'VENTA', 'PRECIO VENTA', 'PRECIO', 'SALE PRICE', 'PRICE'],
      min_stock: ['INV. MINIMO', 'INV. MÍNIMO', 'INV.MINIMO', 'INV MINIMO', 'MINIMO', 'MÍNIMO', 'STOCK MINIMO', 'STOCK MÍNIMO', 'MIN STOCK', 'STOCK_MINIMO'],
      stock: ['EXISTENCIA', 'STOCK', 'CANTIDAD', 'CANT', 'QTY', 'INVENTARIO', 'ACTUAL'],
      department: ['DEPARTAMENTO', 'DEPTO', 'CATEGORIA', 'CATEGORÍA', 'RUBRO', 'FAMILIA', 'SECCION', 'SECCIÓN', 'CATEGORY'],
      product_type: ['TIPO', 'TIPO PRODUCTO', 'PRODUCT TYPE', 'TYPE'],
      parent_name: ['PRODUCTO PADRE', 'PADRE', 'PARENT', 'PRODUCTO_PADRE', 'PARENT PRODUCT'],
      attribute_name: ['ATRIBUTO', 'TIPO ATRIBUTO', 'ATTRIBUTE', 'NOMBRE ATRIBUTO'],
      attribute_value: ['VALOR ATRIBUTO', 'VALOR_ATRIBUTO', 'VALOR', 'ATTRIBUTE VALUE'],
      suppliers: ['PROVEEDORES', 'PROVEEDOR', 'SUPPLIERS', 'SUPPLIER']
    }

    const cleanHeader = (s: string): string =>
      normalizeSearchName(s)
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // Pass 1: Exact matches
    for (const h of headers) {
      const normalized = cleanHeader(h)

      for (const [key, aliases] of Object.entries(ALIASES) as [keyof ExcelColumnMapping, string[]][]) {
        if (!mapping[key]) {
          const match = aliases.some((a) => cleanHeader(a) === normalized)
          if (match) {
            mapping[key] = h
            break
          }
        }
      }
    }

    // Pass 2: Prefix matches for unassigned keys
    for (const h of headers) {
      // Do not reuse headers already assigned to an exact match
      const isAlreadyAssigned = Object.values(mapping).includes(h)
      if (isAlreadyAssigned) continue

      const normalized = cleanHeader(h)

      for (const [key, aliases] of Object.entries(ALIASES) as [keyof ExcelColumnMapping, string[]][]) {
        if (!mapping[key]) {
          const match = aliases.some((a) => normalized.startsWith(cleanHeader(a)))
          if (match) {
            mapping[key] = h
            break
          }
        }
      }
    }

    return mapping
  }

  /**
   * Imports products from an Excel file into the SQLite database.
   * Runs in a single WAL transaction for ultra-fast processing (10.000+ rows in ~2s).
   */
  importExcel(filePath: string, customMapping?: Partial<ExcelColumnMapping>): ImportReportResult {
    const workbook = XLSX.readFile(filePath, {
      type: 'file',
      cellDates: false,
      raw: false
    })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.')
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

    if (rawRows.length === 0) {
      throw new Error('La hoja de cálculo está vacía.')
    }

    // Find header row
    let headerRowIndex = -1
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i]
      if (Array.isArray(row)) {
        const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
        if (nonEmpty.length >= 2) {
          headerRowIndex = i
          break
        }
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('No se encontraron encabezados válidos en las primeras filas del archivo Excel.')
    }

    const headerRow = rawRows[headerRowIndex] as any[]
    const headers: string[] = headerRow.map((h) => String(h || '').trim())
    const detected = this.detectColumnMapping(headers)
    const mapping: Partial<ExcelColumnMapping> = { ...detected, ...(customMapping || {}) }

    // Validate essential mappings
    if (!mapping.code) throw new Error('No se identificó la columna para "Código" de producto.')
    if (!mapping.name) throw new Error('No se identificó la columna para "Producto" (nombre).')
    if (!mapping.sale_price) throw new Error('No se identificó la columna para "P. Venta" (precio de venta).')
    if (!mapping.stock) throw new Error('No se identificó la columna para "Existencia" (stock).')

    // Find column indices
    const codeIdx = headers.indexOf(mapping.code)
    const nameIdx = headers.indexOf(mapping.name)
    const salePriceIdx = mapping.sale_price ? headers.indexOf(mapping.sale_price) : -1
    const costPriceIdx = mapping.cost_price ? headers.indexOf(mapping.cost_price) : -1
    const stockIdx = mapping.stock ? headers.indexOf(mapping.stock) : -1
    const minStockIdx = mapping.min_stock ? headers.indexOf(mapping.min_stock) : -1
    const deptIdx = mapping.department ? headers.indexOf(mapping.department) : -1
    const parentNameIdx = mapping.parent_name ? headers.indexOf(mapping.parent_name) : -1
    const attrNameIdx = mapping.attribute_name ? headers.indexOf(mapping.attribute_name) : -1
    const attrValIdx = mapping.attribute_value ? headers.indexOf(mapping.attribute_value) : -1
    const prodTypeIdx = mapping.product_type ? headers.indexOf(mapping.product_type) : -1
    const suppliersIdx = mapping.suppliers ? headers.indexOf(mapping.suppliers) : -1

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let departmentsCreated = 0
    const errors: ImportErrorDetail[] = []

    const now = new Date().toISOString()

    // Transaction execution
    const tx = this.db.transaction(() => {
      // 1. In-memory cache of root categories (normalized name -> id)
      const categoriesMap = new Map<string, number>()
      const existingCategories = this.db
        .prepare('SELECT id, name FROM categories WHERE parent_id IS NULL')
        .all() as { id: number; name: string }[]

      for (const cat of existingCategories) {
        categoriesMap.set(normalizeSearchName(cat.name), cat.id)
      }

      // Cache of variable products (normalized name -> id)
      const variablesMap = new Map<string, number>()
      const existingVariables = this.db
        .prepare("SELECT id, name FROM products WHERE product_type = 'variable' AND active = 1")
        .all() as { id: number; name: string }[]
      for (const v of existingVariables) {
        variablesMap.set(normalizeSearchName(v.name), v.id)
      }

      // Cache of suppliers (normalized name -> id)
      const suppliersMap = new Map<string, number>()
      const existingSuppliers = this.db
        .prepare('SELECT id, name FROM suppliers WHERE active = 1')
        .all() as { id: number; name: string }[]
      for (const s of existingSuppliers) {
        suppliersMap.set(normalizeSearchName(s.name), s.id)
      }

      // 2. Prepared statements
      const insertCategoryStmt = this.db.prepare(`
        INSERT INTO categories (name, parent_id)
        VALUES (?, NULL)
      `)

      const findProductStmt = this.db.prepare(`
        SELECT id, stock, sale_price, cost_price, min_stock, category_id, product_type, parent_id
        FROM products
        WHERE code = ?
      `)

      const insertVariableStmt = this.db.prepare(`
        INSERT INTO products (
          name, search_name, product_type, parent_id, attribute_name, attribute_value,
          sale_price, cost_price, category_id, stock, min_stock, active, created_at, updated_at
        ) VALUES (
          ?, ?, 'variable', NULL, ?, NULL,
          0, 0, ?, 0, 0, 1, ?, ?
        )
      `)

      const insertProductStmt = this.db.prepare(`
        INSERT INTO products (
          code, name, search_name, product_type, parent_id, attribute_name, attribute_value,
          sale_price, cost_price, category_id, stock, min_stock, active, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 1, ?, ?
        )
      `)

      const updateProductStmt = this.db.prepare(`
        UPDATE products SET
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
      `)

      const insertSupplierStmt = this.db.prepare(`
        INSERT INTO suppliers (name, search_name, active, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `)

      const linkProductSupplierStmt = this.db.prepare(`
        INSERT OR IGNORE INTO product_suppliers (product_id, supplier_id)
        VALUES (?, ?)
      `)

      const insertMovementStmt = this.db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
        VALUES (?, ?, 'importacion', ?, NULL, ?)
      `)

      // Helper to clean CLP currency numbers (removes $, dots, spaces)
      const parseCLP = (val: any, defaultVal = 0): number => {
        if (val === null || val === undefined || val === '') return defaultVal
        if (typeof val === 'number') return isNaN(val) ? defaultVal : Math.round(val)
        const cleaned = String(val).replace(/[^0-9-]/g, '')
        if (!cleaned || cleaned === '-') return defaultVal
        const num = parseInt(cleaned, 10)
        return isNaN(num) ? defaultVal : num
      }

      // 3. Process data rows
      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r] as any[]
        const rowNumber = r + 1

        if (!row || row.length === 0) continue

        // Skip completely empty rows
        const hasAnyValue = row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
        if (!hasAnyValue) continue

        // Extract code
        const rawCode = codeIdx >= 0 ? row[codeIdx] : undefined
        const code = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : ''

        if (!code) {
          errors.push({ row: rowNumber, reason: 'Fila omitida: Código de producto en blanco.' })
          skippedCount++
          continue
        }

        // Extract name
        const rawName = nameIdx >= 0 ? row[nameIdx] : undefined
        const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : ''

        if (!name) {
          errors.push({ row: rowNumber, code, reason: 'Fila omitida: Nombre del producto en blanco.' })
          skippedCount++
          continue
        }

        // Extract prices and stock
        const salePrice = Math.max(0, parseCLP(salePriceIdx >= 0 ? row[salePriceIdx] : 0, 0))
        const costPrice = costPriceIdx >= 0 && row[costPriceIdx] !== '' && row[costPriceIdx] !== null
          ? Math.max(0, parseCLP(row[costPriceIdx]))
          : null
        const stock = parseCLP(stockIdx >= 0 ? row[stockIdx] : 0, 0)
        const minStock = Math.max(0, parseCLP(minStockIdx >= 0 ? row[minStockIdx] : 0, 0))

        // Extract Department (Category Level 1)
        let categoryId: number | null = null
        if (deptIdx >= 0 && row[deptIdx]) {
          const deptName = String(row[deptIdx]).trim()
          if (deptName) {
            const searchDept = normalizeSearchName(deptName)
            if (categoriesMap.has(searchDept)) {
              categoryId = categoriesMap.get(searchDept)!
            } else {
              // Auto-create category level 1
              const catRes = insertCategoryStmt.run(deptName)
              const newCatId = Number(catRes.lastInsertRowid)
              categoriesMap.set(searchDept, newCatId)
              departmentsCreated++
              categoryId = newCatId
            }
          }
        }

        // Check if row is a variation or simple
        const rawParentName = parentNameIdx >= 0 ? row[parentNameIdx] : undefined
        const parentName = rawParentName !== undefined && rawParentName !== null ? String(rawParentName).trim() : ''
        const rawAttrName = attrNameIdx >= 0 ? row[attrNameIdx] : undefined
        const attrName = rawAttrName !== undefined && rawAttrName !== null ? String(rawAttrName).trim() : ''
        const rawAttrVal = attrValIdx >= 0 ? row[attrValIdx] : undefined
        const attrVal = rawAttrVal !== undefined && rawAttrVal !== null ? String(rawAttrVal).trim() : ''
        const rawProdType = prodTypeIdx >= 0 ? String(row[prodTypeIdx] || '').trim().toLowerCase() : ''
        const isVariation = parentName !== '' || rawProdType === 'variacion' || rawProdType === 'variation'

        let actualProductType: 'simple' | 'variation' = 'simple'
        let actualParentId: number | null = null
        let actualAttrName: string | null = null
        let actualAttrVal: string | null = null

        if (isVariation && parentName !== '') {
          actualProductType = 'variation'
          const normParent = normalizeSearchName(parentName)
          if (variablesMap.has(normParent)) {
            actualParentId = variablesMap.get(normParent)!
          } else {
            const varRes = insertVariableStmt.run(parentName, normParent, attrName || 'Variante', categoryId, now, now)
            actualParentId = Number(varRes.lastInsertRowid)
            variablesMap.set(normParent, actualParentId)
          }
          actualAttrName = attrName || 'Variante'
          actualAttrVal = attrVal || name
        }

        const searchName = normalizeSearchName(name)
        const existing = findProductStmt.get(code) as { id: number; stock: number; parent_id: number | null } | undefined
        let targetProductId: number

        if (existing) {
          targetProductId = existing.id
          // Update existing product
          updateProductStmt.run(
            name,
            searchName,
            actualProductType,
            actualParentId ?? existing.parent_id,
            actualAttrName,
            actualAttrVal,
            salePrice,
            costPrice,
            categoryId,
            stock,
            minStock,
            now,
            existing.id
          )

          // Record inventory movement if stock changed
          const delta = stock - existing.stock
          if (delta !== 0) {
            insertMovementStmt.run(code, delta, 'Importación Excel (reemplazo de existencia)', now)
          }

          updatedCount++
        } else {
          // Insert new product
          const insertRes = insertProductStmt.run(
            code,
            name,
            searchName,
            actualProductType,
            actualParentId,
            actualAttrName,
            actualAttrVal,
            salePrice,
            costPrice,
            categoryId,
            stock,
            minStock,
            now,
            now
          )
          targetProductId = Number(insertRes.lastInsertRowid)

          // Record initial inventory movement
          if (stock !== 0) {
            insertMovementStmt.run(code, stock, 'Carga inicial por importación Excel', now)
          }

          createdCount++
        }

        // Process suppliers if present
        const rawSuppliers = suppliersIdx >= 0 ? row[suppliersIdx] : undefined
        if (rawSuppliers) {
          const supplierNames = String(rawSuppliers)
            .split(/[\/,]/)
            .map((s) => s.trim())
            .filter((s) => s !== '')

          for (const sName of supplierNames) {
            const normSup = normalizeSearchName(sName)
            let sId: number
            if (suppliersMap.has(normSup)) {
              sId = suppliersMap.get(normSup)!
            } else {
              const sRes = insertSupplierStmt.run(sName, normSup, now, now)
              sId = Number(sRes.lastInsertRowid)
              suppliersMap.set(normSup, sId)
            }
            linkProductSupplierStmt.run(targetProductId, sId)
            if (actualParentId) {
              linkProductSupplierStmt.run(actualParentId, sId)
            }
          }
        }
      }
    })

    tx()

    const totalProcessed = createdCount + updatedCount + skippedCount

    return {
      totalRows: totalProcessed,
      createdCount,
      updatedCount,
      skippedCount,
      departmentsCreated,
      errors
    }
  }

  /**
   * Exports all active sellable products (simple and variation) to an Excel (.xlsx) file,
   * preserving internal structure (Tipo, Producto Padre, Atributo, Valor Atributo, Proveedores).
   */
  exportProducts(targetFilePath: string, productIds?: number[]): ExportExcelResult {
    let whereClause = "WHERE p.active = 1 AND p.product_type IN ('simple', 'variation')"
    const params: any[] = []

    if (productIds && productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',')
      whereClause += ` AND (p.id IN (${placeholders}) OR (p.parent_id IS NOT NULL AND p.parent_id IN (${placeholders})))`
      params.push(...productIds, ...productIds)
    }

    const products = this.db
      .prepare(`
        SELECT 
          p.id,
          p.code,
          p.name,
          p.product_type,
          p.parent_id,
          p.attribute_name,
          p.attribute_value,
          p.sale_price,
          p.cost_price,
          p.stock,
          p.min_stock,
          c.name AS category_name,
          parent_cat.name AS parent_category_name,
          parent.name AS parent_product_name,
          (
            SELECT GROUP_CONCAT(s.name, ' / ')
            FROM product_suppliers ps
            JOIN suppliers s ON s.id = ps.supplier_id
            WHERE ps.product_id = p.id OR (p.parent_id IS NOT NULL AND ps.product_id = p.parent_id)
          ) AS suppliers_list
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories parent_cat ON parent_cat.id = c.parent_id
        LEFT JOIN products parent ON parent.id = p.parent_id
        ${whereClause}
        ORDER BY COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC
      `)
      .all(...params) as any[]

    const rows = products.map((p) => {
      let categoryStr = ''
      if (p.parent_category_name && p.category_name) {
        categoryStr = `${p.parent_category_name} > ${p.category_name}`
      } else if (p.category_name) {
        categoryStr = p.category_name
      }

      return {
        Código: p.code !== null && p.code !== undefined ? String(p.code) : '',
        Producto: p.name || '',
        Tipo: p.product_type === 'variation' ? 'variacion' : 'simple',
        'Producto Padre': p.parent_product_name || '',
        Atributo: p.attribute_name || '',
        'Valor Atributo': p.attribute_value || '',
        'P. Costo': p.cost_price ?? 0,
        'P. Venta': p.sale_price,
        Existencia: p.stock,
        'Inv. Mínimo': p.min_stock,
        Categoría: categoryStr,
        Proveedores: p.suppliers_list || ''
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)

    // Formatear columna Código como texto explícito ('@') para no perder ceros a la izquierda en Excel
    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref'])
      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c: 0 })
        const cell = worksheet[cellAddress]
        if (cell) {
          cell.t = 's'
          cell.z = '@'
        }
      }
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')
    XLSX.writeFile(workbook, targetFilePath)

    return {
      filePath: targetFilePath,
      totalExported: products.length
    }
  }
}
