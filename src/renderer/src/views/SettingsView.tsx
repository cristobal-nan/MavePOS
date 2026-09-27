import React from 'react'
import { Settings } from 'lucide-react'

export const SettingsView: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500 bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-4">
        <Settings className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Configuración del Sistema</h2>
      <p className="text-sm text-slate-500 max-w-md text-center">
        Parámetros del negocio, configuración de impresoras (térmica/normal), cajón y respaldos automáticos.
      </p>
    </div>
  )
}
