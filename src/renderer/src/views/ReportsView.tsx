import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  Receipt,
  Package,
  FileSpreadsheet,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieIcon,
  Layers,
  CheckCircle2,
  AlertCircle,
  Truck
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'
import { FullReportData, ReportFilter, ReportPeriodType } from '../../../shared/types'
import { formatCLP } from '../utils/formatters'
import { useUIStore } from '../store/uiStore'
import { resolveSurface } from '../theme/themes'

const PAYMENT_COLORS: Record<string, string> = {
  Efectivo: '#10B981', // Emerald
  Tarjeta: '#3B82F6', // Blue
  Transferencia: '#8B5CF6' // Lilac / Violet
}

const CATEGORY_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#84CC16',
  '#06B6D4'
]

const SUPPLIER_COLORS = [
  '#6366F1',
  '#06B6D4',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
  '#F97316'
]

export const ReportsView: React.FC = () => {
  const [periodType, setPeriodType] = useState<ReportPeriodType>('today')
  const [customStart, setCustomStart] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [reportData, setReportData] = useState<FullReportData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [exporting, setExporting] = useState<boolean>(false)
  const [exportNotification, setExportNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [salesChartMetric, setSalesChartMetric] = useState<'amount' | 'count'>('amount')

  const surfaceMode = useUIStore((s) => s.surfaceMode)
  const isDark = resolveSurface(surfaceMode) === 'dark'
  const chartGridStroke = isDark ? '#334155' : '#F1F5F9'
  const chartTickFill = isDark ? '#94A3B8' : '#64748B'

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const filter: ReportFilter = {
        periodType,
        startDate: periodType === 'custom' ? customStart : undefined,
        endDate: periodType === 'custom' ? customEnd : undefined
      }
      const data = await window.api.getReportData(filter)
      setReportData(data)
    } catch (err: any) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }, [periodType, customStart, customEnd])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleExportExcel = async (): Promise<void> => {
    if (!reportData) return
    setExporting(true)
    setExportNotification(null)
    try {
      const filter: ReportFilter = {
        periodType,
        startDate: periodType === 'custom' ? customStart : undefined,
        endDate: periodType === 'custom' ? customEnd : undefined
      }
      const result = await window.api.exportReportToExcel(filter)
      if (result.success && result.filePath) {
        setExportNotification({
          type: 'success',
          message: `Reporte Excel exportado exitosamente en: ${result.filePath}`
        })
      }
    } catch (err: any) {
      setExportNotification({
        type: 'error',
        message: err.message || 'Error al exportar el reporte a Excel'
      })
    } finally {
      setExporting(false)
    }
  }

  // Custom Chart Tooltip
  const renderCustomSalesTooltip = ({ active, payload, label }: any): React.ReactNode => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-bold text-slate-300">{label}</p>
          <p className="text-lilac-300 font-semibold">
            Ventas:{' '}
            <span className="text-white font-bold">{formatCLP(data.total)}</span>
          </p>
          <p className="text-slate-400">
            Transacciones:{' '}
            <span className="text-white font-bold">{data.count}</span>
          </p>
        </div>
      )
    }
    return null
  }

  const renderPaymentPieTooltip = ({ active, payload }: any): React.ReactNode => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-bold" style={{ color: PAYMENT_COLORS[data.methodName] || '#8B5CF6' }}>
            {data.methodName}
          </p>
          <p className="text-slate-200">
            Monto:{' '}
            <span className="text-white font-bold">{formatCLP(data.total)}</span>
          </p>
          <p className="text-slate-300">
            Participación: <span className="font-bold text-lilac-300">{data.percentage}%</span>
          </p>
          <p className="text-slate-400">
            Transacciones: <span className="text-white">{data.count}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-lilac-100 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shadow-inner shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
              Reportes
            </h1>
          </div>
        </div>

        {/* Period Selector Tabs and Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60">
            <button
              onClick={() => setPeriodType('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'today'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriodType('last7days')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'last7days'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Últimos 7 días
            </button>
            <button
              onClick={() => setPeriodType('thisMonth')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'thisMonth'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setPeriodType('lastMonth')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'lastMonth'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Mes Anterior
            </button>
            <button
              onClick={() => setPeriodType('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'custom'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={fetchReport}
            disabled={loading}
            title="Actualizar datos"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200/60 flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-lilac-600' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || !reportData}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Exportando...' : 'Exportar Excel'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Custom Date Pickers (if periodType === 'custom') */}
        {periodType === 'custom' && (
        <div className="bg-white p-3.5 rounded-2xl border border-lilac-100 shadow-sm flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-slate-600 font-semibold">
            <Calendar className="w-4 h-4 text-lilac-600" />
            <span>Rango de Fechas Personalizado:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Desde:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Hasta:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100"
            />
          </div>
          <button
            onClick={fetchReport}
            className="px-3 py-1.5 bg-lilac-600 hover:bg-lilac-700 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            Aplicar Filtro
          </button>
        </div>
      )}

      {/* Export Notification */}
      {exportNotification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            exportNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {exportNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{exportNotification.message}</span>
          </div>
          <button
            onClick={() => setExportNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Date Range Subtitle */}
      {reportData && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 -mt-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-lilac-600" />
            <span>
              Período analizado: <strong className="text-slate-700">{reportData.dateRange.start}</strong> al{' '}
              <strong className="text-slate-700">{reportData.dateRange.end}</strong>
            </span>
          </div>
          <div>
            <span>
              Comparando contra:{' '}
              <strong className="text-slate-600">
                {reportData.dateRange.prevStart} al {reportData.dateRange.prevEnd}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* 2. Key Performance Indicators (KPI Cards) */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Ventas Totales */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ventas Netas</span>
              <div className="w-8 h-8 rounded-lg bg-lilac-100 dark:bg-slate-700 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                {formatCLP(reportData.kpi.totalSales)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                {reportData.kpi.salesGrowthPct !== null ? (
                  reportData.kpi.salesGrowthPct > 0 ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-transparent dark:border-emerald-700/50">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      +{reportData.kpi.salesGrowthPct}%
                    </span>
                  ) : reportData.kpi.salesGrowthPct < 0 ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-red-600 dark:text-rose-300 bg-red-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-transparent dark:border-rose-700/50">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      {reportData.kpi.salesGrowthPct}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
                      <Minus className="w-3 h-3 mr-0.5" />
                      0%
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Sin datos prev.</span>
                )}
                <span className="text-[11px] text-slate-400">vs período ant.</span>
              </div>
            </div>
          </div>

          {/* Card 2: Cantidad de Ventas */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Transacciones</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                {reportData.kpi.salesCount}{' '}
                <span className="text-xs font-semibold text-slate-400">ventas</span>
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                {reportData.kpi.countGrowthPct !== null ? (
                  reportData.kpi.countGrowthPct >= 0 ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-transparent dark:border-emerald-700/50">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      +{reportData.kpi.countGrowthPct}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-bold text-red-600 dark:text-rose-300 bg-red-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-transparent dark:border-rose-700/50">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      {reportData.kpi.countGrowthPct}%
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Sin datos prev.</span>
                )}
                <span className="text-[11px] text-slate-400">vs período ant.</span>
              </div>
            </div>
          </div>

          {/* Card 3: Ticket Promedio */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ticket Promedio</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-slate-700 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                {formatCLP(reportData.kpi.averageTicket)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-2">
                Ant: {formatCLP(reportData.kpi.prevAverageTicket)}
              </p>
            </div>
          </div>

          {/* Card 4: Unidades Vendidas */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Unidades Vendidas</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-slate-700 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                {reportData.kpi.unitsSold}{' '}
                <span className="text-xs font-semibold text-slate-400">unidades</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2">
                Ant: {reportData.kpi.prevUnitsSold} un.
              </p>
            </div>
          </div>

          {/* Card 5: Margen Bruto Estimado */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Margen Estimado</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                {formatCLP(reportData.kpi.estimatedMargin)}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] font-bold text-lilac-700 dark:text-lilac-300 bg-lilac-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-transparent dark:border-lilac-700/50">
                  {reportData.kpi.marginPercentage}% margen
                </span>
                <span className="text-[11px] text-slate-400">bruto</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Charts Grid */}
      {reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Sales Over Time (Span 2 Cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                  {periodType === 'today' ? 'Ventas por Hora' : 'Tendencia de Ventas en el Tiempo'}
                </h2>
              </div>
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[11px] font-semibold border border-slate-200/60 dark:border-slate-700">
                <button
                  onClick={() => setSalesChartMetric('amount')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    salesChartMetric === 'amount'
                      ? 'bg-lilac-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Monto ($ CLP)
                </button>
                <button
                  onClick={() => setSalesChartMetric('count')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    salesChartMetric === 'count'
                      ? 'bg-lilac-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Transacciones
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              {reportData.salesOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData.salesOverTime} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      axisLine={{ stroke: isDark ? '#334155' : '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => (salesChartMetric === 'amount' ? `$ ${(val / 1000).toFixed(0)}k` : val)}
                    />
                    <Tooltip content={renderCustomSalesTooltip} />
                    <Area
                      type="monotone"
                      dataKey={salesChartMetric === 'amount' ? 'total' : 'count'}
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No hay datos de ventas en este período.
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Payment Methods (1 Col) */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Métodos de Pago</h2>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              {reportData.kpi.totalSales > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.paymentMethods.filter((p) => p.total > 0)}
                      dataKey="total"
                      nameKey="methodName"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {reportData.paymentMethods.map((entry) => (
                        <Cell
                          key={entry.method}
                          fill={PAYMENT_COLORS[entry.methodName] || '#8B5CF6'}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={renderPaymentPieTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">Sin transacciones registradas</div>
              )}
            </div>

            {/* Payment Method Badges */}
            <div className="space-y-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs">
              {reportData.paymentMethods.map((method) => (
                <div key={method.method} className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PAYMENT_COLORS[method.methodName] }}
                    />
                    <span>{method.methodName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800 dark:text-white mr-2">{formatCLP(method.total)}</span>
                    <span className="text-[11px] text-slate-400">({method.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Secondary Grid: Top Products and Category Distribution */}
      {reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Products Chart / List */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Top 10 Productos Más Vendidos</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Por unidades vendidas</span>
            </div>

            {reportData.topProducts.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportData.topProducts}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridStroke} />
                    <XAxis type="number" tick={{ fill: chartTickFill, fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      tickFormatter={(val) => (val.length > 18 ? `${val.slice(0, 18)}…` : val)}
                    />
                    <Tooltip
                      formatter={(value: any, _name: any, item: any) => [
                        `${value} un. (${formatCLP(item.payload.totalRevenue)})`,
                        'Unidades'
                      ]}
                      labelFormatter={(label) => `Producto: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '0.75rem',
                        border: '1px solid #334155',
                        color: '#F8FAFC',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="unitsSold" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                No hay ventas registradas para generar el ranking de productos.
              </div>
            )}
          </div>

          {/* Sales By Category Chart */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Ventas por Categoría</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Por recaudación ($)</span>
            </div>

            {reportData.categorySales.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.categorySales} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                    <XAxis
                      dataKey="categoryName"
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any, _name: any, item: any) => [
                        `${formatCLP(Number(value))} (${item.payload.percentage}% del total)`,
                        'Recaudado'
                      ]}
                      labelFormatter={(label) => `Categoría: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '0.75rem',
                        border: '1px solid #334155',
                        color: '#F8FAFC',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="totalRevenue" radius={[6, 6, 0, 0]}>
                      {reportData.categorySales.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                No hay ventas por categoría para el período seleccionado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Ventas por Proveedor */}
      {reportData && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Ventas por Proveedor</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Por recaudación ($) y unidades</span>
          </div>

          {reportData.supplierSales && reportData.supplierSales.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Barras por Proveedor */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.supplierSales} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                    <XAxis
                      dataKey="supplierName"
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fill: chartTickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any, _name: any, item: any) => [
                        `${formatCLP(Number(value))} (${item.payload.percentage}% del total)`,
                        'Recaudado'
                      ]}
                      labelFormatter={(label) => `Proveedor: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '0.75rem',
                        border: '1px solid #334155',
                        color: '#F8FAFC',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="totalRevenue" radius={[6, 6, 0, 0]}>
                      {reportData.supplierSales.map((_entry, index) => (
                        <Cell key={`cell-supp-${index}`} fill={SUPPLIER_COLORS[index % SUPPLIER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla Resumen de Proveedores */}
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/70 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Proveedor</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      <th className="py-2.5 px-3 text-right">Recaudación</th>
                      <th className="py-2.5 px-3 text-right">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium text-slate-700 dark:text-slate-200">
                    {reportData.supplierSales.map((s, idx) => (
                      <tr key={idx} className="hover:bg-lilac-50/40 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length] }}
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-100">{s.supplierName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-200">{s.unitsSold}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-lilac-700 dark:text-lilac-300">
                          {formatCLP(s.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {s.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
              No hay ventas por proveedor para el período seleccionado.
            </div>
          )}
        </div>
      )}

      {/* 6. Detailed Ranking Table */}
      {reportData && reportData.topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Detalle de Productos Vendidos en el Período</h2>
            <span className="text-xs text-slate-400 font-medium">
              {reportData.topProducts.length} productos con mayor rotación
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-700">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/70 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                  <th className="py-2.5 px-3 text-center">Unidades</th>
                  <th className="py-2.5 px-3 text-right">Total Recaudado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium text-slate-700 dark:text-slate-200">
                {reportData.topProducts.map((p, idx) => (
                  <tr key={p.code} className="hover:bg-lilac-50/40 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">{p.code}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 border border-transparent dark:border-slate-600">
                        {p.categoryName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatCLP(p.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">{p.unitsSold}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-lilac-700 dark:text-lilac-300">
                      {formatCLP(p.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
