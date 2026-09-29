import React, { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { NavigationTabs, TabId } from './components/NavigationTabs'
import { useUIStore } from './store/uiStore'
import { useCashStore } from './store/cashStore'
import { useCatalogStore } from './store/catalogStore'
import { SalesView } from './views/SalesView'
import { CatalogView } from './views/CatalogView'
import { InventoryView } from './views/InventoryView'
import { CashCutView } from './views/CashCutView'
import { ReportsView } from './views/ReportsView'
import { SettingsView } from './views/SettingsView'
import { CloseConfirmModal } from './components/CloseConfirmModal'
import { CashOpeningScreen } from './components/CashOpeningScreen'
import { formatCLP } from './utils/formatters'
import { WifiOff, Database, Store, Loader2, DollarSign } from 'lucide-react'

export const App: React.FC = () => {
  const { activeTab, setActiveTab } = useUIStore()
  const { currentSession, isLoading, checkCurrentSession } = useCashStore()

  // Limpiar búsqueda de productos al cambiar de pestaña
  useEffect(() => {
    useCatalogStore.getState().setSearchQuery('')
  }, [activeTab])

  // Check active cash session on app startup
  useEffect(() => {
    checkCurrentSession()
  }, [checkCurrentSession])

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
        setActiveTab(shortcuts[e.key])
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100">
      {/* Frameless Custom TitleBar */}
      <TitleBar />

      {/* Close and Backup Confirmation Modal */}
      <CloseConfirmModal />

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-14 h-14 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <Store className="w-7 h-7" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
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
          <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />
          <main className="flex-1 flex overflow-hidden bg-slate-50">
            {renderActiveView()}
          </main>
        </>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-7 bg-white border-t border-lilac-100 px-3 flex items-center justify-between text-xs text-slate-500 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sistema Operativo</span>
          </div>

          {currentSession && (
            <div className="flex items-center gap-1 text-lilac-700 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded font-medium">
              <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
              <span>Turno #{currentSession.id}</span>
              <span className="text-lilac-300">|</span>
              <span>Fondo: {formatCLP(currentSession.opening_fund)}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-slate-400">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Modo 100% Offline</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Database className="w-3.5 h-3.5" />
            <span>SQLite Local</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400">
          {currentSession && (
            <span className="text-[11px]">
              Atajos: <span className="font-semibold text-slate-600">F1</span> Ventas &bull; <span className="font-semibold text-slate-600">F2</span> Catálogo &bull; <span className="font-semibold text-slate-600">F3</span> Inventario &bull; <span className="font-semibold text-slate-600">F5</span> Corte
            </span>
          )}
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}

export default App
