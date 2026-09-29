import React, { useState, useEffect } from 'react'
import {
  FileText,
  ArrowUpRight,
  Search,
  Calendar,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  X,
  Plus,
  Minus,
  DollarSign,
  Clock,
  Package,
  ShoppingBag,
  Banknote,
  CornerDownLeft,
  Printer
} from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { useCashStore } from '../store/cashStore'
import { formatCLP, formatDateTime, parseCLP } from '../utils/formatters'

const QUICK_WITHDRAWAL_REASONS = [
  'Pago a Proveedor',
  'Retiro de Efectivo',
  'Compra de Insumos',
  'Flete / Encomienda',
  'Anticipo de Sueldo',
  'Gastos Varios de Caja'
]

export const HistoryView: React.FC = () => {
  const {
    activeSubTab,
    setActiveSubTab,
    sales,
    filter,
    setDateFilter,
    setFolioFilter,
    setStatusFilter,
    clearFilters,
    fetchSalesHistory,
    selectedSaleDetail,
    openSaleDetail,
    closeSaleDetail,
    cancelSale,
    returnSaleItem,
    cashMovements,
    fetchCashMovements,
    addCashMovement,
    isLoading,
    error,
    clearError
  } = useHistoryStore()

  const { currentSession, fetchSummary } = useCashStore()

  // Estado local para modal de cancelación completa
  const [saleToCancel, setSaleToCancel] = useState<{ id: number; folio: number; total: number } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Estado local para devolución por item
  const [returningItemCode, setReturningItemCode] = useState<string | null>(null)
  const [returnQuantity, setReturnQuantity] = useState(1)
  const [returnReason, setReturnReason] = useState('')
  const [isReturning, setIsReturning] = useState(false)

  // Estado local para formulario de salida de dinero
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [withdrawalSuccessMsg, setWithdrawalSuccessMsg] = useState<string | null>(null)
  const [withdrawalErrorMsg, setWithdrawalErrorMsg] = useState<string | null>(null)
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false)

  // Estado local para impresión desde detalle de venta
  const [isPrintingThermal, setIsPrintingThermal] = useState(false)
  const [isPrintingNormal, setIsPrintingNormal] = useState(false)
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Cargar datos al montar
  useEffect(() => {
    fetchSalesHistory()
  }, [])

  useEffect(() => {
    if (currentSession?.id) {
      fetchCashMovements(currentSession.id)
    }
  }, [currentSession?.id])

  // Helper para obtener string de hoy
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

  // Abrir modal de cancelación
  const handleOpenCancelModal = (id: number, folio: number, total: number): void => {
    setCancelReason('')
    setCancelError(null)
    setSaleToCancel({ id, folio, total })
  }

  // Manejo de cancelación total de la venta
  const handleConfirmCancelSale = async (): Promise<void> => {
    if (!saleToCancel) return
    setIsCancelling(true)
    setCancelError(null)

    const success = await cancelSale(saleToCancel.id, cancelReason)
    setIsCancelling(false)
    if (success) {
      setSuccessBanner(`Venta Folio #${saleToCancel.folio} anulada correctamente. Stock repuesto.`)
      setTimeout(() => setSuccessBanner(null), 5000)
      setSaleToCancel(null)
      setCancelReason('')
      // Si hay una sesión activa, actualizar el resumen de corte en tiempo real
      if (currentSession?.id) {
        fetchSummary(currentSession.id)
      }
    } else {
      setCancelError(useHistoryStore.getState().error || 'Error al anular la venta.')
    }
  }

  // Manejo de devolución de un item específico
  const handleConfirmReturnItem = async (productCode: string): Promise<void> => {
    if (!selectedSaleDetail) return
    setIsReturning(true)
    const success = await returnSaleItem(
      selectedSaleDetail.id,
      productCode,
      returnQuantity,
      returnReason
    )
    setIsReturning(false)
    if (success) {
      setReturningItemCode(null)
      setReturnQuantity(1)
      setReturnReason('')
    }
  }

  // Manejo del registro de salida de dinero
  const handleRegisterWithdrawal = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setWithdrawalSuccessMsg(null)
    setWithdrawalErrorMsg(null)

    if (!currentSession?.id) {
      setWithdrawalErrorMsg('No hay una sesión de caja activa')
      return
    }

    const amount = parseCLP(withdrawalAmount)
    if (amount <= 0) {
      setWithdrawalErrorMsg('Ingresa un monto válido mayor a cero')
      return
    }

    if (!withdrawalReason.trim()) {
      setWithdrawalErrorMsg('Debes especificar un motivo para la salida de dinero')
      return
    }

    setIsSubmittingWithdrawal(true)
    const success = await addCashMovement(currentSession.id, amount, withdrawalReason.trim())
    setIsSubmittingWithdrawal(false)

    if (success) {
      setWithdrawalSuccessMsg(`Salida por ${formatCLP(amount)} registrada correctamente`)
      setWithdrawalAmount('')
      setWithdrawalReason('')
      setTimeout(() => setWithdrawalSuccessMsg(null), 4000)
    }
  }

  const totalCashWithdrawals = cashMovements.reduce((acc, m) => acc + m.amount, 0)

  // Impresión de ticket desde detalle de venta
  const handlePrintThermalFromDetail = async (): Promise<void> => {
    if (!selectedSaleDetail) return
    setIsPrintingThermal(true)
    setPrintFeedback(null)
    try {
      const res = await window.api.printThermalReceipt(selectedSaleDetail, 0)
      if (res.success) {
        setPrintFeedback({ type: 'success', text: '¡Ticket térmico enviado a la impresora!' })
      } else {
        setPrintFeedback({ type: 'error', text: res.error || 'Error al imprimir ticket.' })
      }
    } catch (err: any) {
      setPrintFeedback({ type: 'error', text: err.message || 'Error al imprimir ticket térmico.' })
    } finally {
      setIsPrintingThermal(false)
    }
  }

  const handlePrintNormalFromDetail = async (): Promise<void> => {
    if (!selectedSaleDetail) return
    setIsPrintingNormal(true)
    setPrintFeedback(null)
    try {
      const res = await window.api.printNormalReceipt(selectedSaleDetail)
      if (res.success) {
        setPrintFeedback({ type: 'success', text: '¡Comprobante enviado a la impresora de Windows!' })
      } else {
        setPrintFeedback({ type: 'error', text: res.error || 'Error al imprimir comprobante.' })
      }
    } catch (err: any) {
      setPrintFeedback({ type: 'error', text: err.message || 'Error al imprimir comprobante.' })
    } finally {
      setIsPrintingNormal(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Subtabs Bar */}
      <div className="bg-white border-b border-lilac-200 px-6 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('sales')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'sales'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Ventas y Devoluciones</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === 'sales' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {sales.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cash_movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'cash_movements'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Salidas de Dinero</span>
            {cashMovements.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeSubTab === 'cash_movements'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {cashMovements.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-rose-500 hover:text-rose-800 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Banner de éxito */}
      {successBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Subtab Content */}
      {activeSubTab === 'sales' ? (
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
          <div className="bg-white border border-lilac-100 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 shrink-0">
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

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filter.status === 'all'
                      ? 'bg-white shadow-sm text-slate-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filter.status === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Completadas
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cancelled')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    filter.status === 'cancelled'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Canceladas
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Limpiar filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
              <button
                type="button"
                onClick={() => fetchSalesHistory()}
                className="px-3 py-1.5 rounded-lg bg-lilac-50 border border-lilac-200 text-lilac-700 hover:bg-lilac-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Sales Table */}
          <div className="flex-1 bg-white border border-lilac-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 z-10 text-xs font-semibold text-slate-600 border-b border-slate-200 backdrop-blur-sm">
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
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => openSaleDetail(s.id)}
                        >
                          {/* Folio */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                #{s.folio}
                              </span>
                              <span className="text-[11px] font-semibold text-lilac-700 bg-lilac-50 px-1.5 py-0.5 rounded">
                                Ticket #{s.ticket_number ?? 0}
                              </span>
                            </div>
                          </td>

                          {/* Fecha / Hora */}
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {formatDateTime(s.created_at)}
                          </td>

                          {/* Métodos de Pago */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.payments && s.payments.length > 0 ? (
                                s.payments.map((p) => {
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

                                  return (
                                    <span
                                      key={p.id}
                                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}
                                    >
                                      {label} {formatCLP(p.amount)}
                                    </span>
                                  )
                                })
                              ) : (
                                <span className="text-slate-400 italic">Sin registro</span>
                              )}
                            </div>
                          </td>

                          {/* Artículos */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-bold text-slate-700">
                              {s.total_items} un.
                              {s.returned_items_count > 0 && (
                                <span className="block text-[10px] font-medium text-rose-600">
                                  ({s.returned_items_count} devuelta{s.returned_items_count > 1 ? 's' : ''})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-black text-sm ${
                                isCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {formatCLP(s.total)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-4 text-center">
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
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openSaleDetail(s.id)}
                                className="px-2.5 py-1 rounded-lg bg-lilac-50 text-lilac-700 hover:bg-lilac-100 border border-lilac-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                                title="Ver detalle completo de la venta"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detalle</span>
                              </button>

                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelModal(s.id, s.folio, s.total)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                                  title="Anular venta completa"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Anular</span>
                                </button>
                              )}
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
      ) : (
        /* Subtab 2: Salidas de Dinero */
        <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
          {/* Header Banner: Sesión Activa */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Salidas de Efectivo de Caja
                </h3>
                <p className="text-xs text-slate-500">
                  {currentSession
                    ? `Sesión Activa #${currentSession.id} — Fondo de apertura: ${formatCLP(
                        currentSession.opening_fund
                      )}`
                    : 'No hay una sesión de caja abierta actualmente'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500">Total Salidas de esta Sesión:</span>
              <p className="text-2xl font-black text-amber-700">{formatCLP(totalCashWithdrawals)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Formulario de Salida */}
            <div className="md:col-span-5 bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm flex flex-col">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-amber-600" />
                <span>Registrar Nueva Salida</span>
              </h4>

              {withdrawalSuccessMsg && (
                <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{withdrawalSuccessMsg}</span>
                </div>
              )}

              {withdrawalErrorMsg && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{withdrawalErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleRegisterWithdrawal} className="flex flex-col gap-4">
                {/* Monto */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto a Retirar ($ CLP) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={withdrawalAmount ? formatCLP(parseCLP(withdrawalAmount)).replace('$ ', '') : ''}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-base font-bold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
                      disabled={!currentSession}
                    />
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motivo / Destino del Dinero <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Pago de flete, compra de cinta adhesiva..."
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    disabled={!currentSession}
                  />
                </div>

                {/* Chips de Motivos Frecuentes */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Motivos sugeridos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_WITHDRAWAL_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setWithdrawalReason(reason)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 text-[11px] text-slate-600 transition-colors"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!currentSession || isSubmittingWithdrawal}
                  className="mt-2 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>
                    {isSubmittingWithdrawal ? 'Registrando...' : 'Registrar Salida de Dinero'}
                  </span>
                </button>
              </form>
            </div>

            {/* Tabla de Salidas Registradas */}
            <div className="md:col-span-7 bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Salidas Registradas en esta Sesión</span>
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  {cashMovements.length} registro{cashMovements.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex-1 border border-slate-100 rounded-xl overflow-hidden overflow-y-auto max-h-[380px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-28">Hora</th>
                      <th className="py-2 px-3">Motivo</th>
                      <th className="py-2 px-3 text-right w-32">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {cashMovements.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-slate-400">
                          <p className="font-semibold text-slate-500">No hay salidas registradas</p>
                          <p className="text-[11px] text-slate-400">
                            Cualquier retiro de efectivo quedará auditado aquí
                          </p>
                        </td>
                      </tr>
                    ) : (
                      cashMovements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-500 font-mono text-[11px]">
                            {formatDateTime(mov.created_at)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{mov.reason}</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-700">
                            − {formatCLP(mov.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {cashMovements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Total salidas de caja:</span>
                  <span className="font-black text-base text-amber-700">
                    {formatCLP(totalCashWithdrawals)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Venta y Gestión de Devoluciones */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-black">
                  #{selectedSaleDetail.folio}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Venta Folio #{selectedSaleDetail.folio}
                    </h3>
                    <span className="text-xs font-semibold text-lilac-700 bg-lilac-50 px-2.5 py-0.5 rounded-full border border-lilac-200">
                      Ticket #{selectedSaleDetail.ticket_number ?? 0}
                    </span>
                    {selectedSaleDetail.status === 'cancelled' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        Cancelada
                      </span>
                    ) : selectedSaleDetail.returned_items_count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        Devolución Parcial
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        Completada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Registrada el {formatDateTime(selectedSaleDetail.created_at)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeSaleDetail}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Desglose de Pagos y Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total de la Venta</span>
                  <span className="text-xl font-black text-slate-900">
                    {formatCLP(selectedSaleDetail.total)}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Formas de Pago Registradas
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {selectedSaleDetail.payments.map((p) => {
                      const label =
                        p.method === 'cash'
                          ? 'Efectivo'
                          : p.method === 'card'
                          ? 'Tarjeta'
                          : 'Transferencia'
                      return (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700"
                        >
                          {label}: {formatCLP(p.amount)}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Estado de Unidades
                  </span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">
                    {selectedSaleDetail.total_items} un. vendidas
                    {selectedSaleDetail.returned_items_count > 0 && (
                      <span className="text-rose-600 ml-1.5 font-semibold">
                        ({selectedSaleDetail.returned_items_count} devueltas)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Tabla de Productos de la Venta */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Productos en esta Venta
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-28">Código</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-right w-24">P. Unitario</th>
                        <th className="py-2.5 px-3 text-center w-24">Vendidos</th>
                        <th className="py-2.5 px-3 text-center w-24">Devueltos</th>
                        <th className="py-2.5 px-3 text-right w-28">Importe</th>
                        <th className="py-2.5 px-3 text-right w-24">Stock Actual</th>
                        <th className="py-2.5 px-3 text-center w-40">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedSaleDetail.items.map((it) => {
                        const availableToReturn = it.quantity - it.returned_qty
                        const isFullyReturned = availableToReturn <= 0
                        const isRowReturning = returningItemCode === it.product_code

                        return (
                          <React.Fragment key={it.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3 font-mono font-medium text-slate-600">
                                {it.product_code}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-800">{it.name}</td>
                              <td className="py-3 px-3 text-right font-medium text-slate-700">
                                {formatCLP(it.unit_price)}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-800">
                                {it.quantity}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {it.returned_qty > 0 ? (
                                  <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                                    {it.returned_qty} un.
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-black text-slate-900">
                                {formatCLP(it.unit_price * it.quantity)}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-600">
                                {it.current_stock ?? '—'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {selectedSaleDetail.status === 'cancelled' || isFullyReturned ? (
                                  <span className="text-[11px] font-semibold text-slate-400 italic">
                                    {isFullyReturned ? 'Devuelto 100%' : 'Venta cancelada'}
                                  </span>
                                ) : isRowReturning ? (
                                  <button
                                    type="button"
                                    onClick={() => setReturningItemCode(null)}
                                    className="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-[11px] font-semibold"
                                  >
                                    Cancelar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReturningItemCode(it.product_code)
                                      setReturnQuantity(1)
                                      setReturnReason('')
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                                  >
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span>Devolver...</span>
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Subfila inline para configurar devolución de este producto */}
                            {isRowReturning && (
                              <tr className="bg-rose-50/50 border-y border-rose-200">
                                <td colSpan={8} className="p-3">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-700">
                                        Cantidad a devolver:
                                      </span>
                                      <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReturnQuantity((prev) => Math.max(1, prev - 1))
                                          }
                                          className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <input
                                          type="number"
                                          min={1}
                                          max={availableToReturn}
                                          value={returnQuantity}
                                          onChange={(e) => {
                                            const v = parseInt(e.target.value, 10)
                                            if (!isNaN(v)) {
                                              setReturnQuantity(
                                                Math.min(availableToReturn, Math.max(1, v))
                                              )
                                            }
                                          }}
                                          className="w-12 text-center text-xs font-bold py-1 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReturnQuantity((prev) =>
                                              Math.min(availableToReturn, prev + 1)
                                            )
                                          }
                                          className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <span className="text-[11px] text-slate-500">
                                        (máx {availableToReturn})
                                      </span>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                      <input
                                        type="text"
                                        placeholder="Motivo de la devolución (opcional)..."
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500 bg-white"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmReturnItem(it.product_code)}
                                        disabled={isReturning}
                                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 transition-colors"
                                      >
                                        {isReturning ? 'Procesando...' : 'Confirmar Devolución'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setReturningItemCode(null)}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white text-xs font-medium"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botón de Cancelación Total si la venta aún no está cancelada */}
              {selectedSaleDetail.status !== 'cancelled' && (
                <div className="mt-2 pt-4 border-t border-slate-200 flex items-center justify-between bg-rose-50/40 p-4 rounded-2xl border border-rose-100">
                  <div>
                    <h5 className="text-xs font-bold text-rose-900">¿Deseas anular la venta completa?</h5>
                    <p className="text-[11px] text-rose-700">
                      Restaurará el 100% de las unidades restantes al inventario y marcará el folio como cancelado.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenCancelModal(
                        selectedSaleDetail.id,
                        selectedSaleDetail.folio,
                        selectedSaleDetail.total
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 shrink-0"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancelar Venta Completa</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
              {/* Print Feedback */}
              {printFeedback && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    printFeedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {printFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{printFeedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedSaleDetail.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenCancelModal(
                          selectedSaleDetail.id,
                          selectedSaleDetail.folio,
                          selectedSaleDetail.total
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancelar Venta</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePrintThermalFromDetail}
                    disabled={isPrintingThermal}
                    className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-lilac-600" />
                    <span>{isPrintingThermal ? 'Imprimiendo...' : 'Ticket Térmico'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintNormalFromDetail}
                    disabled={isPrintingNormal}
                    className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-lilac-600" />
                    <span>{isPrintingNormal ? 'Imprimiendo...' : 'Comprobante Normal'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { closeSaleDetail(); setPrintFeedback(null) }}
                  className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
                >
                  Cerrar Detalle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submodal de Confirmación: Cancelación Total de la Venta */}
      {saleToCancel && (
        <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  ¿Confirmar Anulación de Venta?
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Folio #{saleToCancel.folio} · Total: {formatCLP(saleToCancel.total)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta acción revertirá las unidades vendidas al stock de cada producto mediante un movimiento
              de inventario de tipo <strong>devolución</strong>. Esta acción no se puede deshacer.
            </p>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{cancelError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo de cancelación (opcional):
              </label>
              <input
                type="text"
                placeholder="Ej: Cliente canceló compra, error de digitación..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 text-slate-800"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSaleToCancel(null)
                  setCancelError(null)
                }}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelSale}
                disabled={isCancelling}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isCancelling ? 'Anulando...' : 'Sí, Anular Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
