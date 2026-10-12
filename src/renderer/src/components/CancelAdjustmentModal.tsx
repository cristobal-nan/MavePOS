import React, { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, Undo2, X, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { AdjustmentCancellationPreview } from '@shared/types'

interface CancelAdjustmentModalProps {
  preview: AdjustmentCancellationPreview | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (movementId: number) => Promise<void>
}

export const CancelAdjustmentModal: React.FC<CancelAdjustmentModalProps> = ({
  preview,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Manejo de tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !preview) return null

  const targetMovementId = preview.movements_to_revert[0]?.id
  const totalCount = preview.movements_to_revert.length

  const handleConfirmClick = async (): Promise<void> => {
    if (!targetMovementId || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm(targetMovementId)
      onClose()
    } catch {
      // Error handling is managed by the caller
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatMovementDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-adj-title"
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cancel-adj-title" className="text-base font-bold text-slate-800 dark:text-slate-100">
                Confirmar Cancelación de Ajuste
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {preview.product_name} · <span className="font-mono font-bold">{preview.product_code}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Advertencia / Explicación */}
          <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl">
            <p className="text-xs text-rose-900 dark:text-rose-200 font-medium leading-relaxed">
              {totalCount === 1 ? (
                <>
                  Se revertirá y eliminará el ajuste seleccionado, restaurando el stock previo del producto.
                </>
              ) : (
                <>
                  Este ajuste tiene movimientos posteriores. Para mantener la coherencia del kardex, se revertirán y eliminarán en cascada los siguientes <strong className="font-black text-rose-700 dark:text-rose-300 tabular-nums">{totalCount} movimientos de ajuste</strong>:
                </>
              )}
            </p>
          </div>

          {/* Lista de movimientos a revertir */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/40">
            <div className="px-3 py-2 bg-slate-100/70 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <span>Movimientos que se eliminarán (<span className="tabular-nums">{totalCount}</span>)</span>
              <span>Variación</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
              {preview.movements_to_revert.map((m, idx) => {
                const isPos = m.delta > 0
                return (
                  <div key={m.id} className="p-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatMovementDate(m.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic truncate" title={m.reason}>
                        {m.reason || '(Sin motivo)'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 font-black text-xs font-mono tabular-nums ${
                          isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isPos ? `+${m.delta}` : m.delta} un.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumen de impacto de stock */}
          <div className="p-3.5 bg-slate-100/70 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Stock Actual
              </span>
              <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {preview.current_stock} un.
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Reversión Total
              </span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {preview.total_delta > 0 ? `-${preview.total_delta}` : `+${Math.abs(preview.total_delta)}`} un.
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-lilac-600 dark:text-lilac-400">
                Stock Resultante
              </span>
              <span className="font-mono text-sm font-black text-lilac-700 dark:text-lilac-300 tabular-nums">
                {preview.projected_stock} un.
              </span>
            </div>
          </div>
        </div>

        {/* Pie de acción */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
          >
            Volver / Descartar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmClick}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Eliminando…</span>
              </>
            ) : (
              <>
                <Undo2 className="w-3.5 h-3.5" />
                <span>
                  {totalCount === 1 ? 'Confirmar Cancelación' : `Confirmar y Eliminar ${totalCount} Ajustes`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
