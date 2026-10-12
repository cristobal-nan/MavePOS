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

import { ViewHeader, SubTabs, SubTabItem } from '../components/common'

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

const SETTINGS_SUBTABS: SubTabItem<SettingsSubTab>[] = [
  { id: 'business', label: 'Datos del Negocio', icon: Store },
  { id: 'appearance', label: 'Apariencia y Temas', icon: Palette },
  { id: 'printers', label: 'Impresoras', icon: Printer },
  { id: 'cash', label: 'Fondo y Retiro', icon: Wallet },
  { id: 'inventory', label: 'Inventario', icon: Boxes },
  { id: 'backups', label: 'Respaldos', icon: HardDrive },
  { id: 'shortcuts', label: 'Atajos de Teclado', icon: Keyboard },
  { id: 'danger', label: 'Mantenimiento', icon: AlertTriangle }
]

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
      {/* ViewHeader Canónico */}
      <ViewHeader
        title="Configuración del Sistema"
        icon={Settings}
        badge="Sistema"
        primaryAction={
          isCurrentTabConfigurable ? (
            <button
              type="button"
              onClick={saveCurrentSettings}
              disabled={isSaving}
              aria-busy={isSaving}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25 ring-2 ring-amber-300 focus-visible:ring-amber-500 animate-pulse'
                  : 'bg-lilac-600 hover:bg-lilac-700 text-white shadow-lilac-600/20 focus-visible:ring-lilac-500'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Guardando…' : 'Guardar Cambios'}</span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping ml-0.5" />
              )}
            </button>
          ) : undefined
        }
      />

      {/* SubTabs Canónicas de Navegación */}
      <div className="px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center shrink-0 h-11 sm:h-12 overflow-x-auto">
        <SubTabs<SettingsSubTab>
          tabs={SETTINGS_SUBTABS}
          activeTab={activeSubTab}
          onChange={handleSubTabClick}
          ariaLabel="Subsecciones de configuración"
        />
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
