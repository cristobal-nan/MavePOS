import React from 'react'
import { AlertCircle } from 'lucide-react'
import { formatCLP } from '../../utils/formatters'

interface ConfirmCashCutModalProps {
  isOpen: boolean
  sessionId: number
  countedCash: number
  expectedCash: number
  difference: number
  cardDifference?: number
  transferDifference?: number
  withdrawalAmount?: number
  nextOpeningFund?: number
  hasSales?: boolean
  isClosing: boolean
  onClose: () => void
  onConfirm: () => void
  onConfirmWithoutRecording?: () => void
}

export const ConfirmCashCutModal: React.FC<ConfirmCashCutModalProps> = ({
  isOpen,
  sessionId,
  countedCash,
  expectedCash,
  difference,
  cardDifference,
  transferDifference,
  withdrawalAmount,
  nextOpeningFund,
  hasSales = true,
  isClosing,
  onClose,
  onConfirm,
  onConfirmWithoutRecording
}) => {
  if (!isOpen) return null

  if (!hasSales) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                No hubieron ventas este período
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sesión #{sessionId}</p>
            </div>
          </div>

          <div className="bg-lilac-50/50 dark:bg-slate-800/80 border border-lilac-200/80 dark:border-slate-700 rounded-2xl p-4 text-xs flex flex-col gap-2.5">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              No se registraron ventas durante este turno. Al confirmar, la sesión se cerrará y <strong>no se registrará en el historial de cortes</strong>.
            </p>
            <div className="flex justify-between border-t border-lilac-200/60 dark:border-slate-700 pt-2 text-slate-600 dark:text-slate-400">
              <span className="font-medium">Fondo Inicial de Apertura:</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCLP(expectedCash)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Si deseas registrar este cierre en el historial de todas formas, pulsa <strong>"Guardar igual"</strong>.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isClosing}
              className="px-3.5 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isClosing}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Guardar igual
            </button>
            <button
              type="button"
              onClick={onConfirmWithoutRecording || onConfirm}
              disabled={isClosing}
              className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isClosing ? 'Cerrando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              ¿Confirmar Corte y Cierre de Turno?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sesión #{sessionId}</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Efectivo Físico Contado:</span>
            <span className="font-black text-slate-900 dark:text-white">{formatCLP(countedCash)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Efectivo Esperado:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCLP(expectedCash)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 font-bold">
            <span className="text-slate-700 dark:text-slate-300">Diferencia Efectivo:</span>
            <span
              className={
                difference === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : difference > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {difference === 0 ? 'Cuadrada ($0)' : difference > 0 ? `+${formatCLP(difference)}` : formatCLP(difference)}
            </span>
          </div>

          {cardDifference !== undefined && (
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Diferencia Tarjeta:</span>
              <span
                className={`font-bold ${
                  cardDifference === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : cardDifference > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {cardDifference === 0 ? 'Cuadrada ($0)' : cardDifference > 0 ? `+${formatCLP(cardDifference)}` : formatCLP(cardDifference)}
              </span>
            </div>
          )}

          {transferDifference !== undefined && transferDifference !== 0 && (
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Diferencia Transferencia:</span>
              <span
                className={`font-bold ${
                  transferDifference > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {transferDifference > 0 ? `+${formatCLP(transferDifference)}` : formatCLP(transferDifference)}
              </span>
            </div>
          )}

          {(withdrawalAmount !== undefined || nextOpeningFund !== undefined) && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-1 flex flex-col gap-1.5 bg-lilac-50/50 dark:bg-slate-750 -mx-4 -mb-4 p-3 rounded-b-2xl">
              {withdrawalAmount !== undefined && (
                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                  <span className="text-amber-800 dark:text-amber-300">Retiro de Efectivo:</span>
                  <span className="text-amber-700 dark:text-amber-400 font-black">{formatCLP(withdrawalAmount)}</span>
                </div>
              )}
              {nextOpeningFund !== undefined && (
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Fondo Siguiente Turno:</span>
                  <span className="font-bold text-lilac-800 dark:text-lilac-300">{formatCLP(nextOpeningFund)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Al confirmar, la sesión se cerrará definitivamente y se emitirá el comprobante de arqueo.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClosing}
            className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 disabled:opacity-50 cursor-pointer"
          >
            {isClosing ? 'Cerrando...' : 'Sí, Cerrar Turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
