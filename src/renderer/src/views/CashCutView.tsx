import React, { useState, useEffect } from 'react'
import {
  Calculator,
  RotateCcw,
  Banknote,
  CreditCard,
  Send,
  ArrowUpRight,
  CornerDownLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Coins,
  Printer,
  Clock,
  DollarSign,
  Lock,
  X
} from 'lucide-react'
import { useCashStore } from '../store/cashStore'
import { formatCLP, formatDateTime, parseCLP } from '../utils/formatters'
import { CashSession } from '@shared/types'

// Denominaciones chilenas de billetes y monedas para calculadora de arqueo
const CHILEAN_DENOMINATIONS = [
  { value: 20000, label: '$20.000', type: 'bill' },
  { value: 10000, label: '$10.000', type: 'bill' },
  { value: 5000, label: '$5.000', type: 'bill' },
  { value: 2000, label: '$2.000', type: 'bill' },
  { value: 1000, label: '$1.000', type: 'bill' },
  { value: 500, label: '$500', type: 'coin' },
  { value: 100, label: '$100', type: 'coin' },
  { value: 50, label: '$50', type: 'coin' },
  { value: 10, label: '$10', type: 'coin' }
]

type CashCutTab = 'active' | 'history'

export const CashCutView: React.FC = () => {
  const {
    currentSession,
    currentSummary,
    pastSessions,
    isSummaryLoading,
    fetchSummary,
    fetchPastSessions,
    closeSession,
    error,
    clearError
  } = useCashStore()

  const [activeTab, setActiveTab] = useState<CashCutTab>('active')

  // Estado del arqueo físico
  const [countMode, setCountMode] = useState<'direct' | 'denominations'>('direct')
  const [directAmountInput, setDirectAmountInput] = useState<string>('')
  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    10: 0
  })
  const [notes, setNotes] = useState<string>('')

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [completedCutData, setCompletedCutData] = useState<any | null>(null)
  const [isClosing, setIsClosing] = useState(false)

  // Modal para ver detalle de sesión histórica
  const [selectedPastSession, setSelectedPastSession] = useState<CashSession | null>(null)

  // Cargar datos al montar
  useEffect(() => {
    if (currentSession?.id) {
      fetchSummary(currentSession.id)
    }
    fetchPastSessions()
  }, [currentSession?.id])

  // Calcular efectivo contado según el modo activo
  const calculateCountedCash = (): number => {
    if (countMode === 'direct') {
      return parseCLP(directAmountInput)
    } else {
      return Object.entries(denominationCounts).reduce((total, [denom, count]) => {
        return total + parseInt(denom, 10) * (count || 0)
      }, 0)
    }
  }

  const countedCash = calculateCountedCash()
  const expectedCash = currentSummary ? currentSummary.expectedCash : 0
  const difference = countedCash - expectedCash

  // Manejo de actualización de denominaciones
  const handleDenominationChange = (value: number, count: number): void => {
    setDenominationCounts((prev) => ({
      ...prev,
      [value]: Math.max(0, isNaN(count) ? 0 : count)
    }))
  }

  // Confirmar y ejecutar el cierre de turno
  const handleExecuteCloseSession = async (): Promise<void> => {
    if (!currentSession) return
    setIsClosing(true)

    const closingData = {
      closingCash: countedCash,
      expectedCash,
      difference,
      notes: notes.trim() || undefined
    }

    // Guardamos una copia para el comprobante
    const receiptData = {
      ...currentSummary,
      closingCash: countedCash,
      difference,
      notes: notes.trim(),
      closedAt: new Date().toISOString()
    }

    const success = await closeSession(currentSession.id, closingData)
    setIsClosing(false)

    if (success) {
      setIsConfirmModalOpen(false)
      setCompletedCutData(receiptData)
      setIsReceiptModalOpen(true)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Bar with Subtabs */}
      <div className="bg-white border-b border-lilac-200 px-6 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'active'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Corte de Turno Actual</span>
            {currentSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historial de Cortes</span>
            {pastSessions.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pastSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* Refresh and Alerts */}
        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="text-rose-500 hover:text-rose-800 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {currentSession && (
            <button
              type="button"
              onClick={() => fetchSummary(currentSession.id)}
              disabled={isSummaryLoading}
              className="px-3 py-1.5 rounded-lg bg-lilac-50 border border-lilac-200 text-lilac-700 hover:bg-lilac-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar Resumen</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'active' ? (
        !currentSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              No hay una sesión de caja abierta
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Para realizar un corte y arqueo es necesario abrir caja con un fondo inicial en el inicio del turno.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              Ver Historial de Cortes Anteriores
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
            {/* Header: Datos de la Sesión */}
            <div className="bg-gradient-to-r from-lilac-500/10 via-lilac-500/5 to-transparent border border-lilac-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-md shadow-lilac-600/20 font-black text-lg">
                  #{currentSession.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Corte de Turno — Sesión #{currentSession.id}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Sesión Activa
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Apertura: {formatDateTime(currentSession.opened_at)}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block">
                  Fondo Inicial de Apertura
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {formatCLP(currentSession.opening_fund)}
                </span>
              </div>
            </div>

            {/* Grid de Métricas Financieras */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Ventas Efectivo */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Ventas en Efectivo</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-700">
                  {formatCLP(currentSummary?.salesCash ?? 0)}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Cobrado en efectivo</span>
              </div>

              {/* Ventas Tarjeta */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Ventas con Tarjeta</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-blue-700">
                  {formatCLP(currentSummary?.salesCard ?? 0)}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Débito / Crédito POS</span>
              </div>

              {/* Ventas Transferencia */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Ventas Transferencia</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-black text-purple-700">
                  {formatCLP(currentSummary?.salesTransfer ?? 0)}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Transferencia bancaria</span>
              </div>

              {/* Total Ventas Bruto */}
              <div className="bg-white border border-lilac-200 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-white to-lilac-50/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-lilac-900">Total Ventas Emitidas</span>
                  <div className="w-7 h-7 rounded-lg bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                    {currentSummary?.salesCount ?? 0}
                  </div>
                </div>
                <div className="text-xl font-black text-slate-900">
                  {formatCLP(currentSummary?.salesTotal ?? 0)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {currentSummary?.salesCount ?? 0} ventas registradas
                </span>
              </div>
            </div>

            {/* Fila Secundaria: Devoluciones, Salidas y Ventas Netas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Devoluciones */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <CornerDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Devoluciones y Anuladas</span>
                    <span className="text-[11px] text-slate-400">
                      {currentSummary?.returnsCount ?? 0} devolución(es)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-rose-600 block">
                    − {formatCLP(currentSummary?.returnsTotal ?? 0)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    (efectivo: {formatCLP(currentSummary?.returnsCash ?? 0)})
                  </span>
                </div>
              </div>

              {/* Salidas de Dinero */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Salidas de Dinero</span>
                    <span className="text-[11px] text-slate-400">
                      {currentSummary?.withdrawalsCount ?? 0} retiro(s) de caja
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-700 block">
                    − {formatCLP(currentSummary?.withdrawalsTotal ?? 0)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Gastos de turno</span>
                </div>
              </div>

              {/* Ventas Netas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Ventas Netas</span>
                    <span className="text-[11px] text-slate-400">Total ventas − Devoluciones</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-900 block">
                    {formatCLP(currentSummary?.netSales ?? 0)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">Ingreso neto real</span>
                </div>
              </div>
            </div>

            {/* Fórmula de Cuadre de Efectivo Esperado */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-lilac-300 block mb-1">
                  Efectivo Esperado en Gaveta
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  Fondo Inicial ({formatCLP(currentSession.opening_fund)}) + Ventas Efectivo (
                  {formatCLP(currentSummary?.salesCash ?? 0)}) − Devoluciones Efectivo (
                  {formatCLP(currentSummary?.returnsCash ?? 0)}) − Salidas (
                  {formatCLP(currentSummary?.withdrawalsTotal ?? 0)})
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400 font-medium block">Total que debe haber:</span>
                <span className="text-3xl font-black text-emerald-400 tracking-tight">
                  {formatCLP(expectedCash)}
                </span>
              </div>
            </div>

            {/* Sección de Arqueo Físico */}
            <div className="bg-white border border-lilac-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-lilac-600" />
                    <span>Arqueo Físico de Efectivo</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cuenta el dinero físico que hay actualmente en el cajón y compáralo con el esperado.
                  </p>
                </div>

                {/* Selector de Modo */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCountMode('direct')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      countMode === 'direct'
                        ? 'bg-white shadow-sm text-slate-900'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Monto Directo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountMode('denominations')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      countMode === 'denominations'
                        ? 'bg-white shadow-sm text-slate-900'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Calculadora de Billetes
                  </button>
                </div>
              </div>

              {/* Modo Directo */}
              {countMode === 'direct' ? (
                <div className="max-w-md">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Total de Efectivo Físico Contado ($ CLP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={directAmountInput ? formatCLP(parseCLP(directAmountInput)).replace('$ ', '') : ''}
                      onChange={(e) => setDirectAmountInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-xl font-black text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-500/20 focus:border-lilac-500 bg-slate-50/50"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                /* Modo Desglose por Denominación */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {CHILEAN_DENOMINATIONS.map((d) => {
                    const count = denominationCounts[d.value] || 0
                    const subtotal = d.value * count
                    return (
                      <div
                        key={d.value}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800">{d.label}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              d.type === 'bill'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {d.type === 'bill' ? 'Billete' : 'Moneda'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={count || ''}
                            onChange={(e) =>
                              handleDenominationChange(d.value, parseInt(e.target.value, 10))
                            }
                            className="w-full px-2 py-1 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg bg-white text-center focus:outline-none focus:border-lilac-500"
                          />
                          <span className="text-[11px] text-slate-400 font-medium">un.</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 mt-1.5 text-right block">
                          {formatCLP(subtotal)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Comparador de Cuadre: Esperado vs Real */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Efectivo Esperado
                    </span>
                    <span className="text-lg font-bold text-slate-800">
                      {formatCLP(expectedCash)}
                    </span>
                  </div>

                  <div className="text-slate-300 text-xl font-light">vs</div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Efectivo Contado Real
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {formatCLP(countedCash)}
                    </span>
                  </div>
                </div>

                {/* Badge de Diferencia */}
                <div>
                  {difference === 0 ? (
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Caja Cuadrada Exacta ($ 0)</span>
                    </div>
                  ) : difference > 0 ? (
                    <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>Sobrante en Caja: +{formatCLP(difference)}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Faltante en Caja: −{formatCLP(Math.abs(difference))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones del Turno */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones / Notas del Cierre (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre diferencias, incidencias o comentarios del turno..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-lilac-500 resize-none text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Botón Principal para Cerrar Turno */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-6 py-3 bg-lilac-600 hover:bg-lilac-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-lilac-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Realizar Corte y Cerrar Turno</span>
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Subtab 2: Historial de Cortes de Caja */
        <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historial de Cortes de Caja</h3>
              <p className="text-xs text-slate-500">
                Registro histórico de turnos anteriores cerrados y auditoría de arqueos.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {pastSessions.length} corte{pastSessions.length !== 1 ? 's' : ''} registrado(s)
            </span>
          </div>

          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-24">Turno #</th>
                  <th className="py-2.5 px-4 w-40">Apertura</th>
                  <th className="py-2.5 px-4 w-40">Cierre</th>
                  <th className="py-2.5 px-4 text-right w-32">Fondo Inicial</th>
                  <th className="py-2.5 px-4 text-right w-36">Efectivo Real</th>
                  <th className="py-2.5 px-4 text-right w-36">Efectivo Esperado</th>
                  <th className="py-2.5 px-4 text-center w-36">Diferencia</th>
                  <th className="py-2.5 px-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pastSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <Clock className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No hay cortes históricos</p>
                        <p className="text-xs text-slate-400">
                          Los cierres de caja quedarán registrados aquí
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pastSessions.map((session) => {
                    const diff = session.difference ?? 0
                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setSelectedPastSession(session)}
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #{session.id}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {formatDateTime(session.opened_at)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {session.closed_at ? formatDateTime(session.closed_at) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatCLP(session.opening_fund)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {session.closing_cash !== null && session.closing_cash !== undefined
                            ? formatCLP(session.closing_cash)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">
                          {session.expected_cash !== null && session.expected_cash !== undefined
                            ? formatCLP(session.expected_cash)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {session.difference === null || session.difference === undefined ? (
                            <span className="text-slate-400">—</span>
                          ) : diff === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Cuadrada ($0)
                            </span>
                          ) : diff > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              +{formatCLP(diff)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              −{formatCLP(Math.abs(diff))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedPastSession(session)}
                            className="px-2.5 py-1 rounded-lg bg-lilac-50 text-lilac-700 hover:bg-lilac-100 border border-lilac-200 font-bold text-[11px]"
                          >
                            Detalle
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cierre */}
      {isConfirmModalOpen && currentSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  ¿Confirmar Corte y Cierre de Turno?
                </h4>
                <p className="text-xs text-slate-500">Sesión #{currentSession.id}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Efectivo Contado:</span>
                <span className="font-black text-slate-900">{formatCLP(countedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Efectivo Esperado:</span>
                <span className="font-bold text-slate-700">{formatCLP(expectedCash)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                <span className="text-slate-700">Diferencia:</span>
                <span
                  className={
                    difference === 0
                      ? 'text-emerald-600'
                      : difference > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }
                >
                  {difference > 0 ? `+${formatCLP(difference)}` : formatCLP(difference)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Al confirmar, la sesión se cerrará definitivamente y se emitirá el comprobante de arqueo.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isClosing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteCloseSession}
                disabled={isClosing}
                className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 disabled:opacity-50"
              >
                {isClosing ? 'Cerrando...' : 'Sí, Cerrar Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Comprobante de Corte Realizado */}
      {isReceiptModalOpen && completedCutData && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="text-center pb-2 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                ¡Corte de Caja Realizado con Éxito!
              </h3>
              <p className="text-xs text-slate-500">
                Sesión #{completedCutData.sessionId} cerrada el {formatDateTime(completedCutData.closedAt)}
              </p>
            </div>

            {/* Recibo Formateado */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs flex flex-col gap-2 text-slate-800">
              <div className="flex justify-between">
                <span>Fondo Inicial:</span>
                <span className="font-bold">{formatCLP(completedCutData.openingFund)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Ventas Efectivo:</span>
                <span className="font-bold">+{formatCLP(completedCutData.salesCash)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Ventas Tarjeta:</span>
                <span className="font-bold">+{formatCLP(completedCutData.salesCard)}</span>
              </div>
              <div className="flex justify-between text-purple-700">
                <span>Ventas Transferencia:</span>
                <span className="font-bold">+{formatCLP(completedCutData.salesTransfer)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                <span>Total Ventas:</span>
                <span>{formatCLP(completedCutData.salesTotal)}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Devoluciones:</span>
                <span>−{formatCLP(completedCutData.returnsTotal)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Salidas de Dinero:</span>
                <span>−{formatCLP(completedCutData.withdrawalsTotal)}</span>
              </div>
              <div className="flex justify-between font-black border-t-2 border-dashed border-slate-300 pt-2 text-sm">
                <span>Efectivo Contado:</span>
                <span>{formatCLP(completedCutData.closingCash)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Efectivo Esperado:</span>
                <span>{formatCLP(completedCutData.expectedCash)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
                <span>Diferencia:</span>
                <span
                  className={
                    completedCutData.difference === 0
                      ? 'text-emerald-700'
                      : completedCutData.difference > 0
                      ? 'text-blue-700'
                      : 'text-rose-700'
                  }
                >
                  {completedCutData.difference > 0
                    ? `+${formatCLP(completedCutData.difference)}`
                    : formatCLP(completedCutData.difference)}
                </span>
              </div>
              {completedCutData.notes && (
                <div className="mt-2 text-[11px] font-sans text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                  <strong>Notas:</strong> {completedCutData.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Comprobante</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsReceiptModalOpen(false)
                  setCompletedCutData(null)
                }}
                className="px-6 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Sesión Histórica Pasada */}
      {selectedPastSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  #{selectedPastSession.id}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Corte de Caja #{selectedPastSession.id}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedPastSession.closed_at
                      ? `Cerrada: ${formatDateTime(selectedPastSession.closed_at)}`
                      : 'Sesión no cerrada'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPastSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex flex-col gap-2.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Apertura:</span>
                <span>{formatDateTime(selectedPastSession.opened_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Fondo Inicial:</span>
                <span className="font-bold">{formatCLP(selectedPastSession.opening_fund)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Efectivo Contado al Cierre:</span>
                <span>
                  {selectedPastSession.closing_cash !== null && selectedPastSession.closing_cash !== undefined
                    ? formatCLP(selectedPastSession.closing_cash)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Efectivo Esperado:</span>
                <span>
                  {selectedPastSession.expected_cash !== null && selectedPastSession.expected_cash !== undefined
                    ? formatCLP(selectedPastSession.expected_cash)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-2">
                <span>Diferencia de Cuadre:</span>
                <span
                  className={
                    (selectedPastSession.difference ?? 0) === 0
                      ? 'text-emerald-600'
                      : (selectedPastSession.difference ?? 0) > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }
                >
                  {(selectedPastSession.difference ?? 0) > 0
                    ? `+${formatCLP(selectedPastSession.difference!)}`
                    : formatCLP(selectedPastSession.difference ?? 0)}
                </span>
              </div>
              {selectedPastSession.notes && (
                <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-bold block mb-0.5">Observaciones:</span>
                  {selectedPastSession.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedPastSession(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
