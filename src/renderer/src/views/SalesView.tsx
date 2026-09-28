import React, { useState, useEffect, useRef } from 'react'
import {
  Barcode,
  Search,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  ShoppingCart,
  Minus,
  History,
  ArrowUpRight
} from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { formatCLP } from '../utils/formatters'
import { useSalesStore } from '../store/salesStore'
import { useCashStore } from '../store/cashStore'
import { useUIStore } from '../store/uiStore'
import { useHistoryStore } from '../store/historyStore'
import { ProductSearchModal } from '../components/ProductSearchModal'
import { CheckoutModal } from '../components/CheckoutModal'

export const SalesView: React.FC = () => {
  const { currentSession } = useCashStore()
  const {
    tickets,
    activeTicketIndex,
    loadPendingTickets,
    createTicket,
    selectTicket,
    addItem,
    updateQuantity,
    removeItem,
    deleteTicket
  } = useSalesStore()
  const { setActiveTab } = useUIStore()
  const { setActiveSubTab } = useHistoryStore()

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Load pending tickets on mount
  useEffect(() => {
    if (currentSession?.id) {
      loadPendingTickets(currentSession.id)
    } else {
      loadPendingTickets()
    }
  }, [currentSession?.id, loadPendingTickets])

  // Maintain focus on barcode input for wedge scanner
  useEffect(() => {
    if (!isSearchModalOpen && !isCheckoutModalOpen) {
      barcodeInputRef.current?.focus()
    }
  }, [isSearchModalOpen, isCheckoutModalOpen, activeTicketIndex])

  const activeTicket = tickets[activeTicketIndex] || { items: [] }
  const totalAmount = activeTicket.items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0)
  const totalItemsCount = activeTicket.items.reduce((acc, it) => acc + it.quantity, 0)

  // Keyboard shortcut listener for Sales screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // F10: open search modal
      if (e.key === 'F10') {
        e.preventDefault()
        setIsSearchModalOpen(true)
      }
      // F12: checkout
      if (e.key === 'F12') {
        e.preventDefault()
        if (activeTicket.items.length > 0) {
          setIsCheckoutModalOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTicket.items.length])

  const handleBarcodeSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBarcodeError(null)

    const rawCode = barcodeInput.trim()
    if (!rawCode) return

    try {
      const product = await window.api.getProductByCode(rawCode)
      if (product && product.code) {
        addItem({
          code: product.code,
          name: product.name,
          sale_price: product.sale_price,
          stock: product.stock,
          variant_label: product.attribute_value || null
        }, 1)
        setBarcodeInput('')
      } else {
        setBarcodeError(`Producto con código "${rawCode}" no encontrado`)
      }
    } catch (err: any) {
      console.error('Error buscando código:', err)
      setBarcodeError('Error al consultar código')
    }
  }

  const handleSelectFromSearch = (product: ProductSearchResult): void => {
    if (!product.code) return
    addItem({
      code: product.code,
      name: product.name,
      sale_price: product.sale_price,
      stock: product.stock,
      variant_label: product.attribute_value || null
    }, 1)
    barcodeInputRef.current?.focus()
  }

  const handleDeleteTicketByIndex = async (e: React.MouseEvent, index: number): Promise<void> => {
    e.stopPropagation()
    const ticket = tickets[index]
    if (!ticket) return
    if (ticket.items.length > 0) {
      if (!confirm(`¿Deseas descartar el "${ticket.label}" y sus productos?`)) {
        return
      }
    }
    await deleteTicket(index)
    barcodeInputRef.current?.focus()
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 select-none overflow-hidden">
      {/* Top Bar: Barcode Input + Simultaneous Tickets */}
      <div className="bg-white border-b border-lilac-200 px-4 py-2 flex flex-col gap-2 shadow-xs">
        {/* Ticket mini-tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {tickets.map((t, idx) => {
              const isActive = activeTicketIndex === idx
              const hasItems = t.items.length > 0
              const isSavedPending = Boolean(t.id)

              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectTicket(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      selectTicket(idx)
                    }
                  }}
                  className={`h-8 pl-3 pr-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-lilac-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-lilac-50 text-slate-600'
                  }`}
                >
                  {isSavedPending && <Clock className="w-3 h-3 opacity-80" />}
                  <span>{t.label}</span>
                  {hasItems && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-lilac-700 text-lilac-100' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t.items.reduce((s, it) => s + it.quantity, 0)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTicketByIndex(e, idx)}
                    className={`p-1 rounded-md transition-colors ml-0.5 cursor-pointer ${
                      isActive
                        ? 'text-lilac-200 hover:text-white hover:bg-lilac-700'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                    title={`Descartar / Cerrar ${t.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}

            <button
              onClick={createTicket}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-lilac-100 text-slate-600 hover:text-lilac-800 flex items-center justify-center transition-colors"
              title="Nuevo ticket en blanco"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium hidden sm:block">
            Atajos: <span className="font-semibold text-slate-600">F10</span> Buscar &bull; <span className="font-semibold text-slate-600">F12</span> Cobrar
          </div>
        </div>

        {/* Barcode scanner input + Search button */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeError(null)
                setBarcodeInput(e.target.value)
              }}
              placeholder="Escanear código de barras o escribir código y presionar Enter..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 focus:border-lilac-500 focus:bg-white rounded-xl text-sm font-mono text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Agregar
          </button>

          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="px-4 py-2 bg-lilac-100 hover:bg-lilac-200 text-lilac-800 border border-lilac-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar (F10)</span>
          </button>
        </form>

        {barcodeError && (
          <div className="text-xs text-rose-600 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{barcodeError}</span>
          </div>
        )}
      </div>

      {/* Main Cart Table */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col">
        <div className="flex-1 bg-white rounded-2xl border border-lilac-100 shadow-sm overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/90 sticky top-0 z-10 text-xs font-semibold text-slate-600 border-b border-slate-200 backdrop-blur-sm">
              <tr>
                <th className="py-2.5 px-3 w-32">Código</th>
                <th className="py-2.5 px-3">Producto / Descripción</th>
                <th className="py-2.5 px-3 text-right w-28">P. Unitario</th>
                <th className="py-2.5 px-3 text-center w-36">Cantidad</th>
                <th className="py-2.5 px-3 text-right w-32">Importe</th>
                <th className="py-2.5 px-3 text-right w-32">Existencia Restante</th>
                <th className="py-2.5 px-3 text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {activeTicket.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-lilac-50 text-lilac-400 flex items-center justify-center mb-2">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-slate-600">Ticket vacío</p>
                      <p className="text-xs text-slate-400">Escanea un código de barras o presiona F10 para buscar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                activeTicket.items.map((it) => {
                  const importe = it.unit_price * it.quantity
                  // Existencia = stock actual - cantidad en venta
                  const remainingStock = it.stock - it.quantity
                  const isStockCritical = remainingStock < 0

                  return (
                    <tr key={it.product_code} className="hover:bg-slate-50 transition-colors">
                      {/* Código */}
                      <td className="py-3 px-3 font-mono text-slate-600">{it.product_code}</td>

                      {/* Nombre & Variante */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800">{it.name}</span>
                        {it.variant_label && (
                          <span className="ml-2 text-[11px] text-lilac-700 bg-lilac-50 border border-lilac-200 px-1.5 py-0.5 rounded font-medium">
                            {it.variant_label}
                          </span>
                        )}
                      </td>

                      {/* Precio Unitario */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatCLP(it.unit_price)}
                      </td>

                      {/* Cantidad con controles + y - */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.product_code, it.quantity - 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-lilac-100 hover:text-lilac-900 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10)
                              if (!isNaN(v) && v > 0) {
                                updateQuantity(it.product_code, v)
                              }
                            }}
                            className="w-12 text-center text-xs font-bold bg-white py-1 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.product_code, it.quantity + 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-lilac-100 hover:text-lilac-900 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Importe */}
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {formatCLP(importe)}
                      </td>

                      {/* Existencia Restante */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-semibold ${
                            isStockCritical
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md'
                              : remainingStock <= 5
                              ? 'text-amber-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {remainingStock} un.
                        </span>
                      </td>

                      {/* Eliminar fila */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(it.product_code)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Footer Bar: Totals & Action Buttons */}
      <div className="bg-white border-t border-lilac-200 px-6 py-3 flex items-center justify-between shadow-lg">
        {/* Left Side Buttons & Hint */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('sales')
              setActiveTab('historial')
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-lilac-50 hover:border-lilac-300 text-xs font-bold text-slate-700 hover:text-lilac-700 flex items-center gap-2 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-lilac-600" />
            <span>Historial de Ventas (F4)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('cash_movements')
              setActiveTab('historial')
            }}
            className="px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-850 hover:text-amber-900 flex items-center gap-2 transition-all shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
            <span>Salida de Dinero</span>
          </button>

          <span className="hidden xl:inline text-xs text-slate-400 font-medium ml-2">
            Ticket nuevo: <strong className="text-slate-600 font-bold">+</strong> superior
          </span>
        </div>

        {/* Right Totals & Cobrar Button */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium">Artículos en ticket:</span>
            <div className="text-sm font-bold text-slate-700">{totalItemsCount} unidades</div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium">Total a Pagar:</span>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {formatCLP(totalAmount)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={activeTicket.items.length === 0}
            className="px-8 py-3.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-lilac-500/30 flex items-center gap-2 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none hover:shadow-lilac-500/40 cursor-pointer disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Cobrar (F12)</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ProductSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectProduct={handleSelectFromSearch}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        totalAmount={totalAmount}
        onClose={() => setIsCheckoutModalOpen(false)}
        onSuccess={() => {
          setIsCheckoutModalOpen(false)
          barcodeInputRef.current?.focus()
        }}
      />
    </div>
  )
}
