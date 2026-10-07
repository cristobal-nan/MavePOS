import React from 'react'
import { Keyboard } from 'lucide-react'

export const ShortcutsTab: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Guía de Atajos de Teclado del POS</h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">Optimizado para escáner HID y operación sin mouse</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Navigation Column */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-lilac-500" />
              Navegación entre Pantallas
            </h3>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Pantalla de Ventas</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F1
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Productos</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F2
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Control de Inventario</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F3
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Historial de Ventas</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F4
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Corte de Caja (Arqueo)</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F5
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Reportes y Métricas</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F6
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Configuración</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F7
                </kbd>
              </div>
            </div>
          </div>

          {/* Sales & Terminal Operations */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Operación en Punto de Venta
            </h3>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Cobrar Venta (Checkout)</span>
                <kbd className="px-2.5 py-1 bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700/80 rounded-md font-mono font-bold text-emerald-700 dark:text-emerald-300 shadow-xs">
                  F12
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Buscar Producto (Modal con %)</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-lilac-700 dark:text-lilac-300 shadow-xs">
                  F10
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Confirmar Código Escaneado</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                  Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Cerrar Modal / Cancelar</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                  Esc
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Cerrar Sistema POS</span>
                <kbd className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                  Alt + F4
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Fast Keyboard Flow Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Flujo Rápido por Teclado: Ajuste de Inventario (F3)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-200">1. Código y Cantidad</span>
                <kbd className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-xs text-lilac-700 dark:text-lilac-300">
                  Enter
                </kbd>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-200 leading-relaxed">
                Ingresa o escanea el código, presiona Enter para pasar a <strong className="text-slate-700 dark:text-slate-100">+ / -</strong>, ingresa la cantidad y presiona Enter para quitar el foco y entrar en modo de escucha.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-200">2. Tecla de Motivo</span>
                <kbd className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-xs text-lilac-700 dark:text-lilac-300">
                  1..9 / Letra
                </kbd>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-200 leading-relaxed">
                En estado de escucha, presiona la tecla asignada al motivo deseado. Se aplica de inmediato y puedes encadenar complementos adicionales.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-200">3. Confirmar Ajuste</span>
                <kbd className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-xs text-lilac-700 dark:text-lilac-300">
                  Enter
                </kbd>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-200 leading-relaxed">
                Habiendo aplicado un motivo por atajo, presionar Enter confirma el ajuste directamente. Si no usaste atajo, Enter continúa a Nueva Cantidad o Motivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
