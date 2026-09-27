import React from 'react'
import { History } from 'lucide-react'

export const HistoryView: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-4">
        <History className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Historial de Ventas</h2>
      <p className="text-sm text-slate-500 max-w-md text-center">
        Consulta de boletas y folios, cancelaciones totales, devoluciones parciales y salidas de caja.
      </p>
    </div>
  )
}
