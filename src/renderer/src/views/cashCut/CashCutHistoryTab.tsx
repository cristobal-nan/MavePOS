import React, { useState } from 'react'
import { Clock } from 'lucide-react'
import { CashSession } from '@shared/types'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { useCashStore } from '../../store/cashStore'
import { PastSessionDetailModal } from './PastSessionDetailModal'

export const CashCutHistoryTab: React.FC = () => {
  const { pastSessions } = useCashStore()
  const [selectedPastSession, setSelectedPastSession] = useState<CashSession | null>(null)

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full flex flex-col gap-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Historial de Cortes de Caja</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro histórico de turnos anteriores cerrados, ventas por medio de pago, arqueos y retiros.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {pastSessions.length} corte{pastSessions.length !== 1 ? 's' : ''} registrado(s)
        </span>
      </div>

      <div className="bg-white dark:bg-slate-850 border border-black/60 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border-b border-black/60 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 w-16 text-center">Turno</th>
                <th className="py-2.5 px-3 w-32">Apertura</th>
                <th className="py-2.5 px-3 w-32">Cierre</th>
                <th className="py-2.5 px-3 text-right w-24">Caja Inicial</th>
                <th className="py-2.5 px-3 text-right w-24">Caja Final</th>
                <th className="py-2.5 px-3 text-right w-28 text-emerald-800 dark:text-emerald-400">Ventas Efectivo</th>
                <th className="py-2.5 px-3 text-right w-28 text-blue-800 dark:text-blue-400">Ventas Tarjeta</th>
                <th className="py-2.5 px-3 text-right w-32 text-indigo-800 dark:text-indigo-400">Ventas Transferencia</th>
                <th className="py-2.5 px-3 text-right w-32 text-slate-900 dark:text-white font-bold">Ventas Totales</th>
                <th className="py-2.5 px-3 text-center w-28">Diferencia Efectivo</th>
                <th className="py-2.5 px-3 text-center w-28">Diferencia Tarjeta</th>
                <th className="py-2.5 px-3 text-right w-28 text-amber-900 dark:text-amber-400">Retiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/60 dark:divide-slate-700 text-xs">
              {pastSessions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No hay cortes históricos</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Los cierres de caja quedarán registrados aquí
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pastSessions.map((session) => {
                  const diff = session.difference ?? 0
                  const cardDiff = session.card_difference ?? 0
                  const salesCash = session.sales_cash ?? 0
                  const salesCard = session.sales_card ?? 0
                  const salesTransfer = session.sales_transfer ?? 0
                  const salesTotal = salesCash + salesCard + salesTransfer

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-lilac-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border-b border-black/60 dark:border-slate-700"
                      onClick={() => setSelectedPastSession(session)}
                      title="Haz clic para ver el detalle completo del turno"
                    >
                      {/* 1. Turno */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                          #{session.id}
                        </span>
                      </td>

                      {/* 2. Apertura */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateTime(session.opened_at)}
                      </td>

                      {/* 3. Cierre */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {session.closed_at ? formatDateTime(session.closed_at) : '—'}
                      </td>

                      {/* 4. Caja Inicial */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatCLP(session.opening_fund)}
                      </td>

                      {/* 5. Caja Final */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {session.closing_cash !== null && session.closing_cash !== undefined
                          ? formatCLP(session.closing_cash)
                          : '—'}
                      </td>

                      {/* 6. Ventas Efectivo */}
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {formatCLP(salesCash)}
                      </td>

                      {/* 7. Ventas Tarjeta */}
                      <td className="py-3 px-3 text-right font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {formatCLP(salesCard)}
                      </td>

                      {/* 8. Ventas Transferencia */}
                      <td className="py-3 px-3 text-right font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                        {formatCLP(salesTransfer)}
                      </td>

                      {/* 9. Ventas Totales */}
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCLP(salesTotal)}
                      </td>

                      {/* 10. Diferencia Efectivo */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {session.difference === null || session.difference === undefined ? (
                          <span className="text-slate-400">—</span>
                        ) : diff === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            $0
                          </span>
                        ) : diff > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            +{formatCLP(diff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-slate-700 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            −{formatCLP(Math.abs(diff))}
                          </span>
                        )}
                      </td>

                      {/* 10. Diferencia Tarjeta */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {cardDiff === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            $0
                          </span>
                        ) : cardDiff > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            +{formatCLP(cardDiff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-slate-700 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            −{formatCLP(Math.abs(cardDiff))}
                          </span>
                        )}
                      </td>

                      {/* 11. Retiro */}
                      <td className="py-3 px-3 text-right font-black text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {session.withdrawal_amount !== null && session.withdrawal_amount !== undefined
                          ? formatCLP(session.withdrawal_amount)
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PastSessionDetailModal
        session={selectedPastSession}
        onClose={() => setSelectedPastSession(null)}
      />
    </div>
  )
}
