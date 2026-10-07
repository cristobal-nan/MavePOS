import React, { useState, useEffect } from 'react'
import { FileText, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useHistoryStore } from '../../store/historyStore'
import { SalesHistoryTab } from './SalesHistoryTab'
import { SaleDetailModal } from './SaleDetailModal'
import { CancelSaleModal } from './CancelSaleModal'
import { useModalStack } from '../../utils/modalStack'

interface SalesHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({ isOpen, onClose }) => {
  const {
    sales,
    fetchSalesHistory,
    closeSaleDetail,
    error,
    clearError
  } = useHistoryStore()

  const [saleToCancel, setSaleToCancel] = useState<{ id: number; folio: number; total: number } | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  const { handleBackdropClick } = useModalStack({
    id: 'sales-history-modal',
    isOpen,
    onClose,
    closeOnBackdrop: true
  })

  useEffect(() => {
    if (isOpen) {
      fetchSalesHistory()
    }
  }, [isOpen, fetchSalesHistory])

  if (!isOpen) return null

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 select-none"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header del Modal */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-slate-800 text-lilac-700 dark:text-lilac-400 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Historial de Ventas y Devoluciones
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-lilac-100 text-lilac-800 border border-lilac-200">
                  {sales.length} ventas registradas
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Consulta de ventas históricas, reimpresión de comprobantes, devoluciones y cambios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-rose-500 hover:text-rose-800 ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar Historial (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal: Tabla y Filtros */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/60 dark:bg-slate-950">
          <SalesHistoryTab
            onOpenCancelModal={(id, folio, total) => setSaleToCancel({ id, folio, total })}
          />
        </div>

        {/* Modal de Detalle de Venta */}
        <SaleDetailModal
          onOpenCancelModal={(id, folio, total) => setSaleToCancel({ id, folio, total })}
          onClose={closeSaleDetail}
          onExchangeConfirmed={onClose}
        />

        {/* Modal de Cancelación de Venta */}
        <CancelSaleModal
          sale={saleToCancel}
          onClose={() => setSaleToCancel(null)}
          onSuccess={(folio) => {
            setSuccessBanner(`Venta Folio #${folio} anulada correctamente. Stock repuesto.`)
            setTimeout(() => setSuccessBanner(null), 5000)
          }}
        />

        {/* Toast Flotante de Éxito (Bottom-Right, sin Layout Shift) */}
        {successBanner && (
          <div className="absolute bottom-4 right-4 z-50 bg-white border border-emerald-300 text-emerald-950 p-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{successBanner}</span>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-slate-400 hover:text-slate-600 ml-2 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
