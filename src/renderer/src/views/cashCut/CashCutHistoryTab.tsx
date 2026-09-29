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

      <PastSessionDetailModal
        session={selectedPastSession}
        onClose={() => setSelectedPastSession(null)}
      />
    </div>
  )
}
