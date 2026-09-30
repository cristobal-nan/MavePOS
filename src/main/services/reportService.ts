import path from 'path'
import { dialog } from 'electron'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import {
  CategorySalesStat,
  SupplierSalesStat,
  FullReportData,
  PaymentMethod,
  PaymentMethodStat,
  ReportFilter,
  ReportKPISummary,
  SalesOverTimePoint,
  TopProductStat
} from '../../shared/types'

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

export function resolveDateRange(filter: ReportFilter): {
  start: string
  end: string
  prevStart: string
  prevEnd: string
} {
  const now = new Date()
  const todayStr = formatLocalDate(now)

  if (filter.periodType === 'today') {
    const yesterday = addDays(now, -1)
    const yestStr = formatLocalDate(yesterday)
    return {
      start: todayStr,
      end: todayStr,
      prevStart: yestStr,
      prevEnd: yestStr
    }
  }

  if (filter.periodType === 'last7days') {
    const start7 = addDays(now, -6)
    const prevEnd = addDays(now, -7)
    const prevStart = addDays(now, -13)
    return {
      start: formatLocalDate(start7),
      end: todayStr,
      prevStart: formatLocalDate(prevStart),
      prevEnd: formatLocalDate(prevEnd)
    }
  }

  if (filter.periodType === 'thisMonth') {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      start: formatLocalDate(startMonth),
      end: formatLocalDate(endMonth),
      prevStart: formatLocalDate(prevStart),
      prevEnd: formatLocalDate(prevEnd)
    }
  }

  if (filter.periodType === 'lastMonth') {
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    return {
      start: formatLocalDate(startMonth),
      end: formatLocalDate(endMonth),
      prevStart: formatLocalDate(prevStart),
      prevEnd: formatLocalDate(prevEnd)
    }
  }

  // Custom
  const start = filter.startDate || todayStr
  const end = filter.endDate || todayStr
  const startDateObj = new Date(`${start}T00:00:00`)
  const endDateObj = new Date(`${end}T00:00:00`)
  const diffDays = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1)
  const prevEndObj = addDays(startDateObj, -1)
  const prevStartObj = addDays(prevEndObj, -(diffDays - 1))

  return {
    start,
    end,
    prevStart: formatLocalDate(prevStartObj),
    prevEnd: formatLocalDate(prevEndObj)
  }
}

function calculateGrowth(current: number, prev: number): number | null {
  if (prev === 0) {
    return current > 0 ? 100 : null
  }
  return Number((((current - prev) / prev) * 100).toFixed(1))
}

export class ReportService {
  constructor(private db: Database.Database) {}

  /**
   * Generates complete report metrics and charts dataset for the requested filter.
   */
  getReportData(filter: ReportFilter): FullReportData {
    const dateRange = resolveDateRange(filter)

    // 1. Current Period KPIs
    const currentKPI = this.queryPeriodKPI(dateRange.start, dateRange.end)

    // 2. Previous Period KPIs (for comparative analysis)
    const prevKPI = this.queryPeriodKPI(dateRange.prevStart, dateRange.prevEnd)

    const averageTicket = currentKPI.salesCount > 0 ? Math.round(currentKPI.totalSales / currentKPI.salesCount) : 0
    const prevAverageTicket = prevKPI.salesCount > 0 ? Math.round(prevKPI.totalSales / prevKPI.salesCount) : 0

    const marginPercentage =
      currentKPI.estimatedCost > 0
        ? Number(((currentKPI.estimatedMargin / (currentKPI.estimatedCost + currentKPI.estimatedMargin)) * 100).toFixed(1))
        : 0

    const kpi: ReportKPISummary = {
      totalSales: currentKPI.totalSales,
      salesCount: currentKPI.salesCount,
      averageTicket,
      unitsSold: currentKPI.unitsSold,
      estimatedCost: currentKPI.estimatedCost,
      estimatedMargin: currentKPI.estimatedMargin,
      marginPercentage,
      prevTotalSales: prevKPI.totalSales,
      prevSalesCount: prevKPI.salesCount,
      prevAverageTicket,
      prevUnitsSold: prevKPI.unitsSold,
      salesGrowthPct: calculateGrowth(currentKPI.totalSales, prevKPI.totalSales),
      countGrowthPct: calculateGrowth(currentKPI.salesCount, prevKPI.salesCount)
    }

    // 3. Sales over time
    const salesOverTime = this.querySalesOverTime(dateRange.start, dateRange.end)

    // 4. Payment methods breakdown
    const paymentMethods = this.queryPaymentMethods(dateRange.start, dateRange.end)

    // 5. Top 10 products
    const topProducts = this.queryTopProducts(dateRange.start, dateRange.end)

    // 6. Category breakdown
    const categorySales = this.queryCategorySales(dateRange.start, dateRange.end, currentKPI.totalSales)

    // 7. Supplier breakdown
    const supplierSales = this.querySupplierSales(dateRange.start, dateRange.end, currentKPI.totalSales)

    return {
      filter,
      dateRange,
      kpi,
      salesOverTime,
      paymentMethods,
      topProducts,
      categorySales,
      supplierSales
    }
  }

