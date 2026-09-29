import React from 'react'
import { X } from 'lucide-react'
import { CashSession } from '@shared/types'
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
              #{session.id}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Corte de Caja #{session.id}
              </h4>
              <p className="text-[11px] text-slate-500">
                {session.closed_at
                  ? `Cerrada: ${formatDateTime(session.closed_at)}`
                  : 'Sesión no cerrada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex flex-col gap-2.5 text-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Apertura:</span>
            <span>{formatDateTime(session.opened_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Fondo Inicial:</span>
            <span className="font-bold">{formatCLP(session.opening_fund)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
            <span>Efectivo Contado al Cierre:</span>
            <span>
              {session.closing_cash !== null && session.closing_cash !== undefined
                ? formatCLP(session.closing_cash)
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Efectivo Esperado:</span>
            <span>
              {session.expected_cash !== null && session.expected_cash !== undefined
                ? formatCLP(session.expected_cash)
                : '—'}
            </span>
          </div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-2">
            <span>Diferencia de Cuadre:</span>
            <span
              className={
                (session.difference ?? 0) === 0
                  ? 'text-emerald-600'
                  : (session.difference ?? 0) > 0
                  ? 'text-blue-600'
                  : 'text-rose-600'
              }
            >
              {(session.difference ?? 0) > 0
                ? `+${formatCLP(session.difference!)}`
                : formatCLP(session.difference ?? 0)}
            </span>
          </div>
          {session.notes && (
            <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600">
              <span className="font-bold block mb-0.5">Observaciones:</span>
              {session.notes}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
