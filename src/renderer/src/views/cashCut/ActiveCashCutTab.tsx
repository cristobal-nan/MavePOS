import React, { useState } from 'react'
import {
  Banknote,
  CreditCard,
  Send,
  CornerDownLeft,
  ArrowUpRight,
  DollarSign,
  Clock,
  Lock
} from 'lucide-react'
import { useCashStore } from '../../store/cashStore'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { calculateCountedCash, calculateCashDifference } from '@shared/finance'
import { DenominationsCalculator } from './DenominationsCalculator'
import { ConfirmCashCutModal } from './ConfirmCashCutModal'
import { ReceiptCashCutModal } from './ReceiptCashCutModal'

interface ActiveCashCutTabProps {
  onSwitchToHistory: () => void
}

export const ActiveCashCutTab: React.FC<ActiveCashCutTabProps> = ({ onSwitchToHistory }) => {
  const { currentSession, currentSummary, closeSession } = useCashStore()

  // Estado del arqueo físico (calculadora de denominaciones)
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

  // Calcular efectivo contado y diferencia usando la lógica de dominio financiero puro
  const countedCash = calculateCountedCash(denominationCounts)
  const expectedCash = currentSummary ? currentSummary.expectedCash : 0
  const { difference } = calculateCashDifference(countedCash, expectedCash)

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
      notes: notes.trim() || undefined
    }

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

      {/* Sección de Arqueo Físico de Efectivo */}
      <DenominationsCalculator
        denominationCounts={denominationCounts}
        onDenominationChange={handleDenominationChange}
        countedCash={countedCash}
        expectedCash={expectedCash}
        difference={difference}
      />

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

      {/* Modales */}
      <ConfirmCashCutModal
        isOpen={isConfirmModalOpen}
        sessionId={currentSession.id}
        countedCash={countedCash}
        expectedCash={expectedCash}
        difference={difference}
        isClosing={isClosing}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecuteCloseSession}
      />

      <ReceiptCashCutModal
        isOpen={isReceiptModalOpen}
        data={completedCutData}
        onClose={() => {
          setIsReceiptModalOpen(false)
          setCompletedCutData(null)
        }}
      />
    </div>
  )
}