  private queryPeriodKPI(startDate: string, endDate: string): {
    totalSales: number
    salesCount: number
    unitsSold: number
    estimatedCost: number
    estimatedMargin: number
  } {
    // Net sales calculation: items sold minus returned items in completed sales
    const sql = `
      SELECT
        COUNT(DISTINCT s.id) AS sales_count,
        COALESCE(SUM((si.quantity - si.returned_qty) * si.unit_price), 0) AS total_sales,
        COALESCE(SUM(si.quantity - si.returned_qty), 0) AS units_sold,
        COALESCE(SUM(
          CASE WHEN COALESCE(si.cost_price, p.cost_price) IS NOT NULL
            THEN (si.quantity - si.returned_qty) * COALESCE(si.cost_price, p.cost_price)
            ELSE 0
          END
        ), 0) AS estimated_cost,
        COALESCE(SUM(
          CASE WHEN COALESCE(si.cost_price, p.cost_price) IS NOT NULL
            THEN (si.quantity - si.returned_qty) * (si.unit_price - COALESCE(si.cost_price, p.cost_price))
            ELSE 0
          END
        ), 0) AS estimated_margin
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_code = p.code
      WHERE s.status = 'completed'
        AND date(s.created_at, 'localtime') BETWEEN ? AND ?
    `
    const row = this.db.prepare(sql).get(startDate, endDate) as any

    return {
      totalSales: row ? Number(row.total_sales) || 0 : 0,
      salesCount: row ? Number(row.sales_count) || 0 : 0,
      unitsSold: row ? Number(row.units_sold) || 0 : 0,
      estimatedCost: row ? Number(row.estimated_cost) || 0 : 0,
      estimatedMargin: row ? Number(row.estimated_margin) || 0 : 0
    }
  }

  private querySalesOverTime(startDate: string, endDate: string): SalesOverTimePoint[] {
    const isSingleDay = startDate === endDate

    if (isSingleDay) {
      // Group by hour (08:00 to 20:00 default span, extended if earlier/later sales exist)
      const sql = `
        SELECT
          strftime('%H', s.created_at, 'localtime') AS hour_str,
          SUM((si.quantity - si.returned_qty) * si.unit_price) AS total,
          COUNT(DISTINCT s.id) AS count
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE s.status = 'completed'
          AND date(s.created_at, 'localtime') = ?
        GROUP BY hour_str
      `
      const rows = this.db.prepare(sql).all(startDate) as { hour_str: string; total: number; count: number }[]
      const hourMap = new Map<number, { total: number; count: number }>()

      let minHour = 8
      let maxHour = 20

      for (const r of rows) {
        const h = parseInt(r.hour_str, 10)
        hourMap.set(h, { total: Number(r.total) || 0, count: Number(r.count) || 0 })
        if (h < minHour) minHour = Math.max(0, h)
        if (h > maxHour) maxHour = Math.min(23, h)
      }

      const points: SalesOverTimePoint[] = []
      for (let h = minHour; h <= maxHour; h++) {
        const label = `${String(h).padStart(2, '0')}:00`
        const entry = hourMap.get(h) || { total: 0, count: 0 }
        points.push({
          label,
          date: `${startDate}T${label}:00`,
          total: entry.total,
          count: entry.count
        })
      }
      return points
    }

    // Multiple days: Group by day
    const sql = `
      SELECT
        date(s.created_at, 'localtime') AS day_str,
        SUM((si.quantity - si.returned_qty) * si.unit_price) AS total,
        COUNT(DISTINCT s.id) AS count
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed'
        AND date(s.created_at, 'localtime') BETWEEN ? AND ?
      GROUP BY day_str
      ORDER BY day_str ASC
    `
    const rows = this.db.prepare(sql).all(startDate, endDate) as { day_str: string; total: number; count: number }[]
    const dayMap = new Map<string, { total: number; count: number }>()
    for (const r of rows) {
      dayMap.set(r.day_str, { total: Number(r.total) || 0, count: Number(r.count) || 0 })
    }

    // Generate sequence of dates from startDate to endDate
    const points: SalesOverTimePoint[] = []
    const curDate = new Date(`${startDate}T00:00:00`)
    const stopDate = new Date(`${endDate}T00:00:00`)

    while (curDate <= stopDate) {
      const dateStr = formatLocalDate(curDate)
      const day = String(curDate.getDate()).padStart(2, '0')
      const month = String(curDate.getMonth() + 1).padStart(2, '0')
      const label = `${day}/${month}`
      const entry = dayMap.get(dateStr) || { total: 0, count: 0 }
      points.push({
        label,
        date: dateStr,
        total: entry.total,
        count: entry.count
      })
      curDate.setDate(curDate.getDate() + 1)
    }

    return points
  }

