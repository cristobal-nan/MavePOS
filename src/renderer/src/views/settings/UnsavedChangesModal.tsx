import React, { useEffect } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useSettingsStore, PendingNavigation } from '../../store/settingsStore'

interface UnsavedChangesModalProps {
  onProceedNavigation: (nav: PendingNavigation) => void
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  onProceedNavigation
}) => {
  const {
    showUnsavedModal,
    dirtyChanges,
    pendingNavigation,
    isSaving,
    saveCurrentSettings,
    discardCurrentSettings,
    setShowUnsavedModal,
    setPendingNavigation
  } = useSettingsStore()

  useEffect(() => {
    if (!showUnsavedModal) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!isSaving) {
          setShowUnsavedModal(false)
          setPendingNavigation(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showUnsavedModal, isSaving, setShowUnsavedModal, setPendingNavigation])

  if (!showUnsavedModal) return null

  const handleCancel = (): void => {
    setShowUnsavedModal(false)
    setPendingNavigation(null)
  }

  const handleDiscardAndLeave = (): void => {
    const nav = pendingNavigation
    discardCurrentSettings()
    setShowUnsavedModal(false)
    if (nav) {
      onProceedNavigation(nav)
    }
  }

  const handleSaveAndContinue = async (): Promise<void> => {
    const nav = pendingNavigation
    const saved = await saveCurrentSettings()
    if (saved) {
      setShowUnsavedModal(false)
      if (nav) {
        onProceedNavigation(nav)
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-700/60 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 select-none">
        {/* Header con icono de alerta */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/40">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="unsaved-changes-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Cambios no guardados en esta sección
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tienes modificaciones pendientes sin almacenar en la base de datos.
            </p>
          </div>
        </div>

        {/* Lista de cambios detectados */}
        <div className="bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
          <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
            Modificaciones detectadas:
          </span>
          <div className="flex flex-col gap-1.5 text-xs text-slate-800 dark:text-slate-200">
            {dirtyChanges.length === 0 ? (
              <span className="text-slate-500 dark:text-slate-400 italic">Hay cambios pendientes sin especificar.</span>
            ) : (
              dirtyChanges.map((change, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 font-black">•</span>
                  <div className="leading-snug">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{change.field}:</span>{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-mono tabular-nums bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/50 text-[11px]">
                      {change.value || '(vacío)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Para continuar navegando, elige si deseas <strong>guardar</strong> estas modificaciones ahora o <strong>descartarlas</strong> para restaurar los valores anteriores.
        </p>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/80">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/70 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleDiscardAndLeave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Descartar y salir
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSaving ? 'Guardando…' : 'Guardar y continuar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
