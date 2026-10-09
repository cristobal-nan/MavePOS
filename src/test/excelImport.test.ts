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

      const report = excelService.importExcel(tempFilePath, undefined, { duplicateCodeAction: 'allow_update' })

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

  describe('Exportación y Soporte de Variaciones y Proveedores en Excel', () => {
    it('exporta el catálogo completo a Excel preservando la estructura interna', () => {
      const cat = productService.saveCategory('Lanas')

      // 1. Producto simple
      productService.upsertProduct({
        code: 'SIMP-1',
        name: 'Palillo de Tejer 5mm',
        product_type: 'simple',
        sale_price: 2500,
        cost_price: 1200,
        stock: 30,
        min_stock: 5,
        category_id: cat.id
      })

      // 2. Producto variable con variaciones
      productService.saveVariableProduct(
        {
          name: 'Algodón Rústico',
          category_id: cat.id,
          attribute_name: 'Color'
        },
        [
          {
            code: 'VAR-ROJO',
            name: 'Algodón Rústico Rojo',
            attribute_value: 'Rojo',
            sale_price: 3500,
            cost_price: 2000,
            stock: 15,
            min_stock: 3
          }
        ]
      )

      const exportResult = excelService.exportProducts(tempFilePath)
      expect(exportResult.totalExported).toBe(2) // 1 simple + 1 variation (excluye padre variable del total vendible)

      // Leer el archivo generado para validar columnas y contenido
      const wb = XLSX.readFile(tempFilePath)
      expect(wb.SheetNames).toContain('Productos')
      const ws = wb.Sheets['Productos']
      const rows = XLSX.utils.sheet_to_json<any>(ws)

      expect(rows).toHaveLength(2)

      const simpleRow = rows.find((r) => r.Código === 'SIMP-1')
      expect(simpleRow).toBeDefined()
      expect(simpleRow.Tipo).toBe('simple')
      expect(simpleRow['P. Venta']).toBe(2500)
      expect(simpleRow.Existencia).toBe(30)
      expect(simpleRow.Categoría).toBe('Lanas')

      const varRow = rows.find((r) => r.Código === 'VAR-ROJO')
      expect(varRow).toBeDefined()
      expect(varRow.Tipo).toBe('variacion')
      expect(varRow['Producto Padre']).toBe('Algodón Rústico')
      expect(varRow.Atributo).toBe('Color')
      expect(varRow['Valor Atributo']).toBe('Rojo')
      expect(varRow['P. Venta']).toBe(3500)
      expect(varRow.Existencia).toBe(15)
    })

    it('importa archivo con columnas de variaciones y crea automáticamente el producto variable padre', () => {
      createTestWorkbook([
        ['Código', 'Producto', 'Tipo', 'Producto Padre', 'Atributo', 'Valor Atributo', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Categoría', 'Proveedores'],
        ['HIL-AZUL', 'Hilo Seda Azul', 'variacion', 'Hilo de Seda', 'Color', 'Azul', '1000', '2800', '20', '4', 'Costura', 'Proveedor Central'],
        ['HIL-VERDE', 'Hilo Seda Verde', 'variacion', 'Hilo de Seda', 'Color', 'Verde', '1000', '2800', '15', '4', 'Costura', 'Proveedor Central / Distribuidora Sur']
      ])

      const report = excelService.importExcel(tempFilePath)
      expect(report.createdCount).toBe(2)

      // Comprobar que se creó el padre variable 'Hilo de Seda'
      const parentVar = db.prepare("SELECT * FROM products WHERE product_type = 'variable' AND search_name = 'HILO DE SEDA'").get() as any
      expect(parentVar).toBeDefined()
      expect(parentVar.name).toBe('Hilo de Seda')

      // Comprobar que las variaciones están asociadas al padre
      const varAzul = productService.getProductByCode('HIL-AZUL')
      expect(varAzul).not.toBeNull()
      expect(varAzul?.parent_id).toBe(parentVar.id)
      expect(varAzul?.product_type).toBe('variation')
      expect(varAzul?.attribute_value).toBe('Azul')

      // Comprobar proveedores asociados
      const suppliers = db.prepare(`
        SELECT s.name FROM product_suppliers ps
        JOIN suppliers s ON s.id = ps.supplier_id
        WHERE ps.product_id = ?
      `).all(varAzul?.id) as { name: string }[]

      expect(suppliers.map((s) => s.name)).toContain('Proveedor Central')
    })
  })

  describe('Exportación de Productos (exportProducts)', () => {
    it('exporta catálogo completo o filtrado por productIds seleccionados', () => {
      const p1 = productService.upsertProduct({
        code: '00123',
        name: 'Producto Uno',
        sale_price: 1000,
        cost_price: 500,
        stock: 10
      })
      const p2 = productService.upsertProduct({
        code: '00456',
        name: 'Producto Dos',
        sale_price: 2000,
        cost_price: 1000,
        stock: 20
      })
      const p3 = productService.upsertProduct({
        code: '00789',
        name: 'Producto Tres',
        sale_price: 3000,
        cost_price: 1500,
        stock: 30
      })

      // Exportar solo p1 y p3
      const exportPath = path.join(os.tmpdir(), `test_export_${Date.now()}.xlsx`)
      const res = excelService.exportProducts(exportPath, [p1.id, p3.id])

      expect(res.filePath).toBe(exportPath)
      expect(res.totalExported).toBe(2)
      expect(fs.existsSync(exportPath)).toBe(true)

      // Leer el archivo exportado y verificar los códigos
      const wb = XLSX.readFile(exportPath)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // Fila 0: encabezados, Fila 1: Producto Uno, Fila 2: Producto Tres
      expect(data.length).toBe(3)
      const exportedCodes = [data[1][0], data[2][0]]
      expect(exportedCodes).toContain('00123')
      expect(exportedCodes).toContain('00789')
      expect(exportedCodes).not.toContain('00456')

      // Limpiar archivo temporal
      try {
        fs.unlinkSync(exportPath)
      } catch {
        // ignore
      }
    })

    it('exporta movimientos por día a Excel con formato y columnas correctas', () => {
      const exportPath = path.join(os.tmpdir(), `test_movements_${Date.now()}.xlsx`)
      const movements = [
        {
          created_at: '2026-10-06 10:30:00',
          type: 'venta',
          product_code: '01234',
          product_name: 'Lana Merino',
          parent_name: null,
          attribute_value: null,
          stock_before: 10,
          delta: -2,
          stock_after: 8,
          reason: null,
          sale_folio: 101
        },
        {
          created_at: '2026-10-06 11:15:00',
          type: 'ajuste',
          product_code: '05678',
          product_name: 'Algodón Rústico',
          parent_name: 'Hilo Rústico',
          attribute_value: 'Azul',
          stock_before: 5,
          delta: 3,
          stock_after: 8,
          reason: 'Conteo de inventario',
          sale_folio: null
        }
      ]

      const res = excelService.exportMovements(exportPath, movements)
      expect(res.filePath).toBe(exportPath)
      expect(res.totalExported).toBe(2)
      expect(fs.existsSync(exportPath)).toBe(true)

      const wb = XLSX.readFile(exportPath)
      expect(wb.SheetNames).toContain('Movimientos')
      const ws = wb.Sheets['Movimientos']
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      expect(data[0]).toEqual([
        'Fecha y Hora',
        'Tipo de Movimiento',
        'Código',
        'Producto',
        'Stock Anterior',
        'Variación (Delta)',
        'Stock Resultante',
        'Motivo / Referencia'
      ])
      // Fila 1: venta con folio
      expect(data[1][1]).toBe('Venta')
      expect(data[1][2]).toBe('01234')
      expect(data[1][3]).toBe('Lana Merino')
      expect(data[1][7]).toBe('Venta #101')

      // Fila 2: ajuste con padre y atributo
      expect(data[2][1]).toBe('Ajuste Manual')
      expect(data[2][2]).toBe('05678')
      expect(data[2][3]).toContain('Hilo Rústico')
      expect(data[2][7]).toBe('Conteo de inventario')

      try {
        fs.unlinkSync(exportPath)
      } catch {
        // ignore
      }
    })

    it('exporta kardex de producto a Excel con stock y movimientos', () => {
      const exportPath = path.join(os.tmpdir(), `test_kardex_${Date.now()}.xlsx`)
      const productInfo = {
        code: '01234',
        name: 'Lana Merino Azul',
        category_name: 'Lanas > Lana Merino',
        current_stock: 15
      }
      const movements = [
        {
          created_at: '2026-10-06 09:00:00',
          type: 'inicial',
          stock_before: 0,
          delta: 20,
          stock_after: 20,
          reason: 'Carga inicial',
          sale_folio: null
        },
        {
          created_at: '2026-10-06 14:00:00',
          type: 'venta',
          stock_before: 20,
          delta: -5,
          stock_after: 15,
          reason: null,
          sale_folio: 205
        }
      ]

      const res = excelService.exportKardex(exportPath, productInfo, movements)
      expect(res.filePath).toBe(exportPath)
      expect(res.totalExported).toBe(2)
      expect(fs.existsSync(exportPath)).toBe(true)

      const wb = XLSX.readFile(exportPath)
      expect(wb.SheetNames).toContain('Kardex')
      const ws = wb.Sheets['Kardex']
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      expect(data[0]).toEqual([
        'Fecha y Hora',
        'Tipo de Movimiento',
        'Stock Anterior',
        'Variación (Delta)',
        'Stock Resultante',
        'Motivo / Referencia'
      ])
      expect(data[1][1]).toBe('Stock Inicial')
      expect(data[2][1]).toBe('Venta')
      expect(data[2][5]).toBe('Venta #205')

      try {
        fs.unlinkSync(exportPath)
      } catch {
        // ignore
      }
    })
  })

  describe('Tratamiento de Stock (updateStock: true vs false)', () => {
    it('cuando updateStock es false (Mantener stock), conserva el stock de existentes intacto y asigna stock inicial a nuevos', () => {
      // 1. Producto existente con stock = 25
      productService.upsertProduct({
        code: 'PROD-EXISTENTE',
        name: 'Hilo Tradicional',
        sale_price: 2500,
        cost_price: 1000,
        stock: 25,
        min_stock: 5
      })

      // 2. Excel con producto existente (indica stock 99) y producto nuevo (indica stock 14)
      createTestWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['PROD-EXISTENTE', 'Hilo Tradicional Actualizado', '1100', '2800', '99', '8', 'Hilos'],
        ['PROD-NUEVO', 'Aguja de Tejer #5', '500', '1200', '14', '2', 'Accesorios']
      ])

      const report = excelService.importExcel(tempFilePath, undefined, { updateStock: false, duplicateCodeAction: 'allow_update' })

      expect(report.totalRows).toBe(2)
      expect(report.createdCount).toBe(1)
      expect(report.updatedCount).toBe(1)
      expect(report.stockModeApplied).toBe('keep')
      expect(report.stockModifiedCount).toBe(1) // Solo el nuevo producto recibió carga de stock

      // Verificar que el producto existente conservó su stock intacto de 25 (no 99)
      const existingProd = productService.getProductByCode('PROD-EXISTENTE')
      expect(existingProd?.stock).toBe(25)
      expect(existingProd?.sale_price).toBe(2800) // Precio sí se actualizó
      expect(existingProd?.name).toBe('Hilo Tradicional Actualizado') // Nombre sí se actualizó

      // Verificar que NO se crearon movimientos de importación en Kardex para el producto existente
      const existingMovements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ? AND type = ?')
        .all('PROD-EXISTENTE', 'importacion')
      expect(existingMovements).toHaveLength(0)

      // Verificar que el producto nuevo sí se creó con el stock inicial de 14
      const newProd = productService.getProductByCode('PROD-NUEVO')
      expect(newProd?.stock).toBe(14)

      const newMovements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ? AND type = ?')
        .all('PROD-NUEVO', 'importacion') as any[]
      expect(newMovements).toHaveLength(1)
      expect(newMovements[0].delta).toBe(14)
    })

    it('cuando updateStock es true (Modificar stock), reemplaza las existencias de existentes y genera auditoría en Kardex', () => {
      // 1. Producto existente con stock = 20
      productService.upsertProduct({
        code: 'PROD-MODIFICAR',
        name: 'Lana Grossa',
        sale_price: 4000,
        cost_price: 2000,
        stock: 20,
        min_stock: 5
      })

      // 2. Excel con nueva existencia = 55
      createTestWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['PROD-MODIFICAR', 'Lana Grossa 2026', '2200', '4500', '55', '10', 'Lanas']
      ])

      const report = excelService.importExcel(tempFilePath, undefined, { updateStock: true, duplicateCodeAction: 'allow_update' })

      expect(report.totalRows).toBe(1)
      expect(report.updatedCount).toBe(1)
      expect(report.stockModeApplied).toBe('modify')
      expect(report.stockModifiedCount).toBe(1)

      const prod = productService.getProductByCode('PROD-MODIFICAR')
      expect(prod?.stock).toBe(55)

      const movements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ? AND type = ?')
        .all('PROD-MODIFICAR', 'importacion') as any[]
      expect(movements).toHaveLength(1)
      expect(movements[0].delta).toBe(35) // 55 - 20 = 35
    })
  })
})
