import React from 'react'
import { CheckCircle2, Printer, Power } from 'lucide-react'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { useModalStack } from '../../utils/modalStack'

interface ReceiptCashCutModalProps {
  isOpen: boolean
  data: any | null
  onClose: () => void
  onExitApp?: () => void
}

export const ReceiptCashCutModal: React.FC<ReceiptCashCutModalProps> = ({
  isOpen,
  data,
  onClose,
  onExitApp
}) => {
  const { handleBackdropClick } = useModalStack({
    id: 'receipt-cash-cut-modal',
    isOpen: isOpen && !!data,
    onClose,
    closeOnBackdrop: true
  })

  if (!isOpen || !data) return null

  return (
    <div onClick={handleBackdropClick} className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            ¡Corte de Caja Realizado con Éxito!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sesión #{data.sessionId} cerrada el {formatDateTime(data.closedAt)}
          </p>
        </div>

        {/* Recibo Formateado (Protegido como papel blanco físico) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 font-mono text-xs flex flex-col gap-2 text-slate-800 thermal-ticket-paper shadow-sm">
          <div className="flex justify-between">
            <span>Fondo Inicial:</span>
            <span className="font-bold">{formatCLP(data.openingFund)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Ventas Efectivo:</span>
            <span className="font-bold">+{formatCLP(data.salesCash)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Ventas Tarjeta:</span>
            <span className="font-bold">+{formatCLP(data.salesCard)}</span>
          </div>
          <div className="flex justify-between text-lilac-700">
            <span>Ventas Transferencia:</span>
            <span className="font-bold">+{formatCLP(data.salesTransfer)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
            <span>Total Ventas:</span>
            <span>{formatCLP(data.salesTotal)}</span>
          </div>
          <div className="flex justify-between text-rose-600">
            <span>Devoluciones:</span>
            <span>−{formatCLP(data.returnsTotal)}</span>
          </div>
          <div className="flex justify-between text-amber-700">
            <span>Salidas de Dinero:</span>
            <span>−{formatCLP(data.withdrawalsTotal)}</span>
          </div>
          <div className="flex justify-between font-black border-t-2 border-dashed border-slate-300 pt-2 text-sm">
            <span>Efectivo Contado:</span>
            <span>{formatCLP(data.closingCash)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Efectivo Esperado:</span>
            <span>{formatCLP(data.expectedCash)}</span>
          </div>
          {data.difference !== null && data.difference !== undefined && (
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
              <span>Diferencia:</span>
              <span
                className={
                  data.difference === 0
                    ? 'text-emerald-700'
                    : data.difference > 0
                    ? 'text-blue-700'
                    : 'text-rose-700'
                }
              >
                {data.difference > 0 ? `+${formatCLP(data.difference)}` : formatCLP(data.difference)}
              </span>
            </div>
          )}
          {data.withdrawalAmount !== undefined && data.withdrawalAmount !== null && (
            <div className="flex justify-between font-bold text-amber-800 border-t border-slate-200 pt-1">
              <span>Monto Retirado:</span>
              <span>{formatCLP(data.withdrawalAmount)}</span>
            </div>
          )}
          {data.nextOpeningFund !== undefined && data.nextOpeningFund !== null && (
            <div className="flex justify-between font-bold text-lilac-800">
              <span>Fondo Siguiente Turno:</span>
              <span>{formatCLP(data.nextOpeningFund)}</span>
            </div>
          )}
          {data.notes && (
            <div className="mt-2 text-[11px] font-sans text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
              <strong>Notas:</strong> {data.notes}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprobante</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Nuevo Turno
            </button>

            {onExitApp && (
              <button
                type="button"
                onClick={onExitApp}
                className="px-5 py-2.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Cerrar POS y Salir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
