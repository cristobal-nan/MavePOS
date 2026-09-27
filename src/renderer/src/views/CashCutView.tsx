import React from 'react'
import { Calculator } from 'lucide-react'

export const CashCutView: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-4">
        <Calculator className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Corte de Caja</h2>
      <p className="text-sm text-slate-500 max-w-md text-center">
        Resumen de turno: fondo de caja, desglose por método de pago, devoluciones, salidas y arqueo final.
      </p>
    </div>
  )
}
