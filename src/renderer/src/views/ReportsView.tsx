import React from 'react'
import { BarChart3 } from 'lucide-react'

export const ReportsView: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Módulo de Reportes</h2>
      <p className="text-sm text-slate-500 max-w-md text-center">
        Gráficos estadísticos con Recharts: ventas por período, productos más vendidos y márgenes.
      </p>
    </div>
  )
}
