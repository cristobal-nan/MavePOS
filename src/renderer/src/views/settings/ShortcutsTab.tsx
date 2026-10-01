import React from 'react'
import { Keyboard } from 'lucide-react'

export const ShortcutsTab: React.FC = () => {
  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-lilac-600" />
            <h2 className="text-sm font-bold text-slate-800">Guía de Atajos de Teclado del POS</h2>
          </div>
          <span className="text-xs text-slate-400">Optimizado para escáner HID y operación sin mouse</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Navigation Column */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-lilac-500" />
              Navegación entre Pantallas
            </h3>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Pantalla de Ventas</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F1
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Productos</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F2
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Control de Inventario</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F3
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Historial de Ventas</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F4
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Corte de Caja (Arqueo)</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F5
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Reportes y Métricas</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F6
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Configuración</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F7
                </kbd>
              </div>
            </div>
          </div>

          {/* Sales & Terminal Operations */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Operación en Punto de Venta
            </h3>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Cobrar Venta (Checkout)</span>
                <kbd className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-mono font-bold text-emerald-700 shadow-xs">
                  F12
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Buscar Producto (Modal con %)</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                  F10
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Confirmar Código Escaneado</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                  Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Cerrar Modal / Cancelar</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                  Esc
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Cerrar Sistema POS</span>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                  Alt + F4
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