  private queryPaymentMethods(startDate: string, endDate: string): PaymentMethodStat[] {
    const sql = `
      SELECT
        sp.method,
        COALESCE(SUM(sp.amount), 0) AS total,
        COUNT(sp.id) AS count
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE s.status = 'completed'
        AND date(s.created_at, 'localtime') BETWEEN ? AND ?
      GROUP BY sp.method
    `
    const rows = this.db.prepare(sql).all(startDate, endDate) as { method: PaymentMethod; total: number; count: number }[]
    const methodMap = new Map<PaymentMethod, { total: number; count: number }>()

    let totalSum = 0
    for (const r of rows) {
      const amt = Number(r.total) || 0
      methodMap.set(r.method, { total: amt, count: Number(r.count) || 0 })
      totalSum += amt
    }

    const labels: Record<PaymentMethod, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia'
    }

    const methods: PaymentMethod[] = ['cash', 'card', 'transfer']
    return methods.map((m) => {
      const data = methodMap.get(m) || { total: 0, count: 0 }
      const percentage = totalSum > 0 ? Number(((data.total / totalSum) * 100).toFixed(1)) : 0
      return {
        method: m,
        methodName: labels[m],
        total: data.total,
        percentage,
        count: data.count
      }
    })
  }

  private queryTopProducts(startDate: string, endDate: string, limit = 10): TopProductStat[] {
    const sql = `
      SELECT
        si.product_code AS code,
        si.name,
        si.unit_price,
        c.name AS cat_name,
        parent_c.name AS parent_cat_name,
        (
          SELECT GROUP_CONCAT(s.name, ';;')
          FROM product_suppliers ps
          JOIN suppliers s ON s.id = ps.supplier_id
          WHERE ps.product_id = p.id OR (p.parent_id IS NOT NULL AND ps.product_id = p.parent_id)
        ) AS supplier_names,
        SUM(si.quantity - si.returned_qty) AS units_sold,
        SUM((si.quantity - si.returned_qty) * si.unit_price) AS total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_code = p.code
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN products parent ON p.parent_id = parent.id
      LEFT JOIN categories parent_c ON parent.category_id = parent_c.id
      WHERE s.status = 'completed'
        AND date(s.created_at, 'localtime') BETWEEN ? AND ?
      GROUP BY si.product_code, si.name, si.unit_price, cat_name, parent_cat_name, supplier_names
      HAVING units_sold > 0
      ORDER BY units_sold DESC, total_revenue DESC
      LIMIT ?
    `
    const rows = this.db.prepare(sql).all(startDate, endDate, limit) as any[]

    return rows.map((r) => {
      const catName = r.cat_name || r.parent_cat_name || ''
      let suppNames = ''
      if (r.supplier_names) {
        const uniqueSupps = Array.from(new Set(String(r.supplier_names).split(';;').filter(Boolean)))
        suppNames = uniqueSupps.join(' / ')
      }

      let categoryDisplay = 'Sin Categoría'
      if (catName && suppNames) {
        categoryDisplay = `${catName} - ${suppNames}`
      } else if (catName) {
        categoryDisplay = catName
      } else if (suppNames) {
        categoryDisplay = suppNames
      }

      return {
        code: String(r.code),
        name: String(r.name),
        categoryName: categoryDisplay,
        unitsSold: Number(r.units_sold) || 0,
        totalRevenue: Number(r.total_revenue) || 0,
        unitPrice: Number(r.unit_price) || 0
      }
    })
  }

  private queryCategorySales(startDate: string, endDate: string, totalSales: number): CategorySalesStat[] {
    const sql = `
      SELECT
        p.category_id,
        COALESCE(c.name, 'Sin Categoría') AS category_name,
        SUM(si.quantity - si.returned_qty) AS units_sold,
        SUM((si.quantity - si.returned_qty) * si.unit_price) AS total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_code = p.code
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.status = 'completed'
        AND date(s.created_at, 'localtime') BETWEEN ? AND ?
      GROUP BY p.category_id, category_name
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
    `
    const rows = this.db.prepare(sql).all(startDate, endDate) as any[]

    return rows.map((r) => {
      const revenue = Number(r.total_revenue) || 0
      const percentage = totalSales > 0 ? Number(((revenue / totalSales) * 100).toFixed(1)) : 0
      return {
        categoryId: r.category_id !== null ? Number(r.category_id) : null,
        categoryName: String(r.category_name),
        unitsSold: Number(r.units_sold) || 0,
        totalRevenue: revenue,
        percentage
      }
    })
  }

  private querySupplierSales(startDate: string, endDate: string, totalSales: number): SupplierSalesStat[] {
    const sql = `
      WITH item_suppliers AS (
        SELECT DISTINCT
          si.id AS sale_item_id,
          si.quantity - si.returned_qty AS net_qty,
          (si.quantity - si.returned_qty) * si.unit_price AS net_revenue,
          s.id AS supplier_id,
          s.name AS supplier_name
        FROM sale_items si
        JOIN sales sa ON si.sale_id = sa.id
        LEFT JOIN products p ON si.product_code = p.code
        LEFT JOIN product_suppliers ps ON (ps.product_id = p.id OR (p.parent_id IS NOT NULL AND ps.product_id = p.parent_id))
        LEFT JOIN suppliers s ON ps.supplier_id = s.id
        WHERE sa.status = 'completed'
          AND date(sa.created_at, 'localtime') BETWEEN ? AND ?
      )
      SELECT
        supplier_id,
        COALESCE(supplier_name, 'Sin Proveedor') AS supplier_name,
        SUM(net_qty) AS units_sold,
        SUM(net_revenue) AS total_revenue
      FROM item_suppliers
      GROUP BY supplier_id, supplier_name
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
    `
    const rows = this.db.prepare(sql).all(startDate, endDate) as any[]

    return rows.map((r) => {
      const revenue = Number(r.total_revenue) || 0
      const percentage = totalSales > 0 ? Number(((revenue / totalSales) * 100).toFixed(1)) : 0
      return {
        supplierId: r.supplier_id !== null ? Number(r.supplier_id) : null,
        supplierName: String(r.supplier_name),
        unitsSold: Number(r.units_sold) || 0,
        totalRevenue: revenue,
        percentage
      }
    })
  }

  /**
   * Builds an XLSX Workbook from the full report data.
   */
  generateWorkbook(data: FullReportData): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()

    // 1. Resumen Sheet
    const summaryRows = [
      ['REPORTE DE VENTAS - MAVE POS (100% OFFLINE)'],
      ['Rango del Reporte:', `${data.dateRange.start} al ${data.dateRange.end}`],
      ['Período Comparativo Anterior:', `${data.dateRange.prevStart} al ${data.dateRange.prevEnd}`],
      ['Fecha y Hora de Emisión:', new Date().toLocaleString()],
      [''],
      ['Métrica / Indicador', 'Valor Actual', 'Período Anterior', 'Variación'],
      ['Ventas Netas Totales ($ CLP)', data.kpi.totalSales, data.kpi.prevTotalSales, data.kpi.salesGrowthPct !== null ? `${data.kpi.salesGrowthPct}%` : 'N/A'],
      ['Número de Transacciones', data.kpi.salesCount, data.kpi.prevSalesCount, data.kpi.countGrowthPct !== null ? `${data.kpi.countGrowthPct}%` : 'N/A'],
      ['Ticket Promedio ($ CLP)', data.kpi.averageTicket, data.kpi.prevAverageTicket, '-'],
      ['Unidades Físicas Vendidas', data.kpi.unitsSold, data.kpi.prevUnitsSold, '-'],
      ['Costo Estimado de Bienes ($ CLP)', data.kpi.estimatedCost, '-', '-'],
      ['Margen Bruto Estimado ($ CLP)', data.kpi.estimatedMargin, '-', '-'],
      ['Margen Porcentual Estimado', `${data.kpi.marginPercentage}%`, '-', '-']
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

    // 2. Ventas en el Tiempo Sheet
    const timeRows = [
      ['Período / Fecha', 'Ventas Netas ($ CLP)', 'Cantidad de Ventas'],
      ...data.salesOverTime.map((item) => [item.label, item.total, item.count])
    ]
    const wsTime = XLSX.utils.aoa_to_sheet(timeRows)
    XLSX.utils.book_append_sheet(wb, wsTime, 'Ventas en el Tiempo')

    // 3. Top Productos Sheet
    const prodRows = [
      ['Código', 'Producto', 'Categoría', 'Unidades Vendidas', 'Precio Unitario ($ CLP)', 'Total Recaudado ($ CLP)'],
      ...data.topProducts.map((p) => [p.code, p.name, p.categoryName, p.unitsSold, p.unitPrice, p.totalRevenue])
    ]
    const wsProd = XLSX.utils.aoa_to_sheet(prodRows)
    XLSX.utils.book_append_sheet(wb, wsProd, 'Top Productos')

    // 4. Métodos de Pago Sheet
    const payRows = [
      ['Método de Pago', 'Total Recaudado ($ CLP)', 'Participación (%)', 'Cantidad Transacciones'],
      ...data.paymentMethods.map((m) => [m.methodName, m.total, `${m.percentage}%`, m.count])
    ]
    const wsPay = XLSX.utils.aoa_to_sheet(payRows)
    XLSX.utils.book_append_sheet(wb, wsPay, 'Métodos de Pago')

    // 5. Categorías Sheet
    const catRows = [
      ['Categoría', 'Unidades Vendidas', 'Total Recaudado ($ CLP)', 'Participación (%)'],
      ...data.categorySales.map((c) => [c.categoryName, c.unitsSold, c.totalRevenue, `${c.percentage}%`])
    ]
    const wsCat = XLSX.utils.aoa_to_sheet(catRows)
    XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoría')

    // 6. Proveedores Sheet
    const suppRows = [
      ['Proveedor', 'Unidades Vendidas', 'Total Recaudado ($ CLP)', 'Participación (%)'],
      ...data.supplierSales.map((s) => [s.supplierName, s.unitsSold, s.totalRevenue, `${s.percentage}%`])
    ]
    const wsSupp = XLSX.utils.aoa_to_sheet(suppRows)
    XLSX.utils.book_append_sheet(wb, wsSupp, 'Por Proveedor')

    return wb
  }

  /**
   * Prompts user for a save location and exports report as an Excel .xlsx spreadsheet.
   */
  async exportReportToExcel(filter: ReportFilter, targetFilePath?: string): Promise<{ success: boolean; filePath?: string }> {
    const data = this.getReportData(filter)
    const wb = this.generateWorkbook(data)

    let finalPath = targetFilePath

    if (!finalPath) {
      const defaultFileName = `Reporte_Ventas_${data.dateRange.start}_${data.dateRange.end}.xlsx`
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar Reporte de Ventas a Excel',
        defaultPath: defaultFileName,
        filters: [{ name: 'Archivos Excel (*.xlsx)', extensions: ['xlsx'] }]
      })

      if (canceled || !filePath) {
        return { success: false }
      }
      finalPath = filePath
    }

    XLSX.writeFile(wb, finalPath)
    return { success: true, filePath: finalPath }
  }
}
