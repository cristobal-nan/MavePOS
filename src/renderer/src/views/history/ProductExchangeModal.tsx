import React, { useState } from 'react'
import {
  X,
  ArrowLeftRight,
  AlertTriangle,
  Plus,
  Minus,
  PackageCheck
} from 'lucide-react'
import { SaleDetail, ExchangeInfo, ExchangeReturnedItem } from '@shared/types'
import { formatCLP, formatDateTime } from '../../utils/formatters'
import { isExchangePeriodExceeded } from '@shared/finance'
import { useModalStack } from '../../utils/modalStack'

interface ProductExchangeModalProps {
  saleDetail: SaleDetail
  isOpen: boolean
  onClose: () => void
  onConfirmExchange: (exchangeInfo: ExchangeInfo) => void
}

export const ProductExchangeModal: React.FC<ProductExchangeModalProps> = ({
  saleDetail,
  isOpen,
  onClose,
  onConfirmExchange
}) => {
  // Cantidades seleccionadas para devolver por cada product_code
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})

  const { handleBackdropClick } = useModalStack({
    id: 'product-exchange-modal',
    isOpen,
    onClose,
    closeOnBackdrop: true
  })

  if (!isOpen) return null

  const saleDateStr = saleDetail.completed_at || saleDetail.created_at || ''
  const { isExceeded, daysDiff } = isExchangePeriodExceeded(saleDateStr, 30)

  // Filtrar ítems que tienen cantidad disponible para devolver
  const eligibleItems = saleDetail.items.map((item) => {
    const availableQty = Math.max(0, item.quantity - (item.returned_qty || 0))
    const currentSelectedQty = selectedQuantities[item.product_code] || 0
    const subtotal = currentSelectedQty * item.unit_price
    return {
      ...item,
      availableQty,
      selectedQty: currentSelectedQty,
      subtotal
    }
  })

  const totalCredit = eligibleItems.reduce((acc, it) => acc + it.subtotal, 0)
  const totalItemsToReturn = eligibleItems.reduce((acc, it) => acc + it.selectedQty, 0)

  const handleQuantityChange = (code: string, newQty: number, maxQty: number): void => {
    const clamped = Math.max(0, Math.min(newQty, maxQty))
    setSelectedQuantities((prev) => ({
      ...prev,
      [code]: clamped
    }))
  }

  const handleConfirm = (): void => {
    if (totalCredit <= 0 || totalItemsToReturn <= 0) return

    const returnedItems: ExchangeReturnedItem[] = eligibleItems
      .filter((it) => it.selectedQty > 0)
      .map((it) => ({
        product_code: it.product_code,
        name: it.name,
        unit_price: it.unit_price,
        quantity: it.selectedQty
      }))

    const exchangeInfo: ExchangeInfo = {
      originalSaleId: saleDetail.id,
      originalFolio: saleDetail.folio,
      originalDate: saleDateStr,
      returnedItems,
      exchangeCredit: totalCredit
    }

    onConfirmExchange(exchangeInfo)
  }

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-200/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Iniciar Cambio de Producto
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Venta Folio #{saleDetail.folio}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fecha original: {formatDateTime(saleDateStr)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* Advertencia si supera los 30 días */}
          {isExceeded && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Venta realizada hace {daysDiff} días (más de 1 mes)</p>
                <p className="text-amber-700 mt-0.5">
                  El plazo comercial estándar de 30 días para cambios ha expirado. Puedes autorizar y continuar con el cambio según el criterio comercial de la tienda.
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Selecciona los productos y unidades que el cliente devuelve:
            </h4>

            {eligibleItems.every((it) => it.availableQty === 0) ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold">
                  Todos los productos de esta venta ya han sido devueltos previamente.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-center">Disponible</th>
                      <th className="py-2.5 px-3 text-center">Devolver</th>
                      <th className="py-2.5 px-3 text-right">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {eligibleItems.map((item) => (
                      <tr
                        key={item.product_code}
                        className={`transition-colors ${
                          item.selectedQty > 0 ? 'bg-amber-50' : 'hover:bg-slate-100'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.product_code}
                          </p>
                        </td>

                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                          {formatCLP(item.unit_price)}
                        </td>

                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {item.availableQty} un.
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {item.availableQty === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">Agotado</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                              <button
                                type="button"
                                disabled={item.selectedQty <= 0}
                                onClick={() =>
                                  handleQuantityChange(
                                    item.product_code,
                                    item.selectedQty - 1,
                                    item.availableQty
                                  )
                                }
                                className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <span className="w-7 text-center font-black text-slate-900 text-xs">
                                {item.selectedQty}
                              </span>

                              <button
                                type="button"
                                disabled={item.selectedQty >= item.availableQty}
                                onClick={() =>
                                  handleQuantityChange(
                                    item.product_code,
                                    item.selectedQty + 1,
                                    item.availableQty
                                  )
                                }
                                className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {item.subtotal > 0 ? (
                            <span className="text-amber-700">+{formatCLP(item.subtotal)}</span>
                          ) : (
                            <span className="text-slate-400">$ 0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen del Crédito */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Crédito a Favor Generado por el Cambio
                </p>
                <p className="text-[11px] text-slate-500">
                  {totalItemsToReturn} producto(s) a devolver
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-amber-700 block">
                {formatCLP(totalCredit)}
              </span>
              <span className="text-[10px] text-amber-800 font-semibold">
                Para aplicar en nuevos productos
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors border border-slate-200 dark:border-slate-700"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={totalCredit <= 0}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Transferir a Ventas para Cambio</span>
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
