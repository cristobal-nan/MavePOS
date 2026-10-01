import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatCLP } from '../../utils/formatters'
import { useHistoryStore } from '../../store/historyStore'
import { useCashStore } from '../../store/cashStore'

interface CancelSaleModalProps {
  sale: { id: number; folio: number; total: number } | null
  onClose: () => void
  onSuccess: (folio: number) => void
}

export const CancelSaleModal: React.FC<CancelSaleModalProps> = ({
  sale,
  onClose,
  onSuccess
}) => {
  const { cancelSale } = useHistoryStore()
  const { currentSession, fetchSummary } = useCashStore()

  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  if (!sale) return null

  const handleConfirmCancel = async (): Promise<void> => {
    setIsCancelling(true)
    setCancelError(null)

    const success = await cancelSale(sale.id, cancelReason)
    setIsCancelling(false)
    if (success) {
      if (currentSession?.id) {
        fetchSummary(currentSession.id)
      }
      onSuccess(sale.folio)
      onClose()
    } else {
      setCancelError(useHistoryStore.getState().error || 'Error al anular la venta.')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">
              ¿Confirmar Anulación de Venta?
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Folio #{sale.folio} · Total: {formatCLP(sale.total)}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Esta acción revertirá las unidades vendidas al stock de cada producto mediante un movimiento
          de inventario de tipo <strong>devolución</strong>. Esta acción no se puede deshacer.
        </p>

        {cancelError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{cancelError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Motivo de cancelación (opcional):
          </label>
          <input
            type="text"
            placeholder="Ej: Cliente canceló compra, error de digitación..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 text-slate-800"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isCancelling ? 'Anulando...' : 'Sí, Anular Venta'}
          </button>
        </div>
      </div>
    </div>
  )
}
