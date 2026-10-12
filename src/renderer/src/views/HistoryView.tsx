import React, { useState, useEffect, useMemo } from 'react'
import { FileText, ArrowUpRight, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { useCashStore } from '../store/cashStore'
import { ViewHeader } from '../components/common/ViewHeader'
import { SubTabs, SubTabItem } from '../components/common/SubTabs'
import { SalesHistoryTab } from './history/SalesHistoryTab'
import { CashWithdrawalsTab } from './history/CashWithdrawalsTab'
import { SaleDetailModal } from './history/SaleDetailModal'
import { CancelSaleModal } from './history/CancelSaleModal'

type HistorySubTab = 'sales' | 'cash_movements'

export const HistoryView: React.FC = () => {
  const {
    activeSubTab,
    setActiveSubTab,
    sales,
    cashMovements,
    fetchSalesHistory,
    fetchCashMovements,
    closeSaleDetail,
    error,
    clearError
  } = useHistoryStore()

  const { currentSession } = useCashStore()

  const [saleToCancel, setSaleToCancel] = useState<{ id: number; folio: number; total: number } | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  useEffect(() => {
    fetchSalesHistory()
  }, [])

  useEffect(() => {
    if (currentSession?.id) {
      fetchCashMovements(currentSession.id)
    }
  }, [currentSession?.id])

  const subTabItems: SubTabItem<HistorySubTab>[] = useMemo(() => [
    {
      id: 'sales',
      label: 'Ventas y Devoluciones',
      icon: FileText,
      badge: sales.length
    },
    {
      id: 'cash_movements',
      label: 'Salidas de Dinero',
      icon: ArrowUpRight,
      badge: cashMovements.length > 0 ? cashMovements.length : undefined
    }
  ], [sales.length, cashMovements.length])

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      {/* ViewHeader Canónico */}
      <ViewHeader
        title="Historial de Ventas"
        icon={FileText}
        badge={
          sales.length > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-lilac-50 dark:bg-slate-800 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-slate-700 tabular-nums">
              {sales.length} transacciones
            </span>
          ) : undefined
        }
        primaryAction={
          error ? (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-lg text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                aria-label="Cerrar notificación de error"
                className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : undefined
        }
      />

      {/* SubTabs Canónicas */}
      <div className="px-6 py-2 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800">
        <SubTabs
          tabs={subTabItems}
          activeTab={activeSubTab}
          onChange={(tab) => setActiveSubTab(tab)}
          ariaLabel="Secciones del historial"
        />
      </div>

      {/* Success Toast / Banner sin alterar dimensiones */}
      {successBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-6 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Subtab Content */}
      {activeSubTab === 'sales' ? (
        <SalesHistoryTab
          onOpenCancelModal={(id, folio, total) => setSaleToCancel({ id, folio, total })}
        />
      ) : (
        <CashWithdrawalsTab />
      )}

      {/* Detail Modal */}
      <SaleDetailModal
        onOpenCancelModal={(id, folio, total) => setSaleToCancel({ id, folio, total })}
        onClose={closeSaleDetail}
      />

      {/* Cancel Confirmation Modal */}
      <CancelSaleModal
        sale={saleToCancel}
        onClose={() => setSaleToCancel(null)}
        onSuccess={(folio) => {
          setSuccessBanner(`Venta Folio #${folio} anulada correctamente. Stock repuesto.`)
          setTimeout(() => setSuccessBanner(null), 5000)
        }}
      />
    </div>
  )
}
