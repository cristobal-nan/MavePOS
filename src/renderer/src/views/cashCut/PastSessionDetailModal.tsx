import React from 'react'
import { X, DollarSign, ArrowDownRight, Wallet, CreditCard, Send, Coins } from 'lucide-react'
import { CashSession } from '@shared/types'
import { CHILEAN_DENOMINATIONS, calculateCountedCash } from '@shared/finance'
import { formatCLP, formatDateTime } from '../../utils/formatters'

interface PastSessionDetailModalProps {
  session: CashSession | null
  onClose: () => void
}

export const PastSessionDetailModal: React.FC<PastSessionDetailModalProps> = ({
  session,
  onClose
}) => {
  if (!session) return null

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-slate-800 text-lilac-700 dark:text-lilac-300 flex items-center justify-center font-bold text-sm">
              #{session.id}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Detalle del Turno #{session.id}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {session.closed_at
                  ? `Cerrado el ${formatDateTime(session.closed_at)}`
                  : 'Sesión activa'}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs">
          {/* 1. Tiempos del Turno */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Apertura de Turno</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{formatDateTime(session.opened_at)}</span>
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
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-emerald-50/70 dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/60 rounded-xl p-2.5">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold block text-[11px]">Ventas Efectivo</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">{formatCLP(salesCash)}</span>
              </div>
              <div className="bg-blue-50/70 dark:bg-slate-800 border border-blue-100 dark:border-blue-900/60 rounded-xl p-2.5">
                <span className="text-blue-700 dark:text-blue-400 font-semibold block text-[11px]">Ventas Tarjeta</span>
                <span className="font-bold text-blue-900 dark:text-blue-200 text-xs">{formatCLP(salesCard)}</span>
              </div>
              <div className="bg-indigo-50/70 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-2.5">
                <span className="text-indigo-700 dark:text-indigo-400 font-semibold block text-[11px]">Ventas Transferencia</span>
                <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">{formatCLP(salesTransfer)}</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                <span className="text-slate-600 dark:text-slate-400 font-semibold block text-[11px]">Ventas Totales</span>
                <span className="font-black text-slate-900 dark:text-white text-xs">{formatCLP(totalSales)}</span>
              </div>
            </div>
          </div>

          {/* 3. Desglose de Caja en Efectivo: Inicial (Apertura) vs Final (Cierre) */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
                <Coins className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                Desglose de Efectivo: Caja Inicial vs Caja Final
              </h5>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">
                  Esperado: <strong className="text-slate-800 dark:text-slate-200">{formatCLP(session.expected_cash ?? 0)}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Diferencia:{' '}
                  <strong
                    className={
                      diff === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : diff > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {diff === 0 ? 'Cuadrada ($0)' : diff > 0 ? `+${formatCLP(diff)}` : `−${formatCLP(Math.abs(diff))}`}
                  </strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Desglose Inicial */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                    <span className="font-bold text-slate-800 dark:text-white text-[11px]">1. Caja Inicial (Apertura)</span>
                    <span className="font-black text-slate-900 dark:text-white text-xs">{formatCLP(session.opening_fund)}</span>
                  </div>

                  {openingCounts ? (
                    <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto pr-1">
                      {CHILEAN_DENOMINATIONS.map((d) => {
                        const count = Number(openingCounts[d.value] || 0)
                        if (count === 0) return null
                        return (
                          <div key={d.value} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span>{d.label}:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {count} un. ({formatCLP(count * d.value)})
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic text-[11px] py-4 text-center">
                      Monto plano inicial sin desglose detallado de billetes
                    </p>
                  )}
                </div>
              </div>

              {/* Desglose Final */}
              <div className="bg-lilac-50/40 dark:bg-slate-800 border border-lilac-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center pb-2 border-b border-lilac-200 dark:border-slate-700 mb-2">
                    <span className="font-bold text-lilac-900 dark:text-lilac-300 text-[11px]">2. Caja Final (Arqueo de Cierre)</span>
                    <span className="font-black text-slate-900 dark:text-white text-xs">
                      {session.closing_cash !== null && session.closing_cash !== undefined
                        ? formatCLP(session.closing_cash)
                        : '—'}
                    </span>
                  </div>

                  {closingCounts ? (
                    <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto pr-1">
                      {CHILEAN_DENOMINATIONS.map((d) => {
                        const count = Number(closingCounts[d.value] || 0)
                        if (count === 0) return null
                        return (
                          <div key={d.value} className="flex justify-between py-0.5 border-b border-lilac-100 dark:border-slate-700/60">
                            <span>{d.label}:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {count} un. ({formatCLP(count * d.value)})
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic text-[11px] py-4 text-center">
                      Sin desglose registrado al cierre
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Cuadre de Tarjetas y Transferencias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tarjetas */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-white text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Cuadre de Tarjetas
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                  POS
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Ventas Tarjeta (POS):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCLP(salesCard)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Total Voucher Máquina:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {session.card_machine_amount !== null && session.card_machine_amount !== undefined
                    ? formatCLP(session.card_machine_amount)
                    : formatCLP(salesCard)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700 font-bold text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Diferencia Tarjeta:</span>
                <span
                  className={
                    cardDiff === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : cardDiff > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {cardDiff === 0 ? 'Cuadrada ($0)' : cardDiff > 0 ? `+${formatCLP(cardDiff)}` : `−${formatCLP(Math.abs(cardDiff))}`}
                </span>
              </div>
            </div>

            {/* Transferencias */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-white text-[11px] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Cuadre de Transferencias
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  Banco
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Ventas Transferencia (POS):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCLP(salesTransfer)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Monto Verificado en Banco:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {session.transfer_verified_amount !== null && session.transfer_verified_amount !== undefined
                    ? formatCLP(session.transfer_verified_amount)
                    : formatCLP(salesTransfer)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700 font-bold text-[11px]">
                <span className="text-slate-700 dark:text-slate-300">Diferencia Transferencia:</span>
                <span
                  className={
                    transferDiff === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : transferDiff > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {transferDiff === 0 ? 'Cuadrada ($0)' : transferDiff > 0 ? `+${formatCLP(transferDiff)}` : `−${formatCLP(Math.abs(transferDiff))}`}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Retiro y Fondo Próximo Turno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex flex-col gap-1">
              <span className="text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Monto Retirado de Caja
              </span>
              <span className="text-base font-black text-amber-950 dark:text-amber-200">
                {session.withdrawal_amount !== null && session.withdrawal_amount !== undefined
                  ? formatCLP(session.withdrawal_amount)
                  : '—'}
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">Retirado físicamente de gaveta</span>
            </div>

            <div className="bg-lilac-50 dark:bg-slate-800 border border-lilac-200 dark:border-slate-700 rounded-2xl p-3.5 flex flex-col gap-1">
              <span className="text-lilac-800 dark:text-lilac-300 font-bold text-[11px] flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                Fondo Siguiente Turno
              </span>
              <span className="text-base font-black text-lilac-950 dark:text-lilac-200">
                {nextOpeningTotal !== null ? formatCLP(nextOpeningTotal) : '—'}
              </span>
              <span className="text-[10px] text-lilac-700 dark:text-lilac-400">Efectivo dejado como fondo</span>
            </div>
          </div>

          {/* 6. Observaciones */}
          {session.notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
              <span className="font-bold block mb-0.5 text-slate-800 dark:text-slate-200">Observaciones del cajero:</span>
              <p className="whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-white dark:bg-slate-850">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
