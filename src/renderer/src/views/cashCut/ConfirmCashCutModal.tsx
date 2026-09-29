import React from 'react'
import { AlertCircle } from 'lucide-react'
import { formatCLP } from '../../utils/formatters'

interface ConfirmCashCutModalProps {
  isOpen: boolean
  sessionId: number
  countedCash: number
  expectedCash: number
  difference: number
  isClosing: boolean
  onClose: () => void
  onConfirm: () => void
}

export const ConfirmCashCutModal: React.FC<ConfirmCashCutModalProps> = ({
  isOpen,
  sessionId,
  countedCash,
  expectedCash,
  difference,
  isClosing,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null

  return (
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
            <p className="text-xs text-slate-500">Sesión #{sessionId}</p>
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
            onClick={onClose}
            disabled={isClosing}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClosing}
            className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 disabled:opacity-50"
          >
            {isClosing ? 'Cerrando...' : 'Sí, Cerrar Turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
