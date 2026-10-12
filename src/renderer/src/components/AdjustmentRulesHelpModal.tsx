import React, { useEffect } from 'react'
import {
  X,
  Pencil,
  Undo2,
  ShieldAlert,
  Clock,
  Layers,
  BookOpen,
  CheckCircle2
} from 'lucide-react'

interface AdjustmentRulesHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AdjustmentRulesHelpModal: React.FC<AdjustmentRulesHelpModalProps> = ({
  isOpen,
  onClose
}) => {
  // Manejo de tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adj-rules-title"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-lilac-900/60 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lilac-100 dark:bg-lilac-900/40 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-lilac-700 leading-none">
                  Guía Operativa
                </span>
                <h2 id="adj-rules-title" className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Cancelación de Ajustes y Edición de Motivos
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reglas de negocio y auditoría para la modificación de existencias
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
            title="Cerrar modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Tarjetas Explicativas */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Tarjeta 1: Edición de Motivos */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-3">
            <div className="flex items-center gap-2.5 text-lilac-700 dark:text-lilac-300">
              <div className="p-1.5 rounded-lg bg-lilac-100 dark:bg-lilac-950/60 border border-lilac-200 dark:border-lilac-800">
                <Pencil className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">1. Edición de Motivos de Ajuste</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Permite corregir errores tipográficos o aclarar la justificación de un ajuste de inventario realizado con anterioridad sin alterar las cantidades.
            </p>
            <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Solo ajustes manuales:</strong> Exclusivo para movimientos creados desde la pestaña Inventario. No se permite editar motivos de ventas, devoluciones, importaciones ni stock inicial.
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Límite de 1 semana (168 horas):</strong> Transcurridos 7 días desde el registro del ajuste, el motivo queda bloqueado permanentemente para auditoría.
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Cancelación en Cascada */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60">
                <Undo2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">2. Cancelación de Ajustes en Cascada</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Permite deshacer ajustes erróneos restaurando atómicamente el stock anterior y eliminando los registros del kardex.
            </p>
            <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <Layers className="w-4 h-4 text-lilac-600 dark:text-lilac-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Reversión en cascada:</strong> Si el ajuste tiene movimientos posteriores, todos se revierten juntos para mantener la correlación cronológica.
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Bloqueo por ventas o movimientos comerciales:</strong> Si entre el ajuste y el estado actual ocurrió una venta o devolución, la cancelación se bloquea protegiendo las ventas. (Los ajustes posteriores a esa venta sí podrán cancelarse).
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Límite de cantidad y tiempo:</strong> Se pueden revertir como máximo <strong>5 movimientos</strong> en total y el ajuste no puede tener más de <strong>7 días (168 horas)</strong> de antigüedad.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de acción */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Integridad y auditoría de inventario garantizada
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 active:scale-95 transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
