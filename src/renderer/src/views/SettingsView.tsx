import React, { useState } from 'react'
import {
  Settings,
  Store,
  Printer,
  Wallet,
  Boxes,
  HardDrive,
  Keyboard,
  Palette,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { BusinessSettingsTab } from './settings/BusinessSettingsTab'
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab'
import { PrinterSettingsTab } from './settings/PrinterSettingsTab'
import { CashSettingsTab } from './settings/CashSettingsTab'
import { InventorySettingsTab } from './settings/InventorySettingsTab'
import { BackupSettingsTab } from './settings/BackupSettingsTab'
import { ShortcutsTab } from './settings/ShortcutsTab'
import { DangerZoneTab } from './settings/DangerZoneTab'
import { UnsavedChangesModal } from './settings/UnsavedChangesModal'
import { useSettingsStore, PendingNavigation } from '../store/settingsStore'
import { useUIStore } from '../store/uiStore'

type SettingsSubTab =
  | 'business'
  | 'appearance'
  | 'printers'
  | 'cash'
  | 'inventory'
  | 'backups'
  | 'shortcuts'
  | 'danger'

const CONFIGURABLE_TABS: SettingsSubTab[] = ['business', 'printers', 'cash', 'inventory']

export const SettingsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('business')

  const {
    isDirty,
    isSaving,
    toastMessage,
    saveCurrentSettings,
    setPendingNavigation,
    setShowUnsavedModal
  } = useSettingsStore()

  const handleSubTabClick = (targetSubTab: SettingsSubTab): void => {
    if (targetSubTab === activeSubTab) return
    if (isDirty) {
      setPendingNavigation({ type: 'subtab', target: targetSubTab })
      setShowUnsavedModal(true)
    } else {
      setActiveSubTab(targetSubTab)
    }
  }

  const handleProceedNavigation = (nav: PendingNavigation): void => {
    if (nav.type === 'subtab') {
      setActiveSubTab(nav.target as SettingsSubTab)
    } else if (nav.type === 'mainTab') {
      useUIStore.getState().setActiveTab(nav.target as any)
    }
  }

  const isCurrentTabConfigurable = CONFIGURABLE_TABS.includes(activeSubTab)

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden select-none relative">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-lilac-100 dark:border-slate-700 px-4 sm:px-6 pt-3 gap-2 pb-0 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shadow-inner shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                Configuración del Sistema
              </h1>
            </div>
          </div>

          {/* Botón Global de Guardado (Fijo arriba a la derecha) */}
          {isCurrentTabConfigurable && (
            <button
              type="button"
              onClick={saveCurrentSettings}
              disabled={isSaving}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-lilac-600 hover:bg-lilac-700 text-white shadow-lilac-600/20'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping ml-0.5" />
              )}
            </button>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-transparent -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSubTabClick('business')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'business'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Datos del Negocio</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('appearance')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'appearance'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Apariencia y Temas</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('printers')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'printers'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Impresoras y Periféricos</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('cash')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'cash'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Fondo y Retiro</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('inventory')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'inventory'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventario</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('backups')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'backups'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Respaldos</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('shortcuts')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'shortcuts'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Atajos de Teclado</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabClick('danger')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeSubTab === 'danger'
                ? 'border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/40'
                : 'border-transparent text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50/60 dark:hover:bg-rose-950/30'
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
        {activeSubTab === 'appearance' && <AppearanceSettingsTab />}
        {activeSubTab === 'printers' && <PrinterSettingsTab />}
        {activeSubTab === 'cash' && <CashSettingsTab />}
        {activeSubTab === 'inventory' && <InventorySettingsTab />}
        {activeSubTab === 'backups' && <BackupSettingsTab />}
        {activeSubTab === 'shortcuts' && <ShortcutsTab />}
        {activeSubTab === 'danger' && <DangerZoneTab />}
      </div>

      {/* Modal de Protección de Navegación con Cambios no Guardados */}
      <UnsavedChangesModal onProceedNavigation={handleProceedNavigation} />

      {/* Toast Flotante de Guardado Exitoso */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 p-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
