import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runMigrations } from '../main/db/migrations'
import { ExcelService } from '../main/services/excelService'
import { ProductService } from '../main/services/productService'

describe('Fase 10: Importación de Catálogo desde Excel (.xlsx)', () => {
  let db: Database.Database
  let excelService: ExcelService
  let productService: ProductService
  let tempFilePath: string

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    excelService = new ExcelService(db)
    productService = new ProductService(db)
    tempFilePath = path.join(os.tmpdir(), `test_catalog_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`)
  })

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath)
      } catch {
        // ignore
      }
    }
  })

  const createTestWorkbook = (rows: any[][]): void => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.writeFile(wb, tempFilePath)
  }

  describe('Detección y Previsualización (parseExcelFile)', () => {
    it('detecta encabezados estándar y mapea columnas con acentos y variaciones de mayúsculas', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento', 'P. Mayoreo', 'Inv. Máximo'],
        ['780100', 'Hilo Algodón Premium', '1500', '3500', '45', '10', 'Lanas e Hilos', '3000', '100'],
        ['780200', 'Tijera Zigzag', '2000', '4990', '12', '3', 'Costura y Mercería', '4500', '50']
      ])

      const preview = excelService.parseExcelFile(tempFilePath)

      expect(preview.fileName).toBe(path.basename(tempFilePath))
      expect(preview.totalRows).toBe(2)
      expect(preview.detectedMapping.code).toBe('Código')
      expect(preview.detectedMapping.name).toBe('Producto')
      expect(preview.detectedMapping.cost_price).toBe('P. Costo')
      expect(preview.detectedMapping.sale_price).toBe('P. Venta')
      expect(preview.detectedMapping.stock).toBe('Existencia')
      expect(preview.detectedMapping.min_stock).toBe('Inv. Mínimo')
      expect(preview.detectedMapping.department).toBe('Departamento')
      expect(preview.previewRows).toHaveLength(2)
      expect(preview.previewRows[0]['Código']).toBe('780100')
      expect(preview.previewRows[0]['Producto']).toBe('Hilo Algodón Premium')
    })

    it('detecta encabezados alternativos en minúsculas y sin puntos', () => {
      createTestWorkbook([
        ['codigo', 'descripcion', 'costo', 'precio', 'stock', 'stock_minimo', 'categoria'],
        ['LAN-001', 'Lana Sirena Multicolor', 1800, 4200, 30, 5, 'Lanas'],
        ['AGU-002', 'Crochet Ergonómico 4mm', 1200, 2500, 25, 4, 'Herramientas']
      ])

      const preview = excelService.parseExcelFile(tempFilePath)

      expect(preview.totalRows).toBe(2)
      expect(preview.detectedMapping.code).toBe('codigo')
      expect(preview.detectedMapping.name).toBe('descripcion')
      expect(preview.detectedMapping.cost_price).toBe('costo')
      expect(preview.detectedMapping.sale_price).toBe('precio')
      expect(preview.detectedMapping.stock).toBe('stock')
      expect(preview.detectedMapping.min_stock).toBe('stock_minimo')
      expect(preview.detectedMapping.department).toBe('categoria')
    })

    it('omite filas vacías iniciales antes de los encabezados', () => {
      createTestWorkbook([
        [], // fila vacía 1
        ['Lista de Precios 2026'], // título no tabular
        ['Código', 'Producto', 'P. Venta', 'Existencia'],
        ['COD-1', 'Producto 1', '1000', '10']
      ])

      const preview = excelService.parseExcelFile(tempFilePath)

      expect(preview.totalRows).toBe(1)
      expect(preview.detectedMapping.code).toBe('Código')
      expect(preview.detectedMapping.name).toBe('Producto')
      expect(preview.detectedMapping.sale_price).toBe('P. Venta')
      expect(preview.detectedMapping.stock).toBe('Existencia')
    })
  })

  describe('Importación y Upsert en Base de Datos (importExcel)', () => {
    it('crea nuevos productos, crea departamentos de nivel 1 y registra movimiento de importación', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['780999', 'Bastidor de Bambú 20cm', '1200', '3200', '15', '4', 'Bordado'],
        ['780888', 'Set de Agujas Laneras', '800', '1990', '40', '10', 'Accesorios']
      ])

      const report = excelService.importExcel(tempFilePath)

      expect(report.totalRows).toBe(2)
      expect(report.createdCount).toBe(2)
      expect(report.updatedCount).toBe(0)
      expect(report.skippedCount).toBe(0)
      expect(report.departmentsCreated).toBe(2)

      // Verificar producto en BD
      const prod = productService.getProductByCode('780999')
      expect(prod).not.toBeNull()
      expect(prod?.name).toBe('Bastidor de Bambú 20cm')
      expect(prod?.sale_price).toBe(3200)
      expect(prod?.cost_price).toBe(1200)
      expect(prod?.stock).toBe(15)
      expect(prod?.min_stock).toBe(4)
      expect(prod?.product_type).toBe('simple')
      expect(prod?.active).toBe(1)

      // Verificar departamento de nivel 1 creado
      const dept = db.prepare('SELECT * FROM categories WHERE name = ?').get('Bordado') as any
      expect(dept).toBeDefined()
      expect(dept.parent_id).toBeNull()
      expect(prod?.category_id).toBe(dept.id)

      // Verificar kardex / inventory_movements
      const movements = db.prepare('SELECT * FROM inventory_movements WHERE product_code = ?').all(prod!.code) as any[]
      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('importacion')
      expect(movements[0].delta).toBe(15)
      expect(movements[0].reason).toContain('importación')
    })

    it('actualiza productos existentes por código (upsert), reemplazando stock y calculando delta', () => {
      // Creamos un producto inicial con stock 20
      productService.upsertProduct({
        code: '780100',
        name: 'Hilo Algodón Antiguo',
        sale_price: 3000,
        cost_price: 1000,
        stock: 20,
        min_stock: 5
      })

      // Excel con nueva existencia = 50 y nuevo precio de venta = 3500
      createTestWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['780100', 'Hilo Algodón Premium 2026', '1200', '3500', '50', '10', 'Lanas']
      ])

      const report = excelService.importExcel(tempFilePath)

      expect(report.totalRows).toBe(1)
      expect(report.createdCount).toBe(0)
      expect(report.updatedCount).toBe(1)
      expect(report.skippedCount).toBe(0)

      const prod = productService.getProductByCode('780100')
      expect(prod?.name).toBe('Hilo Algodón Premium 2026')
      expect(prod?.sale_price).toBe(3500)
      expect(prod?.stock).toBe(50)
      expect(prod?.min_stock).toBe(10)

      // Verificar movimiento de inventario con delta = 30 (50 - 20)
      const movements = db.prepare(
        'SELECT * FROM inventory_movements WHERE product_code = ? AND type = ?'
      ).all(prod!.code, 'importacion') as any[]

      expect(movements).toHaveLength(1)
      expect(movements[0].delta).toBe(30)
    })

    it('ignora columnas P. Mayoreo e Inv. Máximo según especificación acordada', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'P. Venta', 'Existencia', 'P. Mayoreo', 'Inv. Máximo'],
        ['MAY-01', 'Lana Gruesa Por Mayor', '5000', '100', '4200', '200']
      ])

      const report = excelService.importExcel(tempFilePath)
      expect(report.createdCount).toBe(1)

      const prod = productService.getProductByCode('MAY-01')
      expect(prod?.sale_price).toBe(5000)
      expect(prod?.stock).toBe(100)
    })

    it('maneja filas con errores o campos obligatorios faltantes sin cancelar toda la transacción', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'P. Venta', 'Existencia'],
        ['', 'Sin Código', '2500', '10'], // Error: sin código
        ['VALID-1', 'Producto Válido', '4000', '15'],
        ['VALID-2', '', '5000', '20'] // Error: sin nombre
      ])

      const report = excelService.importExcel(tempFilePath)

      expect(report.totalRows).toBe(3)
      expect(report.createdCount).toBe(1)
      expect(report.skippedCount).toBe(2)
      expect(report.errors).toHaveLength(2)
      expect(report.errors[0].reason.toLowerCase()).toContain('código')
      expect(report.errors[1].reason.toLowerCase()).toContain('nombre')

      // El producto válido sí fue insertado
      expect(productService.getProductByCode('VALID-1')).not.toBeNull()
    })

    it('soporta códigos de barra numéricos leídos como números en Excel', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'P. Venta', 'Existencia'],
        [7801234567890, 'Código de Barra Numérico', 2990, 8]
      ])

      const report = excelService.importExcel(tempFilePath)
      expect(report.createdCount).toBe(1)

      const prod = productService.getProductByCode('7801234567890')
      expect(prod).not.toBeNull()
      expect(prod?.name).toBe('Código de Barra Numérico')
    })
  })
})
