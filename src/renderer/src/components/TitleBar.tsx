import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Store } from 'lucide-react'

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(true)

  useEffect(() => {
    // Check initial state
    if (window.api?.isMaximized) {
      window.api.isMaximized().then(setIsMaximized)
    }

    // Subscribe to state change
    if (window.api?.onMaximizedChange) {
      const unsubscribe = window.api.onMaximizedChange((maximized) => {
        setIsMaximized(maximized)
      })
      return unsubscribe
    }
  }, [])

  const handleMinimize = (): void => {
    window.api?.minimize()
  }

  const handleMaximize = (): void => {
    window.api?.maximize()
  }

  const handleClose = (): void => {
    window.api?.close()
  }

  return (
    <header className="h-9 w-full bg-white dark:bg-slate-800 border-b border-lilac-100 dark:border-slate-700 flex items-center justify-between select-none titlebar-drag z-50">
      {/* Brand & Title */}
      <div className="flex items-center gap-2 px-3 text-lilac-900 dark:text-lilac-300 font-medium text-xs">
        <div className="w-5 h-5 rounded bg-lilac-500 text-white flex items-center justify-center shadow-sm">
          <Store className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-slate-800 dark:text-slate-100">POS Offline</span>
        <span className="text-slate-400 dark:text-slate-500">|</span>
        <span className="text-slate-500 dark:text-slate-400 font-normal">Punto de Venta</span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center h-full titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="h-full px-3 inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-lilac-100 dark:hover:bg-slate-700 hover:text-lilac-900 dark:hover:text-slate-100 transition-colors"
          title="Minimizar"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="h-full px-3 inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-lilac-100 dark:hover:bg-slate-700 hover:text-lilac-900 dark:hover:text-slate-100 transition-colors"
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5 rotate-90" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={handleClose}
          className="h-full px-3.5 inline-flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-colors"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
