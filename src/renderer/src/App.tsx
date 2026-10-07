import React, { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { NavigationTabs, TabId } from './components/NavigationTabs'
import { useUIStore } from './store/uiStore'
import { useCashStore } from './store/cashStore'
import { useCatalogStore } from './store/catalogStore'
import { useInventoryStore } from './store/inventoryStore'
import { SalesView } from './views/SalesView'
import { CatalogView } from './views/CatalogView'
import { InventoryView } from './views/InventoryView'
import { CashCutView } from './views/CashCutView'
import { ReportsView } from './views/ReportsView'
import { SettingsView } from './views/SettingsView'
import { CloseConfirmModal } from './components/CloseConfirmModal'
import { CashOpeningScreen } from './components/CashOpeningScreen'
import { ReceiptCashCutModal } from './views/cashCut/ReceiptCashCutModal'
import { formatCLP } from './utils/formatters'
import { Store, Loader2 } from 'lucide-react'
import { useSalesStore } from './store/salesStore'
import { useSettingsStore } from './store/settingsStore'

export const App: React.FC = () => {
  const { activeTab, setActiveTab, openCloseModal } = useUIStore()
  const {
    currentSession,
    isLoading,
    checkCurrentSession,
    completedCutReceipt,
    setCompletedCutReceipt
  } = useCashStore()
  const { lastSale, fetchLastSale } = useSalesStore()

  // Manejar selección de pestaña (siempre resetear Inventario a 'adjust')
  const handleSelectTab = (tab: TabId): void => {
    if (activeTab === 'configuracion' && tab !== 'configuracion' && useSettingsStore.getState().isDirty) {
      useSettingsStore.getState().setPendingNavigation({ type: 'mainTab', target: tab })
      useSettingsStore.getState().setShowUnsavedModal(true)
      return
    }
    if (tab === 'inventario') {
      useInventoryStore.getState().setActiveTab('adjust')
    }
    setActiveTab(tab)
  }

  // Limpiar búsqueda de productos al cambiar de pestaña
  useEffect(() => {
    useCatalogStore.getState().setSearchQuery('')
  }, [activeTab])

  // Check active cash session & load saved theme and surface mode on app startup
  useEffect(() => {
    checkCurrentSession()
    useUIStore.getState().loadTheme()
    useUIStore.getState().loadSurfaceMode()
  }, [checkCurrentSession])

  // Sincronizar información de la última venta al iniciar sesión
  useEffect(() => {
    if (currentSession) {
      fetchLastSale(currentSession.id)
    }
  }, [currentSession?.id, fetchLastSale])

  // Keyboard navigation between tabs (F1 to F6) - only active when cash is open
  useEffect(() => {
    if (!currentSession) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      const shortcuts: Record<string, TabId> = {
        F1: 'ventas',
        F2: 'catalogo',
        F3: 'inventario',
        F4: 'corte',
        F5: 'reportes',
        F6: 'configuracion'
      }

      if (shortcuts[e.key]) {
        e.preventDefault()
        handleSelectTab(shortcuts[e.key])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSession, setActiveTab])

  const renderActiveView = (): React.ReactNode => {
    switch (activeTab) {
      case 'ventas':
        return <SalesView />
      case 'catalogo':
        return <CatalogView />
      case 'inventario':
        return <InventoryView />
      case 'corte':
        return <CashCutView />
      case 'reportes':
        return <ReportsView />
      case 'configuracion':
        return <SettingsView />
      default:
        return <SalesView />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Frameless Custom TitleBar */}
      <TitleBar />

      {/* Close and Backup Confirmation Modal */}
      <CloseConfirmModal />

      {/* Receipt Cash Cut Modal (shows after closing a shift) */}
      <ReceiptCashCutModal
        isOpen={!!completedCutReceipt}
        data={completedCutReceipt}
        onClose={() => setCompletedCutReceipt(null)}
        onExitApp={() => {
          setCompletedCutReceipt(null)
          openCloseModal('countdown_backup')
        }}
      />

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="w-14 h-14 rounded-2xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <Store className="w-7 h-7" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-lilac-600" />
            <span>Cargando sistema y base de datos...</span>
          </div>
        </div>
      ) : !currentSession ? (
        /* Caso A: No existe sesión abierta -> Pantalla de Fondo de Caja que desbloquea la app */
        <CashOpeningScreen />
      ) : (
        /* Caso B: Sí existe sesión abierta -> Entra directo a Ventas */
        <>
          <NavigationTabs activeTab={activeTab} onSelectTab={handleSelectTab} />
          <main className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900">
            {renderActiveView()}
          </main>
        </>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-7 bg-white dark:bg-slate-800 border-t border-lilac-100 dark:border-slate-700 px-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          {lastSale ? (
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                Venta anterior{lastSale.folio ? ` (#${lastSale.folio})` : ''}:
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-semibold text-lilac-700 dark:text-lilac-300 bg-lilac-50 dark:bg-slate-700 border border-lilac-200 dark:border-slate-600 px-2 py-0.5 rounded text-[11px] shrink-0">
                {lastSale.paymentMethod}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                {lastSale.totalItems} {lastSale.totalItems === 1 ? 'producto' : 'productos'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono shrink-0">
                {formatCLP(lastSale.totalAmount)}
              </span>
              {lastSale.change !== undefined && lastSale.change !== null && lastSale.change > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-slate-600 px-2 py-0.5 rounded text-[11px] shrink-0">
                    Vuelto: {formatCLP(lastSale.change)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="font-bold text-slate-600 dark:text-slate-300">Venta anterior:</span>
              <span className="italic">Sin ventas registradas</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
          {currentSession && (
            <span className="text-[11px]">
              Atajos: <span className="font-semibold text-slate-600 dark:text-slate-300">F1</span> Ventas &bull; <span className="font-semibold text-slate-600 dark:text-slate-300">F2</span> Productos &bull; <span className="font-semibold text-slate-600 dark:text-slate-300">F3</span> Inventario &bull; <span className="font-semibold text-slate-600 dark:text-slate-300">F5</span> Corte
            </span>
          )}
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}

export default App
