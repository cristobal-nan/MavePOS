import React from 'react'
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 select-none">
        {/* Header con icono de alerta */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Los siguientes cambios no han sido guardados
            </h3>
            <p className="text-xs text-slate-500">
              Tienes modificaciones pendientes en esta sección.
            </p>
          </div>
        </div>

        {/* Lista de cambios detectados */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
            Modificaciones detectadas:
          </span>
          <div className="flex flex-col gap-1.5 text-xs text-slate-800">
            {dirtyChanges.length === 0 ? (
              <span className="text-slate-500 italic">Hay cambios pendientes sin especificar.</span>
            ) : (
              dirtyChanges.map((change, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-black">•</span>
                  <div className="leading-snug">
                    <span className="font-bold text-slate-900">{change.field}:</span>{' '}
                    <span className="text-slate-700 font-mono bg-white/80 px-1.5 py-0.5 rounded border border-amber-200/60 text-[11px]">
                      {change.value || '(vacío)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Para continuar a la otra pestaña, elige si deseas <strong>guardar</strong> estas modificaciones ahora o <strong>descartarlas</strong> para restaurar los valores anteriores.
        </p>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleDiscardAndLeave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            Descartar y salir
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSaving ? 'Guardando...' : 'Guardar y continuar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
