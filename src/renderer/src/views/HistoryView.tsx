import React, { useState, useEffect } from 'react'
import { FileText, ArrowUpRight, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useHistoryStore } from '../store/historyStore'
import { useCashStore } from '../store/cashStore'
import { SalesHistoryTab } from './history/SalesHistoryTab'
import { CashWithdrawalsTab } from './history/CashWithdrawalsTab'
import { SaleDetailModal } from './history/SaleDetailModal'
import { CancelSaleModal } from './history/CancelSaleModal'

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

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Subtabs Bar */}
      <div className="bg-white border-b border-lilac-200 px-6 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('sales')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'sales'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Ventas y Devoluciones</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === 'sales' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {sales.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cash_movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'cash_movements'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Salidas de Dinero</span>
            {cashMovements.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeSubTab === 'cash_movements'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {cashMovements.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-rose-500 hover:text-rose-800 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-900"
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
