import React, { useState } from 'react'
import {
  Database,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  X
} from 'lucide-react'
import { useCatalogStore } from '../../store/catalogStore'
import { useCashStore } from '../../store/cashStore'

export const DangerZoneTab: React.FC = () => {
  const { fetchProducts, loadMetadata } = useCatalogStore()
  const { checkCurrentSession } = useCashStore()

  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [keepSettings, setKeepSettings] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null)

  const handleOpenResetModal = (): void => {
    setConfirmText('')
    setResetSuccessMessage(null)
    setResetErrorMessage(null)
    setIsResetModalOpen(true)
  }

  const handleExecuteReset = async (): Promise<void> => {
    if (confirmText.trim().toUpperCase() !== 'VACIAR') return

    setIsResetting(true)
    setResetErrorMessage(null)

    try {
      await window.api.resetDatabase(keepSettings)

      await fetchProducts()
      await loadMetadata()
      await checkCurrentSession()

      setIsResetModalOpen(false)
      setResetSuccessMessage(
        'La base de datos ha sido vaciada con éxito. El sistema está 100% limpio y listo para nuevas operaciones.'
      )
    } catch (err: any) {
      setResetErrorMessage(err.message || 'Error al vaciar la base de datos.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-150">
      {/* System Info Card */}
      <div className="bg-white rounded-2xl border border-lilac-100 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Database className="w-4 h-4 text-lilac-600" />
          <span>Estado de la Base de Datos Local</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-400 block mb-0.5 font-medium">Motor de BD</span>
            <span className="font-bold text-slate-700">SQLite (better-sqlite3)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-slate-400 block mb-0.5 font-medium">Modo de Operación</span>
            <span className="font-bold text-emerald-600">WAL (Write-Ahead Logging) 100% Offline</span>
          </div>
        </div>
      </div>

      {/* Danger Zone Box */}
      <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
          Temporal · Desarrollo
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 pr-16">
            <h2 className="text-sm font-bold text-slate-800">Vaciar Base de Datos</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Elimina todos los datos operacionales: catálogo de productos, categorías, proveedores,
              existencias, historial de inventario / kardex, sesiones de caja y ventas registradas.
              Deja el sistema completamente limpio para reiniciar pruebas o reimportar desde cero.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-400 italic">
            Esta función está pensada para etapas de prueba y configuración inicial.
          </span>
          <button
            onClick={handleOpenResetModal}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center gap-1.5 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Vaciar Base de Datos...</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-800 font-bold text-base">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>¿Vaciar toda la base de datos?</span>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-red-100/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-600">
              {resetErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                  {resetErrorMessage}
                </div>
              )}

              <p className="font-semibold text-slate-800">
                Se eliminarán permanentemente los siguientes registros:
              </p>

              <ul className="space-y-1.5 pl-2">
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todos los productos simples, variables y variaciones
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todas las categorías y proveedores asociados
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todo el historial de ventas, comprobantes y pagos
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todas las sesiones de caja, arqueos y salidas de dinero
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todo el historial de kardex y movimientos de inventario
                </li>
              </ul>

              {/* Keep settings checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepSettings}
                    onChange={(e) => setKeepSettings(e.target.checked)}
                    className="w-4 h-4 rounded text-lilac-600 focus:ring-lilac-500 accent-lilac-600 cursor-pointer"
                  />
                  <span>Preservar datos del negocio y rutas de respaldo</span>
                </label>
              </div>

              {/* Safety text challenge */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Para confirmar, escribe la palabra <span className="text-red-600 font-mono font-extrabold">VACIAR</span>:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escribe VACIAR..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl text-xs text-slate-800 font-mono focus:outline-none uppercase"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'VACIAR' || isResetting}
                onClick={handleExecuteReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Vaciando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Vaciar Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Flotante de Notificación (Bottom-Right, sin Layout Shift) */}
      {resetSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-emerald-300 text-emerald-950 p-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{resetSuccessMessage}</span>
          <button
            onClick={() => setResetSuccessMessage(null)}
            className="text-slate-400 hover:text-slate-600 ml-2 p-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
