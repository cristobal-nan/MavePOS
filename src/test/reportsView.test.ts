import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReportsView } from '../renderer/src/views/ReportsView'

beforeEach(() => {
  // @ts-ignore
  global.window = global.window || {}
  // @ts-ignore
  global.window.api = {
    getReportData: vi.fn().mockResolvedValue({
      summary: {
        totalRevenue: 250000,
        transactionsCount: 20,
        avgTicket: 12500,
        unitsSold: 45,
        totalCost: 150000,
        grossMargin: 100000,
        marginPercent: 40,
        prevRevenue: 200000,
        revenueChangePercent: 25
      },
      salesOverTime: [
        { label: '10:00', total: 50000, count: 5 }
      ],
      paymentDistribution: [
        { methodName: 'Efectivo', total: 150000, percentage: 60 }
      ],
      topCategories: [
        { categoryName: 'Lanas', unitsSold: 30, totalRevenue: 180000, percentage: 72 }
      ],
      supplierSales: [
        { supplierName: 'Distribuidora Textil', unitsSold: 25, totalRevenue: 150000, percentage: 60 }
      ],
      topProducts: [
        {
          code: 'LAN-001',
          name: 'Lana Merino Extra',
          categoryName: 'Lanas',
          unitPrice: 5000,
          unitsSold: 20,
          totalRevenue: 100000
        }
      ]
    }),
    exportReportToExcel: vi.fn().mockResolvedValue({ success: true, filePath: 'C:/docs/report.xlsx' })
  }
})

vi.mock('../renderer/src/store/uiStore', () => ({
  useUIStore: (selector: any) =>
    selector({
      surfaceMode: 'dark',
      themeAccent: 'lilac'
    })
}))

describe('Auditoría UI Pantalla 6: Reportes y Analíticas (ReportsView)', () => {
  it('renderiza ViewHeader canónico con título, icono y badge de métricas', () => {
    const html = renderToStaticMarkup(React.createElement(ReportsView))

    expect(html).toContain('Reportes y Analíticas')
    expect(html).toContain('Métricas')
    expect(html).toContain('Exportar Excel')
    expect(html).toContain('Actualizar')
  })

  it('renderiza selector de períodos accesible con botones de rango temporal', () => {
    const html = renderToStaticMarkup(React.createElement(ReportsView))

    expect(html).toContain('Hoy')
    expect(html).toContain('Últimos 7 días')
    expect(html).toContain('Este Mes')
    expect(html).toContain('Mes Anterior')
    expect(html).toContain('Personalizado')
    expect(html).toContain('focus-visible:ring-2')
  })

  it('incorpora clases font-mono tabular-nums para valores monetarios y numéricos estables', () => {
    const html = renderToStaticMarkup(React.createElement(ReportsView))

    // Validamos que se usen las clases de formato numérico alineado
    expect(html).toContain('font-mono')
    expect(html).toContain('tabular-nums')
  })
})
