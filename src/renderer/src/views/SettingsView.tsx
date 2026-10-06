import React, { useState } from 'react'
import {
  Settings,
  Store,
  Printer,
  Wallet,
  Boxes,
  HardDrive,
  Keyboard,
  AlertTriangle
} from 'lucide-react'
import { BusinessSettingsTab } from './settings/BusinessSettingsTab'
import { PrinterSettingsTab } from './settings/PrinterSettingsTab'
import { CashSettingsTab } from './settings/CashSettingsTab'
import { InventorySettingsTab } from './settings/InventorySettingsTab'
import { BackupSettingsTab } from './settings/BackupSettingsTab'
import { ShortcutsTab } from './settings/ShortcutsTab'
import { DangerZoneTab } from './settings/DangerZoneTab'

type SettingsSubTab = 'business' | 'printers' | 'cash' | 'inventory' | 'backups' | 'shortcuts' | 'danger'

export const SettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('business')

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="bg-white border-b border-lilac-100 px-4 sm:px-6 pt-3 gap-2 pb-0 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shadow-inner shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Configuración del Sistema
              </h1>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-transparent -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('business')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'business'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Datos del Negocio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('printers')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'printers'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Impresoras y Periféricos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cash')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'cash'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Fondo y Retiro</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('inventory')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'inventory'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventario</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('backups')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'backups'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Respaldos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('shortcuts')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'shortcuts'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Atajos de Teclado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('danger')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'danger'
                ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                : 'border-transparent text-rose-600 hover:text-rose-800 hover:bg-rose-50/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Mantenimiento</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
        {activeSubTab === 'business' && <BusinessSettingsTab />}
        {activeSubTab === 'printers' && <PrinterSettingsTab />}
        {activeSubTab === 'cash' && <CashSettingsTab />}
        {activeSubTab === 'inventory' && <InventorySettingsTab />}
        {activeSubTab === 'backups' && <BackupSettingsTab />}
        {activeSubTab === 'shortcuts' && <ShortcutsTab />}
        {activeSubTab === 'danger' && <DangerZoneTab />}
      </div>
    </div>
  )
}
