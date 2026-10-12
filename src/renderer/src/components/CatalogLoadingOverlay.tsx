import React, { useEffect, useState } from 'react'
import { Store, Loader2, CheckCircle2, Zap } from 'lucide-react'
import { useMemoryCatalogStore } from '../store/memoryCatalogStore'

interface CatalogLoadingOverlayProps {
  onReady?: () => void
}

export const CatalogLoadingOverlay: React.FC<CatalogLoadingOverlayProps> = ({ onReady }) => {
  const { isInitialized, isLoading, totalCount, loadDurationMs, initCatalog } = useMemoryCatalogStore()
  const [showCompleted, setShowCompleted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    initCatalog()
  }, [initCatalog])

  useEffect(() => {
    if (isInitialized && !isLoading) {
      setShowCompleted(true)
      const timer = setTimeout(() => {
        setDismissed(true)
        onReady?.()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isInitialized, isLoading, onReady])

  if (dismissed || (isInitialized && !showCompleted)) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center flex flex-col items-center">
          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-lilac-50 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-4 border border-lilac-100 dark:border-slate-700 shadow-sm relative">
            {showCompleted ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-300" />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-lilac-600 dark:text-lilac-400" />
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center justify-center gap-1.5">
            {showCompleted ? (
              <span>¡Catálogo Optimizado en Memoria!</span>
            ) : (
              <span>Precargando Catálogo en Memoria...</span>
            )}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs leading-relaxed">
            {showCompleted
              ? `Listo para búsquedas y escáner en 0 ms (${totalCount} productos indexados en ${loadDurationMs} ms).`
              : 'Indexando productos activos en RAM para búsquedas y lecturas de código de barras instantáneas.'}
          </p>

          {/* Progress Container */}
          <div className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                {showCompleted ? (
                  <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Store className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                )}
                <span>{showCompleted ? 'Catálogo en RAM Activo' : 'Cargando Productos'}</span>
              </span>
              {showCompleted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">100% Listo</span>
              ) : (
                <span className="text-lilac-600 dark:text-lilac-400 font-mono font-bold animate-pulse">
                  Procesando...
                </span>
              )}
            </div>

            <div className="w-full bg-slate-200/80 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  showCompleted
                    ? 'w-full bg-emerald-600'
                    : 'w-full bg-gradient-to-r from-lilac-500 via-purple-500 to-lilac-600 animate-pulse'
                }`}
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-mono">
              {showCompleted
                ? `${totalCount} productos listos en ${loadDurationMs} ms`
                : 'Leyendo datos desde SQLite WAL...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
