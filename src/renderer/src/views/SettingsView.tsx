import React, { useState } from 'react'
import {
  Settings,
  Store,
  Printer,
  HardDrive,
  Keyboard,
  AlertTriangle
} from 'lucide-react'
import { BusinessSettingsTab } from './settings/BusinessSettingsTab'
import { PrinterSettingsTab } from './settings/PrinterSettingsTab'
import { BackupSettingsTab } from './settings/BackupSettingsTab'
import { ShortcutsTab } from './settings/ShortcutsTab'
import { DangerZoneTab } from './settings/DangerZoneTab'

type SettingsSubTab = 'business' | 'printers' | 'backups' | 'shortcuts' | 'danger'

export const SettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('business')

  return (
    <div className="flex-1 p-6 bg-slate-50 flex flex-col gap-6 overflow-y-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Configuración del Sistema</h1>
            <p className="text-xs text-slate-500">
              Datos comerciales, copias de seguridad automáticas, atajos de teclado y mantenimiento.
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('business')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'business'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Datos del Negocio</span>
          </button>
          <button
            onClick={() => setActiveSubTab('printers')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'printers'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Impresoras y Periféricos</span>
          </button>
          <button
            onClick={() => setActiveSubTab('backups')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'backups'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Respaldos</span>
          </button>
          <button
            onClick={() => setActiveSubTab('shortcuts')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'shortcuts'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Atajos de Teclado</span>
          </button>
          <button
            onClick={() => setActiveSubTab('danger')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'danger'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mantenimiento</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-tab Content Modules */}
      {activeSubTab === 'business' && <BusinessSettingsTab />}
      {activeSubTab === 'printers' && <PrinterSettingsTab />}
      {activeSubTab === 'backups' && <BackupSettingsTab />}
      {activeSubTab === 'shortcuts' && <ShortcutsTab />}
      {activeSubTab === 'danger' && <DangerZoneTab />}
    </div>
  )
}
