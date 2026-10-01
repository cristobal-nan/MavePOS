import {
  FileText,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ShoppingBag,
  DollarSign,
  Package,
  CornerDownLeft
} from 'lucide-react'
import { useHistoryStore } from '../../store/historyStore'
import { formatCLP, formatDateTime } from '../../utils/formatters'

interface SalesHistoryTabProps {
  onOpenCancelModal?: (id: number, folio: number, total: number) => void
}

export const SalesHistoryTab: React.FC<SalesHistoryTabProps> = () => {
  const {
    sales,
    filter,
    setDateFilter,
    setFolioFilter,
    openSaleDetail
  } = useHistoryStore()

  const getTodayString = (): string => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Cálculos estadísticos rápidos para las tarjetas de resumen
  const completedSales = sales.filter((s) => s.status === 'completed')
  const cancelledSales = sales.filter((s) => s.status === 'cancelled')
  const totalCompletedAmount = completedSales.reduce((acc, s) => acc + s.total, 0)
  const totalItemsSold = completedSales.reduce((acc, s) => acc + s.total_items, 0)
  const totalItemsReturned = sales.reduce((acc, s) => acc + s.returned_items_count, 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-lilac-50 text-lilac-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">Ventas Completadas</p>
            <p className="text-lg font-black text-slate-800">{completedSales.length}</p>
          </div>
        </div>

        <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">Total Facturado</p>
            <p className="text-lg font-black text-emerald-600">
              {formatCLP(totalCompletedAmount)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">Artículos Vendidos</p>
            <p className="text-lg font-black text-slate-800">{totalItemsSold} un.</p>
          </div>
        </div>

        <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <CornerDownLeft className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">Devoluciones / Anuladas</p>
            <p className="text-lg font-black text-rose-600">
              {cancelledSales.length}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({totalItemsReturned} un. devueltas)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Fecha */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filter.date}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setDateFilter(getTodayString())}
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                filter.date === getTodayString()
                  ? 'bg-lilac-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
              title="Ver ventas de hoy"
            >
              Hoy
            </button>
            {filter.date && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-[11px] text-slate-500 hover:text-slate-800 ml-1 underline"
                title="Mostrar todas las fechas"
              >
                Todas
              </button>
            )}
          </div>

          {/* Búsqueda por Folio */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por Folio #..."
              value={filter.folioStr}
              onChange={(e) => setFolioFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 w-full focus:outline-none placeholder:text-slate-400"
            />
            {filter.folioStr && (
              <button
                type="button"
                onClick={() => setFolioFilter('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="flex-1 bg-white border border-lilac-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-28">Folio</th>
                <th className="py-2.5 px-4 w-44">Fecha / Hora</th>
                <th className="py-2.5 px-4">Métodos de Pago</th>
                <th className="py-2.5 px-4 text-center w-32">Artículos</th>
                <th className="py-2.5 px-4 text-right w-36">Total</th>
                <th className="py-2.5 px-4 text-center w-36">Estado</th>
                <th className="py-2.5 px-4 text-center w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No se encontraron ventas</p>
                      <p className="text-xs text-slate-400">
                        Prueba ajustando la fecha o los filtros de búsqueda
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const isCancelled = s.status === 'cancelled'
                  const hasPartialReturn =
                    !isCancelled && s.returned_items_count > 0 && s.returned_items_count < s.total_items

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Folio */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          #{s.folio}
                        </span>
                      </td>

                      {/* Fecha / Hora */}
                      <td className="py-2.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDateTime(s.created_at)}
                      </td>

                      {/* Métodos de Pago */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const isExchangeSale = Boolean(s.exchange_parent_id)
                            const paymentsSum = s.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0
                            const devolutionAmount = isExchangeSale ? s.total - paymentsSum : 0

                            const badges: React.ReactNode[] = []

                            if (devolutionAmount > 0) {
                              badges.push(
                                <span
                                  key="devolution"
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-amber-50 text-amber-800 border-amber-300"
                                >
                                  Devolución {formatCLP(devolutionAmount)}
                                </span>
                              )
                            }

                            if (s.payments && s.payments.length > 0) {
                              s.payments.forEach((p) => {
                                const label =
                                  p.method === 'cash'
                                    ? 'Efectivo'
                                    : p.method === 'card'
                                    ? 'Tarjeta'
                                    : 'Transferencia'
                                const color =
                                  p.method === 'cash'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : p.method === 'card'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'

                                badges.push(
                                  <span
                                    key={p.id}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}
                                  >
                                    {label} {formatCLP(p.amount)}
                                  </span>
                                )
                              })
                            }

                            if (badges.length === 0) {
                              return <span className="text-slate-400 italic">Sin registro</span>
                            }

                            return badges
                          })()}
                        </div>
                      </td>

                      {/* Artículos */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-700">
                          {s.total_items} un.
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {formatCLP(s.total)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Cancelada
                          </span>
                        ) : hasPartialReturn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <CornerDownLeft className="w-3 h-3" />
                            Devolución Parcial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Completada
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => openSaleDetail(s.id)}
                            className="px-2.5 py-1 rounded-lg bg-lilac-50 text-lilac-700 hover:bg-lilac-100 border border-lilac-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ver detalle completo de la venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detalle</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
