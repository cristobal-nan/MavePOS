import path from 'path'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import {
  ExcelColumnMapping,
  ExcelParsePreview,
  ImportReportResult,
  ImportErrorDetail
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
      department: ['DEPARTAMENTO', 'DEPTO', 'CATEGORIA', 'CATEGORÍA', 'RUBRO', 'FAMILIA', 'SECCION', 'SECCIÓN', 'CATEGORY']
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

      // 2. Prepared statements
      const insertCategoryStmt = this.db.prepare(`
        INSERT INTO categories (name, parent_id)
        VALUES (?, NULL)
      `)

      const findProductStmt = this.db.prepare(`
        SELECT id, stock, sale_price, cost_price, min_stock, category_id
        FROM products
        WHERE code = ?
      `)

      const insertProductStmt = this.db.prepare(`
        INSERT INTO products (
          code, name, search_name, product_type, parent_id, attribute_name, attribute_value,
          sale_price, cost_price, category_id, stock, min_stock, active, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'simple', NULL, NULL, NULL,
          ?, ?, ?, ?, ?, 1, ?, ?
        )
      `)

      const updateProductStmt = this.db.prepare(`
        UPDATE products SET
          name = ?,
          search_name = ?,
          sale_price = ?,
          cost_price = ?,
          category_id = ?,
          stock = ?,
          min_stock = ?,
          active = 1,
          updated_at = ?
        WHERE id = ?
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

        const searchName = normalizeSearchName(name)
        const existing = findProductStmt.get(code) as { id: number; stock: number } | undefined

        if (existing) {
          // Update existing product
          updateProductStmt.run(
            name,
            searchName,
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
          insertProductStmt.run(
            code,
            name,
            searchName,
            salePrice,
            costPrice,
            categoryId,
            stock,
            minStock,
            now,
            now
          )

          // Record initial inventory movement
          if (stock !== 0) {
            insertMovementStmt.run(code, stock, 'Carga inicial por importación Excel', now)
          }

          createdCount++
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
}
