import React, { useState, useEffect } from 'react'
import {
  X,
  DollarSign,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Send,
  Coins,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react'
import { DailyCashRecord, CashSession } from '@shared/types'
import { CHILEAN_DENOMINATIONS, calculateCountedCash } from '@shared/finance'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { useModalStack } from '../../utils/modalStack'

interface DailyRecordDetailModalProps {
  record: DailyCashRecord | null
  onClose: () => void
}

/**
 * Renderiza el detalle completo e idéntico de un turno individual (arqueo, ventas, billetes y retiro).
 */
const SingleSessionContent: React.FC<{ session: CashSession }> = ({ session }) => {
  const diff = session.difference ?? 0
  const cardDiff = session.card_difference ?? 0
  const transferDiff = session.transfer_difference ?? 0
  const salesCash = session.sales_cash ?? 0
  const salesCard = session.sales_card ?? 0
  const salesTransfer = session.sales_transfer ?? 0
  const totalSales = salesCash + salesCard + salesTransfer

  // Desglose de billetes iniciales (apertura)
  const rawOpening = session.opening_denominations
  const openingCounts: Record<number, number> | null = rawOpening
    ? typeof rawOpening === 'string'
      ? JSON.parse(rawOpening)
      : (rawOpening as Record<number, number>)
    : null

  // Desglose de billetes de cierre
  const rawClosing = session.closing_denominations
  const closingCounts: Record<number, number> | null = rawClosing
    ? typeof rawClosing === 'string'
      ? JSON.parse(rawClosing)
      : (rawClosing as Record<number, number>)
    : null

  const rawNext = session.next_opening_denominations
  const nextOpeningCounts: Record<number, number> | null = rawNext
    ? typeof rawNext === 'string'
      ? JSON.parse(rawNext)
      : (rawNext as Record<number, number>)
    : null

  const nextOpeningTotal = nextOpeningCounts ? calculateCountedCash(nextOpeningCounts) : null

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* 1. Tiempos del Turno */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Apertura de Turno</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
            {formatDateTime(session.opened_at)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Cierre de Turno</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
            {session.closed_at ? formatDateTime(session.closed_at) : '—'}
          </span>
        </div>
      </div>

      {/* 2. Resumen General de Ventas */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
        <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Resumen de Ventas por Medio de Pago
        </h5>
        <div className="grid grid-cols-4 gap-2 pt-1">
          <div className="bg-emerald-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-emerald-100 dark:border-slate-700 flex flex-col">
            <span className="text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
              <Wallet className="w-3.5 h-3.5" /> Efectivo
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(salesCash)}
            </span>
          </div>

          <div className="bg-blue-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-blue-100 dark:border-slate-700 flex flex-col">
            <span className="text-blue-800 dark:text-blue-400 font-medium flex items-center gap-1 text-[11px]">
              <CreditCard className="w-3.5 h-3.5" /> Tarjeta
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(salesCard)}
            </span>
          </div>

          <div className="bg-indigo-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-700 flex flex-col">
            <span className="text-indigo-800 dark:text-indigo-400 font-medium flex items-center gap-1 text-[11px]">
              <Send className="w-3.5 h-3.5" /> Transferencia
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(salesTransfer)}
            </span>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
              Ventas Totales
            </span>
            <span className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(totalSales)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Cuadratura de Caja y Diferencias */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
        <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
          Cuadratura y Arqueo
        </h5>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Efectivo en Caja</span>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
              <span>Fondo Inicial:</span>
              <span className="font-mono font-medium">{formatCLP(session.opening_fund)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
              <span>Efectivo Esperado:</span>
              <span className="font-mono font-medium">
                {session.expected_cash !== null && session.expected_cash !== undefined
                  ? formatCLP(session.expected_cash)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between text-slate-800 dark:text-white font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Efectivo Contado (Final):</span>
              <span className="font-mono text-xs">
                {session.closing_cash !== null && session.closing_cash !== undefined
                  ? formatCLP(session.closing_cash)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Diferencia Efectivo:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  diff === 0
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-emerald-800'
                    : diff > 0
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-blue-800'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-700 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {diff === 0 ? '$0' : diff > 0 ? `+${formatCLP(diff)}` : `−${formatCLP(Math.abs(diff))}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Medios Electrónicos</span>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
              <span>Voucher POS Declarado:</span>
              <span className="font-mono font-medium">
                {session.card_machine_amount !== null && session.card_machine_amount !== undefined
                  ? formatCLP(session.card_machine_amount)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Diferencia Tarjeta:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  cardDiff === 0
                    ? 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700'
                    : cardDiff > 0
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-slate-700 border border-blue-200'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-700 border border-rose-200'
                }`}
              >
                {cardDiff === 0 ? '$0' : cardDiff > 0 ? `+${formatCLP(cardDiff)}` : `−${formatCLP(Math.abs(cardDiff))}`}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Transferencias Verificadas:</span>
              <span className="font-mono font-medium">
                {session.transfer_verified_amount !== null && session.transfer_verified_amount !== undefined
                  ? formatCLP(session.transfer_verified_amount)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">Diferencia Transferencia:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  transferDiff === 0
                    ? 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-700 border border-rose-200'
                }`}
              >
                {transferDiff === 0 ? '$0' : `−${formatCLP(Math.abs(transferDiff))}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Arqueo Físico de Billetes y Monedas */}
      {(openingCounts || closingCounts) && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
          <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            Desglose de Billetes y Monedas (Arqueo Físico)
          </h5>

          <div className="grid grid-cols-2 gap-3">
            {/* Cuadro Apertura */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                  Inicio de Turno (Apertura)
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {formatCLP(session.opening_fund)}
                </span>
              </div>
              {openingCounts ? (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                  {CHILEAN_DENOMINATIONS.map((d) => {
                    const count = openingCounts[d.value] || 0
                    if (count === 0) return null
                    return (
                      <div key={d.value} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-750 font-mono">
                        <span className="text-slate-500">{d.label}:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {count} ({formatCLP(count * d.value)})
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="text-slate-400 italic text-[11px] py-2">
                  Apertura registrada con monto plano (sin desglose)
                </span>
              )}
            </div>

            {/* Cuadro Cierre */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                  Cierre de Turno (Arqueo)
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {session.closing_cash !== null && session.closing_cash !== undefined
                    ? formatCLP(session.closing_cash)
                    : '—'}
                </span>
              </div>
              {closingCounts ? (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                  {CHILEAN_DENOMINATIONS.map((d) => {
                    const count = closingCounts[d.value] || 0
                    if (count === 0) return null
                    return (
                      <div key={d.value} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-750 font-mono">
                        <span className="text-slate-500">{d.label}:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {count} ({formatCLP(count * d.value)})
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="text-slate-400 italic text-[11px] py-2">
                  Cierre sin desglose de denominaciones
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Retiro y Fondo Siguiente Turno */}
      <div className="grid grid-cols-2 gap-3 bg-amber-50/70 dark:bg-slate-800 border border-amber-200/80 dark:border-amber-900/60 p-3.5 rounded-2xl">
        <div className="flex flex-col">
          <span className="text-amber-800 dark:text-amber-400 font-medium flex items-center gap-1 text-[11px]">
            <ArrowDownRight className="w-3.5 h-3.5" /> Retiro de Cierre
          </span>
          <span className="font-black text-amber-950 dark:text-amber-200 text-base mt-0.5">
            {session.withdrawal_amount !== null && session.withdrawal_amount !== undefined
              ? formatCLP(session.withdrawal_amount)
              : '—'}
          </span>
          <span className="text-amber-700/80 dark:text-amber-400/80 text-[10px] mt-0.5">
            Dinero retirado de la gaveta al finalizar este turno
          </span>
        </div>

        <div className="flex flex-col border-l border-amber-200 dark:border-slate-700 pl-3">
          <span className="text-slate-600 dark:text-slate-400 font-medium text-[11px]">
            Fondo para Siguiente Turno
          </span>
          <span className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
            {nextOpeningTotal !== null ? formatCLP(nextOpeningTotal) : '—'}
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
            Efectivo base que permaneció en la gaveta
          </span>
        </div>
      </div>

      {/* 6. Observaciones */}
      {session.notes && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col gap-1">
          <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">
            Observaciones del Turno:
          </span>
          <p className="text-slate-800 dark:text-slate-200 italic">{session.notes}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Renderiza el resumen consolidado de una jornada con múltiples turnos.
 */
const ConsolidatedContent: React.FC<{
  record: DailyCashRecord
  onSelectTurn: (index: number) => void
}> = ({ record, onSelectTurn }) => {
  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* 1. Tiempos Globales del Día */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Primer Inicio (Turno #1)</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
            {formatDateTime(record.firstOpenedAt)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Último Cierre</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
            {record.lastClosedAt ? formatDateTime(record.lastClosedAt) : '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Total Turnos Operados</span>
          <span className="font-bold text-lilac-700 dark:text-lilac-300 text-xs">
            {record.turnCount} turnos registrados
          </span>
        </div>
      </div>

      {/* 2. Resumen Consolidado de Ventas */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
        <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Ventas Consolidadas de la Jornada
        </h5>
        <div className="grid grid-cols-4 gap-2 pt-1">
          <div className="bg-emerald-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-emerald-100 dark:border-slate-700 flex flex-col">
            <span className="text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
              <Wallet className="w-3.5 h-3.5" /> Efectivo
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(record.totalSalesCash)}
            </span>
          </div>

          <div className="bg-blue-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-blue-100 dark:border-slate-700 flex flex-col">
            <span className="text-blue-800 dark:text-blue-400 font-medium flex items-center gap-1 text-[11px]">
              <CreditCard className="w-3.5 h-3.5" /> Tarjeta
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(record.totalSalesCard)}
            </span>
          </div>

          <div className="bg-indigo-50/60 dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-700 flex flex-col">
            <span className="text-indigo-800 dark:text-indigo-400 font-medium flex items-center gap-1 text-[11px]">
              <Send className="w-3.5 h-3.5" /> Transferencia
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(record.totalSalesTransfer)}
            </span>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
              Ventas Totales
            </span>
            <span className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
              {formatCLP(record.totalSales)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Métricas de Caja Consolidada */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Caja Inicial (1° Turno)</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
            {formatCLP(record.initialOpeningFund)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-medium block text-[11px]">Caja Final (Último Turno)</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
            {record.finalClosingCash !== null ? formatCLP(record.finalClosingCash) : '—'}
          </span>
        </div>
        <div>
          <span className="text-amber-800 dark:text-amber-400 font-medium block text-[11px]">
            Retiros Totales del Día
          </span>
          <span className="font-mono font-black text-amber-900 dark:text-amber-300 text-sm">
            {formatCLP(record.totalWithdrawal)}
          </span>
        </div>
      </div>

      {/* 4. Tabla Desglose Comparativo de Turnos del Día */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2.5">
        <h5 className="font-bold text-slate-800 dark:text-white flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            Turnos que conformaron esta jornada
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Haz clic en un turno para ver su desglose individual
          </span>
        </h5>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-3 text-center">Turno</th>
                <th className="py-2 px-3">Horario</th>
                <th className="py-2 px-3 text-right">Caja Inicial</th>
                <th className="py-2 px-3 text-right">Caja Final</th>
                <th className="py-2 px-3 text-right text-emerald-800 dark:text-emerald-400">Ventas Efec.</th>
                <th className="py-2 px-3 text-right font-bold">Ventas Totales</th>
                <th className="py-2 px-3 text-center">Dif. Efectivo</th>
                <th className="py-2 px-3 text-right text-amber-800 dark:text-amber-400">Retiro</th>
                <th className="py-2 px-2 text-center w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {record.sessions.map((session, index) => {
                const sTotal =
                  (session.sales_cash ?? 0) + (session.sales_card ?? 0) + (session.sales_transfer ?? 0)
                const sDiff = session.difference ?? 0

                return (
                  <tr
                    key={session.id}
                    onClick={() => onSelectTurn(index)}
                    className="hover:bg-lilac-50/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      #{session.id}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 text-[11px]">
                      {session.opened_at ? session.opened_at.slice(11, 16) : '—'} -{' '}
                      {session.closed_at ? session.closed_at.slice(11, 16) : 'Activo'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCLP(session.opening_fund)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {session.closing_cash !== null && session.closing_cash !== undefined
                        ? formatCLP(session.closing_cash)
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCLP(session.sales_cash ?? 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCLP(sTotal)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          sDiff === 0
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-700'
                            : sDiff > 0
                            ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-slate-700'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-700'
                        }`}
                      >
                        {sDiff === 0 ? '$0' : sDiff > 0 ? `+${formatCLP(sDiff)}` : `−${formatCLP(Math.abs(sDiff))}`}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                      {session.withdrawal_amount !== null && session.withdrawal_amount !== undefined
                        ? formatCLP(session.withdrawal_amount)
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-center text-lilac-600 dark:text-lilac-400">
                      <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const DailyRecordDetailModal: React.FC<DailyRecordDetailModalProps> = ({
  record,
  onClose
}) => {
  const { handleBackdropClick } = useModalStack({
    id: 'daily-record-detail-modal',
    isOpen: !!record,
    onClose,
    closeOnBackdrop: true
  })

  // 'consolidated' o el índice numérico del turno (0, 1, 2...)
  const [activeTab, setActiveTab] = useState<string>('consolidated')

  // Al abrir el modal o cambiar de registro, reiniciar pestaña
  useEffect(() => {
    if (record) {
      if (record.turnCount === 1) {
        setActiveTab('0')
      } else {
        setActiveTab('consolidated')
      }
    }
  }, [record])

  if (!record) return null

  const isMultiTurn = record.turnCount > 1
  const selectedSessionIndex = activeTab !== 'consolidated' ? parseInt(activeTab, 10) : null
  const selectedSession =
    selectedSessionIndex !== null && !isNaN(selectedSessionIndex)
      ? record.sessions[selectedSessionIndex]
      : null

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Principal */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-slate-800 text-lilac-700 dark:text-lilac-300 flex items-center justify-center font-bold text-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Registro Diario: {record.displayDate}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-lilac-100 dark:bg-slate-800 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-slate-700">
                    {record.turnCount === 1 ? '1 turno' : `${record.turnCount} turnos`}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isMultiTurn
                    ? `Jornada con ${record.turnCount} aperturas de caja cerradas`
                    : `Turno único #${record.sessions[0].id} cerrado`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-Pestañas de Navegación (solo si hay más de 1 turno) */}
          {isMultiTurn && (
            <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 -mb-5 pt-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('consolidated')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'consolidated'
                    ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/60 dark:bg-lilac-950/40'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Consolidado del Día</span>
              </button>

              {record.sessions.map((session, index) => {
                const isSelected = activeTab === String(index)
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setActiveTab(String(index))}
                    className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/60 dark:bg-lilac-950/40'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>Turno #{session.id}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({session.opened_at ? session.opened_at.slice(11, 16) : ''})
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Contenido Dinámico */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'consolidated' ? (
            <ConsolidatedContent
              record={record}
              onSelectTurn={(idx) => setActiveTab(String(idx))}
            />
          ) : selectedSession ? (
            <SingleSessionContent session={selectedSession} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
