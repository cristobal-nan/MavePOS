import React, { useState, useEffect, useMemo } from 'react'
import {
  Banknote,
  CreditCard,
  Send,
  CornerDownLeft,
  ArrowUpRight,
  DollarSign,
  Clock,
  Lock,
  Coins,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileText
} from 'lucide-react'
import { useCashStore } from '../../store/cashStore'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import {
  calculateCountedCash,
  calculateCashDifference,
  calculateNextOpeningFundAndWithdrawal,
  DEFAULT_WITHDRAWAL_RULES,
  WithdrawalRules
} from '@shared/finance'
import { DenominationsCalculator } from './DenominationsCalculator'
import { ConfirmCashCutModal } from './ConfirmCashCutModal'

interface ActiveCashCutTabProps {
  onSwitchToHistory: () => void
}

export const ActiveCashCutTab: React.FC<ActiveCashCutTabProps> = ({ onSwitchToHistory }) => {
  const { currentSession, currentSummary, closeSession, setCompletedCutReceipt } = useCashStore()

  // Estado del arqueo físico de cierre (calculadora de denominaciones de la derecha)
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
  const [withdrawalRules, setWithdrawalRules] = useState<WithdrawalRules>(DEFAULT_WITHDRAWAL_RULES)

  // Estado del cuadre de tarjetas y transferencias
  const [cardMachineInput, setCardMachineInput] = useState<string>('')
  const [transferVerifiedInput, setTransferVerifiedInput] = useState<string>('')

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Cargar reglas de retiro configuradas en settings
  useEffect(() => {
    window.api
      ?.getAllSettings?.()
      .then((settings) => {
        if (settings?.cash_cut_withdrawal_rules) {
          try {
            const parsed = JSON.parse(settings.cash_cut_withdrawal_rules)
            setWithdrawalRules(parsed)
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  // Desglose de inicio de turno (cuadro de la izquierda, solo lectura)
  const openingCounts: Record<number, number> = useMemo(() => {
    if (currentSession?.opening_denominations) {
      const raw = currentSession.opening_denominations
      try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        return {}
      }
    }
    return {}
  }, [currentSession?.opening_denominations])

  // Calcular efectivo contado y diferencia
  const countedCash = calculateCountedCash(denominationCounts)
  const expectedCash = currentSummary ? currentSummary.expectedCash : 0
  const { difference } = calculateCashDifference(countedCash, expectedCash)

  // Cálculos de cuadre de tarjeta
  const cardSales = currentSummary?.salesCard ?? 0
  const cardMachineAmount = cardMachineInput !== '' ? (parseInt(cardMachineInput, 10) || 0) : cardSales
  const cardDifference = cardMachineAmount - cardSales

  // Cálculos de cuadre de transferencias
  const transferSales = currentSummary?.salesTransfer ?? 0
  const hasTransferSales = transferSales > 0
  const transferVerifiedAmount = transferVerifiedInput !== '' ? (parseInt(transferVerifiedInput, 10) || 0) : transferSales
  const transferDifference = hasTransferSales ? transferVerifiedAmount - transferSales : 0

  // Calcular monto de retiro y fondo para mañana
  const { nextOpeningFund, withdrawalAmount, nextOpeningCounts } = useMemo(() => {
    return calculateNextOpeningFundAndWithdrawal(denominationCounts, withdrawalRules)
  }, [denominationCounts, withdrawalRules])

  const handleDenominationChange = (value: number, count: number): void => {
    setDenominationCounts((prev) => ({
      ...prev,
      [value]: Math.max(0, isNaN(count) ? 0 : count)
    }))
  }

  const handleExecuteCloseSession = async (): Promise<void> => {
    if (!currentSession) return
    setIsClosing(true)

    const closingData = {
      closingCash: countedCash,
      expectedCash,
      difference,
      notes: notes.trim() || undefined,
      openingDenominations: openingCounts,
      closingDenominations: denominationCounts,
      nextOpeningDenominations: nextOpeningCounts,
      withdrawalAmount,
      salesCash: currentSummary?.salesCash,
      salesCard: cardSales,
      salesTransfer: transferSales,
      cardMachineAmount: cardMachineInput !== '' ? cardMachineAmount : undefined,
      cardDifference,
      transferVerifiedAmount: (hasTransferSales && transferVerifiedInput !== '') ? transferVerifiedAmount : undefined,
      transferDifference
    }

    const receiptData = {
      ...currentSummary,
      closingCash: countedCash,
      difference,
      cardMachineAmount: cardMachineInput !== '' ? cardMachineAmount : undefined,
      cardDifference,
      transferVerifiedAmount: (hasTransferSales && transferVerifiedInput !== '') ? transferVerifiedAmount : undefined,
      transferDifference,
      withdrawalAmount,
      nextOpeningFund,
      notes: notes.trim(),
      closedAt: new Date().toISOString()
    }

    const success = await closeSession(currentSession.id, closingData)
    setIsClosing(false)

    if (success) {
      setIsConfirmModalOpen(false)
      setCompletedCutReceipt(receiptData)
    }
  }

  if (!currentSession) {
    return (
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
          onClick={onSwitchToHistory}
          className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md transition-colors"
        >
          Ver Historial de Cortes Anteriores
        </button>
      </div>
    )
  }

  return (
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
          <span className="text-xl font-black text-slate-900 block">
            {formatCLP(currentSummary?.salesCash ?? 0)}
          </span>
          <span className="text-[11px] text-slate-400">Ingreso a gaveta</span>
        </div>

        {/* Ventas Tarjeta */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Ventas con Tarjeta</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl font-black text-slate-900 block">
            {formatCLP(currentSummary?.salesCard ?? 0)}
          </span>
          <span className="text-[11px] text-slate-400">POS Transbank / Redelcom</span>
        </div>

        {/* Ventas Transferencia */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Transferencias</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl font-black text-slate-900 block">
            {formatCLP(currentSummary?.salesTransfer ?? 0)}
          </span>
          <span className="text-[11px] text-slate-400">Banco / Comprobante</span>
        </div>

        {/* Total General */}
        <div className="bg-white border border-lilac-200 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-white to-lilac-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-lilac-900">Total Ventas Turno</span>
            <div className="w-7 h-7 rounded-lg bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold text-xs">
              CLP
            </div>
          </div>
          <span className="text-xl font-black text-lilac-800 block">
            {formatCLP(currentSummary?.salesTotal ?? 0)}
          </span>
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

      {/* Sección Principal: Cuadre de Cajas */}
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-lilac-600" />
            <span>Cuadre de Cajas</span>
          </h4>
          <p className="text-xs text-slate-500">
            Conciliación integral del turno: arqueo físico de efectivo en gaveta, cuadre con máquina de tarjetas y verificación de transferencias.
          </p>
        </div>

        {/* Título: Cuadre Efectivo */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Banknote className="w-4 h-4 text-lilac-600" />
            <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Cuadre Efectivo
            </h5>
          </div>

          {/* Dos Calculadoras Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* Izquierda: Fondo Inicial de Turno (Solo Lectura) */}
            <DenominationsCalculator
              title="Apertura de turno"
              subtitle="Billetes y monedas registrados al abrir este turno"
              badgeLabel="Inicio de Turno"
              badgeVariant="slate"
              denominationCounts={openingCounts}
              countedCash={currentSession.opening_fund}
              readOnly={true}
              footerLabel="Total Fondo Inicial"
              emptyMessage="Turno iniciado con monto plano sin desglose de billetes"
            />

            {/* Derecha: Conteo Físico de Cierre (Editable para cuadrar) */}
            <DenominationsCalculator
              title="Cierre de turno"
              subtitle="Ingresa la cantidad física en gaveta para cuadrar"
              badgeLabel="Cierre / Cuadre"
              badgeVariant="lilac"
              denominationCounts={denominationCounts}
              onDenominationChange={handleDenominationChange}
              countedCash={countedCash}
              readOnly={false}
              footerLabel="Total Físico Contado"
            />
          </div>
        </div>
      </div>

      {/* Comparador de Cuadre Efectivo: Esperado vs Real */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              Efectivo Esperado (Sistema)
            </span>
            <span className="text-lg font-bold text-slate-800">
              {formatCLP(expectedCash)}
            </span>
          </div>

          <div className="text-slate-300 text-xl font-light">vs</div>

          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              Efectivo Físico Contado (Cierre)
            </span>
            <span className="text-lg font-black text-slate-900">
              {formatCLP(countedCash)}
            </span>
          </div>
        </div>

        {/* Badge de Diferencia Efectivo */}
        <div>
          {difference === 0 ? (
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Efectivo Cuadrado Exacto ($ 0)</span>
            </div>
          ) : difference > 0 ? (
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Sobrante en Efectivo: +{formatCLP(difference)}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Faltante en Efectivo: −{formatCLP(Math.abs(difference))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas de Retiro y Fondo de Siguiente Turno */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-lilac-500/10 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Planificación de Retiro y Fondo para Mañana
              </h4>
              <p className="text-[11px] text-slate-600">
                Calculado automáticamente según las reglas configuradas (se retiran todos los de $20.000 y se dejan máx 2 de $10.000).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Total Contado */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <span className="text-slate-500 font-medium">Total Efectivo en Gaveta</span>
            <span className="text-xl font-black text-slate-900 mt-1">
              {formatCLP(countedCash)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Antes del retiro</span>
          </div>

          {/* Monto de Retiro */}
          <div className="bg-white border border-amber-300 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-amber-900 font-bold">Monto a RETIRAR</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                Retiro
              </span>
            </div>
            <span className="text-2xl font-black text-amber-700 mt-1">
              {formatCLP(withdrawalAmount)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Retiro de ganancias del turno
            </span>
          </div>

          {/* Fondo Siguiente Turno */}
          <div className="bg-white border border-lilac-300 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-lilac-900 font-bold">Fondo para Mañana</span>
              <span className="px-1.5 py-0.2 rounded bg-lilac-100 text-lilac-800 font-bold text-[10px]">
                Siguiente Turno
              </span>
            </div>
            <span className="text-2xl font-black text-lilac-800 mt-1">
              {formatCLP(nextOpeningFund)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Queda en gaveta para abrir caja
            </span>
          </div>
        </div>
      </div>

      {/* Título: Cuadre Tarjeta y Transferencia */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <CreditCard className="w-4 h-4 text-lilac-600" />
          <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Cuadre Tarjeta y Transferencia
          </h5>
        </div>

        {/* 2. Cuadre de Tarjetas (2/3) y Cuadre de Transferencias (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Izquierda: Cuadre de Pago con Tarjetas (2/3) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Cuadre de Pago con Tarjetas
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Compara las ventas registradas con el total del voucher de cierre de lote de la máquina POS
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Máquina POS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Ventas Tarjeta POS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Ventas Tarjeta (Sistema)</span>
                <span className="text-xl font-black text-blue-700 mt-1">
                  {formatCLP(cardSales)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">Total registrado en POS</span>
              </div>

              {/* Total Máquina POS Input */}
              <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <label htmlFor="card-machine-input" className="text-[11px] font-bold text-blue-900">
                    Total Máquina POS ($)
                  </label>
                  {cardSales > 0 && cardMachineInput === '' && (
                    <button
                      type="button"
                      onClick={() => setCardMachineInput(cardSales.toString())}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      Copiar POS
                    </button>
                  )}
                </div>
                <input
                  id="card-machine-input"
                  type="number"
                  min={0}
                  placeholder={cardSales > 0 ? cardSales.toString() : '0'}
                  value={cardMachineInput}
                  onChange={(e) => setCardMachineInput(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-black text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 text-center">
                  Monto del voucher de cierre
                </span>
              </div>

              {/* Diferencia Tarjeta */}
              <div className="flex flex-col items-center justify-center p-3 text-center">
                <span className="text-[11px] font-semibold text-slate-500 mb-1">
                  Diferencia Tarjeta
                </span>
                {cardDifference === 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cuadrada ($0)</span>
                  </div>
                ) : cardDifference > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>+{formatCLP(cardDifference)} (Sobrante)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>−{formatCLP(Math.abs(cardDifference))} (Faltante)</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-1">
                  Se refleja en el historial
                </span>
              </div>
            </div>
          </div>

          {/* Derecha: Cuadre de Transferencias (1/3) */}
          <div
            className={`lg:col-span-1 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 transition-all ${
              hasTransferSales
                ? 'bg-white border border-slate-200'
                : 'bg-slate-50/70 border border-slate-200/80 border-dashed opacity-60'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    hasTransferSales
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Cuadre de Transferencias
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {hasTransferSales
                      ? 'Verificación en cuenta bancaria'
                      : 'Sin transferencias este turno'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  hasTransferSales
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
              >
                {hasTransferSales ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {!hasTransferSales ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-slate-400">
                <Send className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  No hubo ventas con transferencia
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 max-w-[200px]">
                  Este módulo solo se activa al registrar cobros con transferencia
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500">Ventas Sistema:</span>
                  <span className="text-xs font-bold text-indigo-800">{formatCLP(transferSales)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="transfer-verified-input" className="text-[11px] font-bold text-slate-700">
                      Monto en Banco ($):
                    </label>
                    {transferVerifiedInput === '' && (
                      <button
                        type="button"
                        onClick={() => setTransferVerifiedInput(transferSales.toString())}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        Copiar POS
                      </button>
                    )}
                  </div>
                  <input
                    id="transfer-verified-input"
                    type="number"
                    min={0}
                    placeholder={transferSales.toString()}
                    value={transferVerifiedInput}
                    onChange={(e) => setTransferVerifiedInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Diferencia:</span>
                  {transferDifference === 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cuadrada ($0)
                    </span>
                  ) : transferDifference > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      +{formatCLP(transferDifference)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      −{formatCLP(Math.abs(transferDifference))}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Título: Observaciones */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <FileText className="w-4 h-4 text-lilac-600" />
          <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Observaciones
          </h5>
        </div>
        <textarea
          rows={2}
          placeholder="Detalles sobre diferencias, incidencias o comentarios del turno (opcional)..."
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

      {/* Modales */}
      <ConfirmCashCutModal
        isOpen={isConfirmModalOpen}
        sessionId={currentSession.id}
        countedCash={countedCash}
        expectedCash={expectedCash}
        difference={difference}
        cardDifference={cardDifference}
        transferDifference={transferDifference}
        withdrawalAmount={withdrawalAmount}
        nextOpeningFund={nextOpeningFund}
        isClosing={isClosing}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecuteCloseSession}
      />
    </div>
  )
}
