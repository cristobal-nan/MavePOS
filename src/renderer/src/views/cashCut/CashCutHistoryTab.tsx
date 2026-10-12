import React, { useState, useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { DailyCashRecord } from '@shared/types'
import { formatCLP, formatDateTime, groupSessionsByDay } from '../../utils/formatters'
import { useCashStore } from '../../store/cashStore'
import { EmptyState } from '../../components/common/EmptyState'
import { DailyRecordDetailModal } from './DailyRecordDetailModal'

export const CashCutHistoryTab: React.FC = () => {
  const { pastSessions } = useCashStore()
  const [selectedRecord, setSelectedRecord] = useState<DailyCashRecord | null>(null)

  const dailyRecords = useMemo(() => {
    return groupSessionsByDay(pastSessions)
  }, [pastSessions])

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full flex flex-col gap-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Registros Diarios de Caja</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro histórico consolidado por día de turnos cerrados, ventas por medio de pago, arqueos y retiros.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
          {dailyRecords.length} día{dailyRecords.length !== 1 ? 's' : ''} registrado(s)
        </span>
      </div>

      {dailyRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <EmptyState
            icon={CalendarDays}
            title="No hay registros diarios de caja"
            description="Los cierres de turnos y sus consolidados diarios quedarán registrados aquí automáticamente."
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1150px]">
              <thead className="bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 text-xs font-semibold border-b border-slate-200 dark:border-slate-750">
                <tr>
                  <th className="py-2.5 px-3 w-28 text-center">Fecha</th>
                  <th className="py-2.5 px-3 w-24 text-center">Turnos</th>
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
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
                {dailyRecords.map((record) => {
                  const diff = record.totalDifferenceCash
                  const cardDiff = record.totalDifferenceCard

                  return (
                    <tr
                      key={record.dateKey}
                      className="hover:bg-lilac-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800"
                      onClick={() => setSelectedRecord(record)}
                      title={
                        record.turnCount === 1
                          ? 'Haz clic para ver el detalle del turno cerrado'
                          : `Haz clic para ver el consolidado y los ${record.turnCount} turnos de este día`
                      }
                    >
                      {/* 1. Fecha */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {record.displayDate}
                        </span>
                      </td>

                      {/* 2. Cantidad de Turnos */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            record.turnCount === 1
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              : 'bg-lilac-100 dark:bg-lilac-950/60 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-lilac-800 font-extrabold'
                          }`}
                        >
                          {record.turnCount === 1 ? '1 turno' : `${record.turnCount} turnos`}
                        </span>
                      </td>

                      {/* 3. Apertura (Primer turno) */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono tabular-nums">
                        {formatDateTime(record.firstOpenedAt)}
                      </td>

                      {/* 4. Cierre (Último turno) */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono tabular-nums">
                        {record.lastClosedAt ? formatDateTime(record.lastClosedAt) : '—'}
                      </td>

                      {/* 5. Caja Inicial (Primer turno) */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.initialOpeningFund)}
                      </td>

                      {/* 6. Caja Final (Último turno) */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums">
                        {record.finalClosingCash !== null ? formatCLP(record.finalClosingCash) : '—'}
                      </td>

                      {/* 7. Ventas Efectivo (Sumatoria) */}
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.totalSalesCash)}
                      </td>

                      {/* 8. Ventas Tarjeta (Sumatoria) */}
                      <td className="py-3 px-3 text-right font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.totalSalesCard)}
                      </td>

                      {/* 9. Ventas Transferencia (Sumatoria) */}
                      <td className="py-3 px-3 text-right font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.totalSalesTransfer)}
                      </td>

                      {/* 10. Ventas Totales (Sumatoria) */}
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.totalSales)}
                      </td>

                      {/* 11. Diferencia Efectivo (Sumatoria Neta) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono tabular-nums">
                        {diff === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            $0
                          </span>
                        ) : diff > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            +{formatCLP(diff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            −{formatCLP(Math.abs(diff))}
                          </span>
                        )}
                      </td>

                      {/* 12. Diferencia Tarjeta (Sumatoria Neta) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono tabular-nums">
                        {cardDiff === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            $0
                          </span>
                        ) : cardDiff > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            +{formatCLP(cardDiff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            −{formatCLP(Math.abs(cardDiff))}
                          </span>
                        )}
                      </td>

                      {/* 13. Retiro (Sumatoria) */}
                      <td className="py-3 px-3 text-right font-black text-amber-700 dark:text-amber-400 whitespace-nowrap font-mono tabular-nums">
                        {formatCLP(record.totalWithdrawal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DailyRecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  )
}
