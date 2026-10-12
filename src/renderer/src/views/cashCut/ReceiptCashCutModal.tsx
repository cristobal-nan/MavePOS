import React, { useState } from 'react'
import { CheckCircle2, Printer, Power, Loader2 } from 'lucide-react'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { useModalStack } from '../../utils/modalStack'

interface ReceiptCashCutModalProps {
  isOpen: boolean
  data: any | null
  onClose: () => void
  onExitApp?: () => void
}

export const ReceiptCashCutModal: React.FC<ReceiptCashCutModalProps> = ({
  isOpen,
  data,
  onClose,
  onExitApp
}) => {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printSuccess, setPrintSuccess] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const { handleBackdropClick } = useModalStack({
    id: 'receipt-cash-cut-modal',
    isOpen: isOpen && !!data,
    onClose,
    closeOnBackdrop: true
  })

  const handlePrint = async (): Promise<void> => {
    if (!data || isPrinting) return
    setIsPrinting(true)
    setPrintError(null)
    try {
      const res = await window.api.devices.printCashCut(data)
      if (res && res.success) {
        setPrintSuccess(true)
        setTimeout(() => setPrintSuccess(false), 3000)
      } else {
        setPrintError(res?.error || 'No se pudo imprimir el comprobante.')
        setTimeout(() => setPrintError(null), 4000)
      }
    } catch (err: any) {
      console.error('Error al imprimir corte de caja:', err)
      setPrintError(err.message || 'Error de comunicación con la impresora.')
      setTimeout(() => setPrintError(null), 4000)
    } finally {
      setIsPrinting(false)
    }
  }

  if (!isOpen || !data) return null

  return (
    <div onClick={handleBackdropClick} className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            ¡Corte de Caja Realizado con Éxito!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sesión #{data.sessionId} cerrada el {formatDateTime(data.closedAt)}
          </p>
        </div>

        {/* Recibo Formateado (Protegido como papel blanco físico) */}
        {(() => {
          const salesCash = data.salesCash ?? 0
          const salesCard = data.salesCard ?? 0
          const salesTransfer = data.salesTransfer ?? 0

          const hasCashSales = salesCash > 0
          const hasCardSales = salesCard > 0
          const hasTransferSales = salesTransfer > 0

          const diffCash =
            data.difference !== null && data.difference !== undefined
              ? data.difference
              : data.closingCash !== null &&
                  data.closingCash !== undefined &&
                  data.expectedCash !== null &&
                  data.expectedCash !== undefined
                ? data.closingCash - data.expectedCash
                : 0

          const diffCard =
            data.cardDifference !== null && data.cardDifference !== undefined
              ? data.cardDifference
              : data.cardMachineAmount !== null && data.cardMachineAmount !== undefined
                ? data.cardMachineAmount - salesCard
                : 0

          const diffTransfer =
            data.transferDifference !== null && data.transferDifference !== undefined
              ? data.transferDifference
              : data.transferVerifiedAmount !== null && data.transferVerifiedAmount !== undefined
                ? data.transferVerifiedAmount - salesTransfer
                : 0

          const formatDiff = (diff: number, hasSales: boolean): string => {
            if (diff === 0) return hasSales ? '$ 0' : '-'
            const formattedAbs = Math.abs(Math.round(diff)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            return diff > 0 ? `+$ ${formattedAbs}` : `-$ ${formattedAbs}`
          }

          return (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 font-mono text-xs flex flex-col gap-2 text-slate-800 thermal-ticket-paper shadow-sm">
              <div className="flex justify-between">
                <span>Fondo Inicial:</span>
                <span className="font-bold">{formatCLP(data.openingFund)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ventas Efectivo:</span>
                <span className="font-bold">{formatCLP(salesCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ventas Tarjeta:</span>
                <span className="font-bold">{formatCLP(salesCard)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ventas Transferencia:</span>
                <span className="font-bold">{formatCLP(salesTransfer)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                <span>Total Ventas:</span>
                <span>{formatCLP(data.salesTotal)}</span>
              </div>
              {data.returnsTotal ? (
                <div className="flex justify-between">
                  <span>Devoluciones:</span>
                  <span>{formatCLP(Math.abs(data.returnsTotal))}</span>
                </div>
              ) : null}
              {data.withdrawalsTotal ? (
                <div className="flex justify-between">
                  <span>Salidas de Dinero:</span>
                  <span>{formatCLP(Math.abs(data.withdrawalsTotal))}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-black border-t-2 border-dashed border-slate-300 pt-2 text-sm">
                <span>Efectivo Contado:</span>
                <span>{formatCLP(data.closingCash)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Efectivo Esperado:</span>
                <span>{formatCLP(data.expectedCash)}</span>
              </div>

              <div className="border-t border-slate-200 pt-1.5 flex flex-col gap-1">
                <div className="flex justify-between font-bold">
                  <span>Diferencia Efectivo:</span>
                  <span>{formatDiff(diffCash, hasCashSales)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Diferencia Débito:</span>
                  <span>{formatDiff(diffCard, hasCardSales)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Diferencia Transferencia:</span>
                  <span>{formatDiff(diffTransfer, hasTransferSales)}</span>
                </div>
              </div>

              {data.withdrawalAmount !== undefined && data.withdrawalAmount !== null && (
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                  <span>Monto Retirado:</span>
                  <span>{formatCLP(data.withdrawalAmount)}</span>
                </div>
              )}
              {data.nextOpeningFund !== undefined && data.nextOpeningFund !== null && (
                <div className="flex justify-between font-bold">
                  <span>Fondo Siguiente Turno:</span>
                  <span>{formatCLP(data.nextOpeningFund)}</span>
                </div>
              )}
              {data.notes && (
                <div className="mt-2 text-[11px] font-sans text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                  <strong>Notas:</strong> {data.notes}
                </div>
              )}
            </div>
          )
        })()}

        {/* Notificación de error si la impresora falla */}
        {printError && (
          <div className="text-center text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 py-1.5 px-3 rounded-xl animate-in fade-in">
            {printError}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
              printSuccess
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
            title="Imprimir comprobante en la impresora térmica configurada"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : printSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>{isPrinting ? 'Imprimiendo...' : printSuccess ? '¡Impreso!' : 'Imprimir Comprobante'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Nuevo Turno
            </button>

            {onExitApp && (
              <button
                type="button"
                onClick={onExitApp}
                className="px-5 py-2.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Cerrar POS y Salir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
