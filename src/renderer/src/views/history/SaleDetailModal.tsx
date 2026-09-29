import React, { useState } from 'react'
import {
  X,
  Printer,
  FileText,
  CornerDownLeft,
  XCircle,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Check
} from 'lucide-react'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { useHistoryStore } from '../../store/historyStore'
import { useSalesStore } from '../../store/salesStore'
import { useCashStore } from '../../store/cashStore'
import { useUIStore } from '../../store/uiStore'
import { ProductExchangeModal } from './ProductExchangeModal'
import { ExchangeInfo } from '@shared/types'

interface SaleDetailModalProps {
  onOpenCancelModal: (id: number, folio: number, total: number) => void
  onClose: () => void
  onExchangeConfirmed?: () => void
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  onOpenCancelModal,
  onClose,
  onExchangeConfirmed
}) => {
  const { selectedSaleDetail, returnSaleItem, openSaleDetail } = useHistoryStore()
  const { createExchangeTicket } = useSalesStore()
  const { currentSession } = useCashStore()
  const { setActiveTab } = useUIStore()

  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
  const [returningItemCode, setReturningItemCode] = useState<string | null>(null)
  const [returnQuantity, setReturnQuantity] = useState(1)
  const [isReturning, setIsReturning] = useState(false)

  const [isPrintingThermal, setIsPrintingThermal] = useState(false)
  const [isPrintingNormal, setIsPrintingNormal] = useState(false)
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!selectedSaleDetail) return null

  const handleConfirmExchange = async (exchangeInfo: ExchangeInfo): Promise<void> => {
    await createExchangeTicket(exchangeInfo, currentSession?.id)
    setIsExchangeModalOpen(false)
    onClose()
    setActiveTab('ventas')
    onExchangeConfirmed?.()
  }

  const handleConfirmReturnItem = async (productCode: string): Promise<void> => {
    setIsReturning(true)
    const success = await returnSaleItem(
      selectedSaleDetail.id,
      productCode,
      returnQuantity
    )
    setIsReturning(false)
    if (success) {
      setReturningItemCode(null)
      setReturnQuantity(1)
    }
  }

  const handlePrintThermal = async (): Promise<void> => {
    setIsPrintingThermal(true)
    setPrintFeedback(null)
    try {
      const res = await window.api.printThermalReceipt(selectedSaleDetail, 0)
      if (res.success) {
        setPrintFeedback({ type: 'success', text: '¡Ticket térmico enviado a la impresora!' })
      } else {
        setPrintFeedback({ type: 'error', text: res.error || 'Error al imprimir ticket.' })
      }
    } catch (err: any) {
      setPrintFeedback({ type: 'error', text: err.message || 'Error al imprimir ticket térmico.' })
    } finally {
      setIsPrintingThermal(false)
    }
  }

  const handlePrintNormal = async (): Promise<void> => {
    setIsPrintingNormal(true)
    setPrintFeedback(null)
    try {
      const res = await window.api.printNormalReceipt(selectedSaleDetail)
      if (res.success) {
        setPrintFeedback({ type: 'success', text: '¡Comprobante enviado a la impresora de Windows!' })
      } else {
        setPrintFeedback({ type: 'error', text: res.error || 'Error al imprimir comprobante.' })
      }
    } catch (err: any) {
      setPrintFeedback({ type: 'error', text: err.message || 'Error al imprimir comprobante.' })
    } finally {
      setIsPrintingNormal(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header del Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-black">
              #{selectedSaleDetail.folio}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Venta Folio #{selectedSaleDetail.folio}
                </h3>
                <span className="text-xs font-semibold text-lilac-700 bg-lilac-50 px-2.5 py-0.5 rounded-full border border-lilac-200">
                  Ticket #{selectedSaleDetail.ticket_number ?? 0}
                </span>
                {selectedSaleDetail.status === 'cancelled' ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    Cancelada
                  </span>
                ) : selectedSaleDetail.returned_items_count > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    Devolución Parcial
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Completada
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Registrada el {formatDateTime(selectedSaleDetail.created_at)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Banner si proviene de un cambio de producto (Folio Padre) */}
          {selectedSaleDetail.exchange_parent_id && selectedSaleDetail.exchange_parent_folio && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Venta originada por Cambio de Producto
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                      Folio Padre #{selectedSaleDetail.exchange_parent_folio}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Esta venta se generó a partir de productos devueltos en la Venta Folio #{selectedSaleDetail.exchange_parent_folio}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openSaleDetail(selectedSaleDetail.exchange_parent_id!)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                title={`Ver detalle completo de la venta origen (Folio #${selectedSaleDetail.exchange_parent_folio})`}
              >
                <span>Ver Folio Padre #{selectedSaleDetail.exchange_parent_folio}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Banner si esta venta originó un cambio posterior */}
          {selectedSaleDetail.child_exchanges && selectedSaleDetail.child_exchanges.length > 0 && (
            <div className="flex flex-col gap-2">
              {selectedSaleDetail.child_exchanges.map((child) => (
                <div
                  key={child.id}
                  className="p-3.5 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Esta venta generó un Cambio de Producto
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-200 text-lilac-900 border border-lilac-300">
                          Nueva Venta Folio #{child.folio}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Los productos devueltos de esta transacción se aplicaron en la Venta Folio #{child.folio}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSaleDetail(child.id)}
                    className="px-3.5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                    title={`Ver detalle de la venta generada por el cambio (Folio #${child.folio})`}
                  >
                    <span>Ver Venta de Cambio #{child.folio}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Desglose de Pagos y Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 block">Total de la Venta</span>
              <span className="text-xl font-black text-slate-900">
                {formatCLP(selectedSaleDetail.total)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Formas de Pago Registradas
              </span>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {selectedSaleDetail.payments.map((p) => {
                  const label =
                    p.method === 'cash'
                      ? 'Efectivo'
                      : p.method === 'card'
                      ? 'Tarjeta'
                      : 'Transferencia'
                  return (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700"
                    >
                      {label}: {formatCLP(p.amount)}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-500 block">
                Estado de Unidades
              </span>
              <span className="text-sm font-bold text-slate-800 mt-1 block">
                {selectedSaleDetail.total_items} un. vendidas
                {selectedSaleDetail.returned_items_count > 0 && (
                  <span className="text-rose-600 ml-1.5 font-semibold">
                    ({selectedSaleDetail.returned_items_count} devueltas)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Tabla de Productos de la Venta */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Productos en esta Venta
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-28">Código</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-right w-24">P. Unitario</th>
                    <th className="py-2.5 px-3 text-center w-24">Vendidos</th>
                    <th className="py-2.5 px-3 text-center w-24">Devueltos</th>
                    <th className="py-2.5 px-3 text-right w-28">Importe</th>
                    <th className="py-2.5 px-3 text-right w-24">Stock Actual</th>
                    <th className="py-2.5 px-3 text-center w-40">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedSaleDetail.items.map((it) => {
                    const availableToReturn = it.quantity - it.returned_qty
                    const isFullyReturned = availableToReturn <= 0
                    const isRowReturning = returningItemCode === it.product_code

                    return (
                      <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-600">
                          {it.product_code}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{it.name}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatCLP(it.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {it.returned_qty > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                              {it.returned_qty} un.
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatCLP(it.unit_price * it.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-600">
                          {it.current_stock ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {selectedSaleDetail.status === 'cancelled' || isFullyReturned ? (
                            <span className="text-[11px] font-semibold text-slate-400 italic">
                              {isFullyReturned ? 'Devuelto 100%' : 'Venta cancelada'}
                            </span>
                          ) : isRowReturning ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => setReturnQuantity((prev) => Math.max(1, prev - 1))}
                                  disabled={returnQuantity <= 1}
                                  className="w-5 h-6 text-slate-600 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={availableToReturn}
                                  value={returnQuantity}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10)
                                    if (!isNaN(v)) {
                                      setReturnQuantity(Math.min(availableToReturn, Math.max(1, v)))
                                    }
                                  }}
                                  className="w-8 text-center text-xs font-bold py-0.5 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setReturnQuantity((prev) => Math.min(availableToReturn, prev + 1))}
                                  disabled={returnQuantity >= availableToReturn}
                                  className="w-5 h-6 text-slate-600 hover:bg-slate-100 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleConfirmReturnItem(it.product_code)}
                                disabled={isReturning}
                                title="Confirmar devolución"
                                className="w-6 h-6 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setReturningItemCode(null)}
                                title="Cancelar"
                                className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReturningItemCode(it.product_code)
                                setReturnQuantity(1)
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CornerDownLeft className="w-3 h-3" />
                              <span>Devolver</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
          {printFeedback && (
            <div
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                printFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {printFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{printFeedback.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedSaleDetail.status !== 'cancelled' && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsExchangeModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Cambiar Productos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenCancelModal(
                        selectedSaleDetail.id,
                        selectedSaleDetail.folio,
                        selectedSaleDetail.total
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancelar Venta</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handlePrintThermal}
                disabled={isPrintingThermal}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-lilac-600" />
                <span>{isPrintingThermal ? 'Imprimiendo...' : 'Ticket Térmico'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintNormal}
                disabled={isPrintingNormal}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-lilac-600" />
                <span>{isPrintingNormal ? 'Imprimiendo...' : 'Comprobante Normal'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Selección de Cambio de Producto */}
      <ProductExchangeModal
        saleDetail={selectedSaleDetail}
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        onConfirmExchange={handleConfirmExchange}
      />
    </div>
  )
}
