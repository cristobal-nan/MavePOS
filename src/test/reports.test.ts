import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import { runMigrations } from '../main/db/migrations'
import { CashService } from '../main/services/cashService'
import { SalesService } from '../main/services/salesService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { ReportService, resolveDateRange } from '../main/services/reportService'

describe('Fase 11: Reportes, Métricas, Gráficos y Exportación Excel', () => {
  let db: Database.Database
  let cashService: CashService
  let salesService: SalesService
  let productService: ProductService
  let supplierService: SupplierService
  let reportService: ReportService
  let sessionId: number
  let catLanasId: number
  let catHilosId: number

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    cashService = new CashService(db)
    salesService = new SalesService(db)
    productService = new ProductService(db)
    supplierService = new SupplierService(db)
    reportService = new ReportService(db)

    const session = cashService.openSession(50000)
    sessionId = session.id

    // Crear categorías
    const catLanas = productService.saveCategory('Lanas')
    catLanasId = catLanas.id
    const catHilos = productService.saveCategory('Hilos')
    catHilosId = catHilos.id

    // Crear productos de prueba con costo y categoría
    productService.upsertProduct({
      code: 'LANA-01',
      name: 'Lana Merino Extrafina',
      sale_price: 5000,
      cost_price: 3000,
      stock: 100,
      min_stock: 10,
      category_id: catLanasId
    })

    productService.upsertProduct({
      code: 'LANA-02',
      name: 'Lana Rústica Natural',
      sale_price: 4000,
      cost_price: 2500,
      stock: 50,
      min_stock: 5,
      category_id: catLanasId
    })

    productService.upsertProduct({
      code: 'HILO-01',
      name: 'Hilo de Algodón Mercerizado',
      sale_price: 2000,
      cost_price: 1200,
      stock: 80,
      min_stock: 10,
      category_id: catHilosId
    })

    productService.upsertProduct({
      code: 'ACC-01',
      name: 'Crochet de Aluminio 4mm',
      sale_price: 1500,
      cost_price: null, // Sin costo definido
      stock: 30,
      min_stock: 5,
      category_id: null // Sin categoría
    })
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Cálculo de Rangos Temporales (resolveDateRange)', () => {
    it('calcula rango para hoy y período previo (ayer)', () => {
      const range = resolveDateRange({ periodType: 'today' })
      expect(range.start).toBe(range.end)
      expect(range.prevStart).toBe(range.prevEnd)
      expect(range.start).not.toBe(range.prevStart)
    })

    it('calcula rango de últimos 7 días con 7 días de duración', () => {
      const range = resolveDateRange({ periodType: 'last7days' })
      expect(range.start <= range.end).toBe(true)
      expect(range.prevStart <= range.prevEnd).toBe(true)
    })

    it('calcula rango personalizado adecuadamente', () => {
      const range = resolveDateRange({
        periodType: 'custom',
        startDate: '2026-09-01',
        endDate: '2026-09-10'
      })
      expect(range.start).toBe('2026-09-01')
      expect(range.end).toBe('2026-09-10')
      expect(range.prevEnd).toBe('2026-08-31')
      expect(range.prevStart).toBe('2026-08-22')
    })
  })

  describe('Reportes con Base de Datos Vacía / Sin Ventas', () => {
    it('retorna KPIs en 0 y arrays inicializados', () => {
      const data = reportService.getReportData({ periodType: 'today' })

      expect(data.kpi.totalSales).toBe(0)
      expect(data.kpi.salesCount).toBe(0)
      expect(data.kpi.averageTicket).toBe(0)
      expect(data.kpi.unitsSold).toBe(0)
      expect(data.kpi.estimatedCost).toBe(0)
      expect(data.kpi.estimatedMargin).toBe(0)
      expect(data.kpi.marginPercentage).toBe(0)
      expect(data.topProducts).toHaveLength(0)
      expect(data.categorySales).toHaveLength(0)
      expect(data.supplierSales).toHaveLength(0)
      expect(data.paymentMethods).toHaveLength(3)
      expect(data.paymentMethods.every((p) => p.total === 0)).toBe(true)
    })
  })

  describe('Cálculo de KPIs y Métricas de Ventas', () => {
    it('calcula ventas netas, ticket promedio, unidades y márgenes brutos correctamente', () => {
      // Venta 1: 2 x LANA-01 ($5000 c/u, costo $3000) = $10.000 (Efectivo)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      // Venta 2: 3 x HILO-01 ($2000 c/u, costo $1200) + 1 x ACC-01 ($1500, sin costo) = $7.500 (Tarjeta)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [
          { product_code: 'HILO-01', name: 'Hilo de Algodón Mercerizado', unit_price: 2000, quantity: 3 },
          { product_code: 'ACC-01', name: 'Crochet de Aluminio 4mm', unit_price: 1500, quantity: 1 }
        ],
        payments: [{ method: 'card', amount: 7500 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })

      // Total ventas: 10.000 + 7.500 = 17.500
      expect(data.kpi.totalSales).toBe(17500)
      // Transacciones: 2
      expect(data.kpi.salesCount).toBe(2)
      // Ticket promedio: 17.500 / 2 = 8.750
      expect(data.kpi.averageTicket).toBe(8750)
      // Unidades vendidas: 2 + 3 + 1 = 6
      expect(data.kpi.unitsSold).toBe(6)

      // Costos estimados:
      // LANA-01: 2 * 3000 = 6000
      // HILO-01: 3 * 1200 = 3600
      // ACC-01: sin costo
      // Costo total = 9600
      expect(data.kpi.estimatedCost).toBe(9600)

      // Margen bruto:
      // LANA-01: 2 * (5000 - 3000) = 4000
      // HILO-01: 3 * (2000 - 1200) = 2400
      // Margen total = 6400
      expect(data.kpi.estimatedMargin).toBe(6400)

      // Margen %: 6400 / (9600 + 6400) = 6400 / 16000 = 40%
      expect(data.kpi.marginPercentage).toBe(40)
    })

    it('excluye ventas pendientes en standby y ventas canceladas', () => {
      // Venta pendiente
      salesService.savePendingSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 5, stock: 100 }]
      })

      // Venta completada y luego cancelada
      const completed = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-02', name: 'Lana Rústica Natural', unit_price: 4000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 4000 }]
      })
      salesService.cancelSale(completed.sale.id, 'Cliente desistió')

      // Venta legítima completada
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 1 }],
        payments: [{ method: 'transfer', amount: 5000 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })

      expect(data.kpi.totalSales).toBe(5000)
      expect(data.kpi.salesCount).toBe(1)
      expect(data.kpi.unitsSold).toBe(1)
    })

    it('descuenta unidades e importes devueltos de las ventas netas', () => {
      // Venta de 4 unidades a $5.000 = $20.000
      const res = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 4 }],
        payments: [{ method: 'cash', amount: 20000 }]
      })

      // Devolución parcial de 1 unidad
      salesService.returnSaleItem(res.sale.id, 'LANA-01', 1, 'Cambio de color')

      const data = reportService.getReportData({ periodType: 'today' })

      // Netas: 3 unidades * 5000 = $15.000
      expect(data.kpi.totalSales).toBe(15000)
      expect(data.kpi.unitsSold).toBe(3)
      expect(data.kpi.salesCount).toBe(1)
    })

    it('congela el costo histórico al vender (snapshot) protegiendo el margen ante alzas de proveedor posteriores', () => {
      // Venta con costo original: LANA-01 costaba $3.000, vendemos 2 a $5.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      // El proveedor sube los precios de LANA-01: costo pasa a $4.500 y precio a $7.000
      const lana01 = productService.getProductByCode('LANA-01')!
      productService.upsertProduct({
        id: lana01.id,
        code: 'LANA-01',
        name: 'Lana Merino Extrafina',
        sale_price: 7000,
        cost_price: 4500,
        stock: 98,
        min_stock: 10,
        category_id: catLanasId
      })

      // El reporte del período anterior o actual debe seguir usando el costo congelado ($3.000)
      const data = reportService.getReportData({ periodType: 'today' })
      expect(data.kpi.totalSales).toBe(10000)
      expect(data.kpi.estimatedCost).toBe(6000) // 2 * 3000, NO 2 * 4500 (que daría 9000)
      expect(data.kpi.estimatedMargin).toBe(4000) // 10000 - 6000, NO 10000 - 9000
    })

    it('utiliza el costo del catálogo como fallback si sale_items.cost_price es null (ventas heredadas)', () => {
      // Simular venta antigua donde cost_price quedó null en sale_items
      const res = salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 5000 }]
      })

      // Forzar cost_price = NULL en sale_items
      db.prepare('UPDATE sale_items SET cost_price = NULL WHERE sale_id = ?').run(res.sale.id)

      const data = reportService.getReportData({ periodType: 'today' })
      // Debe resolver con COALESCE(si.cost_price, p.cost_price) -> costo de LANA-01 = 3000
      expect(data.kpi.estimatedCost).toBe(3000)
      expect(data.kpi.estimatedMargin).toBe(2000)
    })
  })

  describe('Desglose por Métodos de Pago', () => {
    it('clasifica correctamente montos y porcentajes de Efectivo, Tarjeta y Transferencia', () => {
      // Pago mixto: $6.000 Efectivo + $4.000 Tarjeta
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [
          { method: 'cash', amount: 6000 },
          { method: 'card', amount: 4000 }
        ]
      })

      // Pago 100% Transferencia: $10.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'transfer', amount: 10000 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })

      const cashStat = data.paymentMethods.find((p) => p.method === 'cash')!
      const cardStat = data.paymentMethods.find((p) => p.method === 'card')!
      const transferStat = data.paymentMethods.find((p) => p.method === 'transfer')!

      expect(cashStat.total).toBe(6000)
      expect(cashStat.percentage).toBe(30)

      expect(cardStat.total).toBe(4000)
      expect(cardStat.percentage).toBe(20)

      expect(transferStat.total).toBe(10000)
      expect(transferStat.percentage).toBe(50)
    })
  })

  describe('Top Productos Más Vendidos y Categorías', () => {
    it('ordena el ranking de top productos por unidades vendidas e incluye categoría', () => {
      // Vendemos 5 de HILO-01 ($2000 c/u = $10.000)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'HILO-01', name: 'Hilo de Algodón Mercerizado', unit_price: 2000, quantity: 5 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      // Vendemos 1 de LANA-01 ($5000 c/u = $5.000)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 1 }],
        payments: [{ method: 'card', amount: 5000 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })

      expect(data.topProducts).toHaveLength(2)
      expect(data.topProducts[0].code).toBe('HILO-01')
      expect(data.topProducts[0].unitsSold).toBe(5)
      expect(data.topProducts[0].totalRevenue).toBe(10000)
      expect(data.topProducts[0].categoryName).toBe('Hilos')

      expect(data.topProducts[1].code).toBe('LANA-01')
      expect(data.topProducts[1].unitsSold).toBe(1)
      expect(data.topProducts[1].categoryName).toBe('Lanas')
    })

    it('agrupa las ventas por categoría con sus porcentajes', () => {
      // Hilos: $6.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'HILO-01', name: 'Hilo de Algodón Mercerizado', unit_price: 2000, quantity: 3 }],
        payments: [{ method: 'cash', amount: 6000 }]
      })

      // Lanas: $4.000
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-02', name: 'Lana Rústica Natural', unit_price: 4000, quantity: 1 }],
        payments: [{ method: 'card', amount: 4000 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })

      expect(data.categorySales).toHaveLength(2)
      const hilos = data.categorySales.find((c) => c.categoryName === 'Hilos')!
      const lanas = data.categorySales.find((c) => c.categoryName === 'Lanas')!

      expect(hilos.totalRevenue).toBe(6000)
      expect(hilos.percentage).toBe(60)

      expect(lanas.totalRevenue).toBe(4000)
      expect(lanas.percentage).toBe(40)
    })
  })

  describe('Desglose de Ventas por Proveedor y Actualización Dinámica', () => {
    it('desglosa ventas por proveedor y actualiza dinámicamente si se modifican proveedores en el catálogo', () => {
      const s1 = supplierService.saveSupplier('Revesderecho')
      const s2 = supplierService.saveSupplier('Ukryl')

      // Asociar LANA-01 a Revesderecho
      const lana01 = productService.getProductByCode('LANA-01')!
      productService.upsertProduct({
        id: lana01.id,
        code: 'LANA-01',
        name: 'Lana Merino Extrafina',
        sale_price: 5000,
        cost_price: 3000,
        stock: 100,
        min_stock: 10,
        category_id: catLanasId,
        supplier_ids: [s1.id]
      })

      // Asociar HILO-01 a Ukryl
      const hilo01 = productService.getProductByCode('HILO-01')!
      productService.upsertProduct({
        id: hilo01.id,
        code: 'HILO-01',
        name: 'Hilo de Algodón Mercerizado',
        sale_price: 2000,
        cost_price: 1200,
        stock: 80,
        min_stock: 10,
        category_id: catHilosId,
        supplier_ids: [s2.id]
      })

      // Realizar ventas
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'HILO-01', name: 'Hilo de Algodón Mercerizado', unit_price: 2000, quantity: 3 }],
        payments: [{ method: 'card', amount: 6000 }]
      })

      // Venta de producto sin proveedor (ACC-01)
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'ACC-01', name: 'Crochet de Aluminio 4mm', unit_price: 1500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 1500 }]
      })

      let data = reportService.getReportData({ periodType: 'today' })

      // Verificar desglose de proveedores
      expect(data.supplierSales).toHaveLength(3)
      const suppReves = data.supplierSales.find((s) => s.supplierName === 'Revesderecho')!
      const suppUkryl = data.supplierSales.find((s) => s.supplierName === 'Ukryl')!
      const suppNone = data.supplierSales.find((s) => s.supplierName === 'Sin Proveedor')!

      expect(suppReves.totalRevenue).toBe(10000)
      expect(suppReves.unitsSold).toBe(2)
      expect(suppUkryl.totalRevenue).toBe(6000)
      expect(suppUkryl.unitsSold).toBe(3)
      expect(suppNone.totalRevenue).toBe(1500)
      expect(suppNone.unitsSold).toBe(1)

      // Verificar sintaxis "Categoría - Proveedor" en Top Productos
      const topLana = data.topProducts.find((p) => p.code === 'LANA-01')!
      expect(topLana.categoryName).toBe('Lanas - Revesderecho')

      // CAMBIO DE PROVEEDOR EN CATÁLOGO: ahora LANA-01 también lo provee Ukryl (N:M)
      productService.upsertProduct({
        id: lana01.id,
        code: 'LANA-01',
        name: 'Lana Merino Extrafina',
        sale_price: 5000,
        cost_price: 3000,
        stock: 98,
        min_stock: 10,
        category_id: catLanasId,
        supplier_ids: [s1.id, s2.id]
      })

      // El reporte debe reflejar INMEDIATAMENTE el nuevo proveedor en ventas históricas
      data = reportService.getReportData({ periodType: 'today' })
      const updatedTopLana = data.topProducts.find((p) => p.code === 'LANA-01')!
      expect(updatedTopLana.categoryName).toBe('Lanas - Revesderecho / Ukryl')
    })
  })

  describe('Generación y Exportación a Excel (.xlsx)', () => {
    it('crea un libro de trabajo XLSX estructurado con todas las hojas requeridas', () => {
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      const data = reportService.getReportData({ periodType: 'today' })
      const wb = reportService.generateWorkbook(data)

      expect(wb.SheetNames).toContain('Resumen')
      expect(wb.SheetNames).toContain('Ventas en el Tiempo')
      expect(wb.SheetNames).toContain('Top Productos')
      expect(wb.SheetNames).toContain('Métodos de Pago')
      expect(wb.SheetNames).toContain('Por Categoría')
      expect(wb.SheetNames).toContain('Por Proveedor')
    })

    it('exporta y guarda el archivo Excel en disco exitosamente', async () => {
      salesService.completeSale({
        cashSessionId: sessionId,
        items: [{ product_code: 'LANA-01', name: 'Lana Merino Extrafina', unit_price: 5000, quantity: 1 }],
        payments: [{ method: 'cash', amount: 5000 }]
      })

      const tempDir = os.tmpdir()
      const exportPath = path.join(tempDir, `test_report_${Date.now()}.xlsx`)

      const res = await reportService.exportReportToExcel({ periodType: 'today' }, exportPath)

      expect(res.success).toBe(true)
      expect(res.filePath).toBe(exportPath)
      expect(fs.existsSync(exportPath)).toBe(true)

      // Leer archivo generado para confirmar integridad
      const readWb = XLSX.readFile(exportPath)
      expect(readWb.SheetNames).toContain('Resumen')

      // Limpieza
      try {
        fs.unlinkSync(exportPath)
      } catch {}
    })
  })
})
