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
  ArrowUpRight,
  ArrowLeftRight,
  CheckCircle2,
  X
} from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { formatCLP, formatDateTime } from '../utils/formatters'
import { calculateCartTotal, calculateExchangeBalance, isExchangePeriodExceeded } from '@shared/finance'
import { useSalesStore } from '../store/salesStore'
import { useCashStore } from '../store/cashStore'
import { ProductSearchModal } from '../components/ProductSearchModal'
import { CheckoutModal } from '../components/CheckoutModal'
import { SalesHistoryModal } from './history/SalesHistoryModal'
import { CashWithdrawalModal } from './history/CashWithdrawalModal'
import { useModalStack } from '../utils/modalStack'

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
    deleteTicket,
    finalizeSale
  } = useSalesStore()

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false)
  const [isConfirmExactModalOpen, setIsConfirmExactModalOpen] = useState(false)
  const [isFinalizingExact, setIsFinalizingExact] = useState(false)

  // Producto seleccionado activamente en el carrito para navegación con flechas y teclas +/-
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null)

  // Mensaje flotante central de alerta de stock
  const [stockAlert, setStockAlert] = useState<{
    visible: boolean
    title: string
    productName?: string
    message?: string
  } | null>(null)
  const stockAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Modal de confirmación para eliminar producto del ticket al reducir a 0
  const [itemToDelete, setItemToDelete] = useState<{
    code: string
    name: string
    variant_label?: string | null
  } | null>(null)

  // Modal de confirmación para descartar ticket o cancelar cambio
  const [ticketToDiscard, setTicketToDiscard] = useState<{
    index: number
    label: string
    itemsCount: number
    exchangeInfo?: {
      originalFolio: number
      exchangeCredit: number
    } | null
  } | null>(null)

  // Mensaje modal informativo de reglas de cambio
  const [exchangeAlert, setExchangeAlert] = useState<string | null>(null)

  // Modal Stack Registrations for priority ESC and backdrop handling
  const { handleBackdropClick: handleBackdropConfirmExact } = useModalStack({
    id: 'sales-confirm-exact-modal',
    isOpen: isConfirmExactModalOpen,
    onClose: () => setIsConfirmExactModalOpen(false),
    closeOnBackdrop: true
  })

  const { handleBackdropClick: handleBackdropItemToDelete } = useModalStack({
    id: 'sales-item-to-delete-modal',
    isOpen: Boolean(itemToDelete),
    onClose: () => {
      setItemToDelete(null)
      barcodeInputRef.current?.focus()
    },
    closeOnBackdrop: true
  })

  const { handleBackdropClick: handleBackdropTicketDiscard } = useModalStack({
    id: 'sales-ticket-discard-modal',
    isOpen: Boolean(ticketToDiscard),
    onClose: () => {
      setTicketToDiscard(null)
      barcodeInputRef.current?.focus()
    },
    closeOnBackdrop: true
  })

  const { handleBackdropClick: handleBackdropExchangeAlert } = useModalStack({
    id: 'sales-exchange-alert-modal',
    isOpen: Boolean(exchangeAlert),
    onClose: () => {
      setExchangeAlert(null)
      barcodeInputRef.current?.focus()
    },
    closeOnBackdrop: true
  })

  const showOutOfStockAlert = (productName?: string): void => {
    if (stockAlertTimeoutRef.current) {
      clearTimeout(stockAlertTimeoutRef.current)
    }
    setStockAlert({
      visible: true,
      title: 'Producto sin stock disponible',
      productName,
      message: 'No quedan unidades disponibles para la venta.'
    })
    stockAlertTimeoutRef.current = setTimeout(() => {
      setStockAlert(null)
    }, 2000)
  }

  const showMaxStockAlert = (productName: string, maxStock: number): void => {
    if (stockAlertTimeoutRef.current) {
      clearTimeout(stockAlertTimeoutRef.current)
    }
    setStockAlert({
      visible: true,
      title: 'Stock máximo alcanzado',
      productName,
      message: `No se puede superar el stock disponible de ${maxStock} unidades.`
    })
    stockAlertTimeoutRef.current = setTimeout(() => {
      setStockAlert(null)
    }, 2200)
  }

  const handleDecreaseQuantity = (it: { product_code: string; name: string; quantity: number; variant_label?: string | null }): void => {
    if (it.quantity <= 1) {
      setItemToDelete({
        code: it.product_code,
        name: it.name,
        variant_label: it.variant_label
      })
    } else {
      updateQuantity(it.product_code, it.quantity - 1)
    }
  }

  useEffect(() => {
    return () => {
      if (stockAlertTimeoutRef.current) {
        clearTimeout(stockAlertTimeoutRef.current)
      }
    }
  }, [])

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
    const focusBarcode = (): void => {
      if (
        !isSearchModalOpen &&
        !isCheckoutModalOpen &&
        !isHistoryModalOpen &&
        !isWithdrawalModalOpen &&
        !isConfirmExactModalOpen &&
        !itemToDelete &&
        !ticketToDiscard &&
        !exchangeAlert
      ) {
        barcodeInputRef.current?.focus()
      }
    }

    focusBarcode()

    window.addEventListener('focus', focusBarcode)
    return () => window.removeEventListener('focus', focusBarcode)
  }, [
    isSearchModalOpen,
    isCheckoutModalOpen,
    isHistoryModalOpen,
    isWithdrawalModalOpen,
    isConfirmExactModalOpen,
    itemToDelete,
    ticketToDiscard,
    exchangeAlert,
    activeTicketIndex
  ])

  const activeTicket = tickets[activeTicketIndex] || { items: [] }
  const { totalAmount, totalItems: totalItemsCount } = calculateCartTotal(activeTicket.items)

  const isExchange = Boolean(activeTicket.exchangeInfo)
  const exchangeInfo = activeTicket.exchangeInfo
  const exchangeBalance = isExchange && exchangeInfo
    ? calculateExchangeBalance(exchangeInfo.exchangeCredit, totalAmount)
    : null
  const periodCheck = isExchange && exchangeInfo
    ? isExchangePeriodExceeded(exchangeInfo.originalDate, 30)
    : { isExceeded: false, daysDiff: 0 }

  // Mantener producto seleccionado en el carrito al cambiar items o tickets
  useEffect(() => {
    if (activeTicket.items.length === 0) {
      setSelectedProductCode(null)
    } else if (!selectedProductCode || !activeTicket.items.some((i) => i.product_code === selectedProductCode)) {
      setSelectedProductCode(activeTicket.items[activeTicket.items.length - 1].product_code)
    }
  }, [activeTicket.items, selectedProductCode])

  const handleFinalizeExactExchange = async (): Promise<void> => {
    if (!currentSession) return
    setIsFinalizingExact(true)
    try {
      await finalizeSale({
        cashSessionId: currentSession.id,
        payments: []
      })
      setIsConfirmExactModalOpen(false)
      barcodeInputRef.current?.focus()
    } catch (err: any) {
      console.error('Error finalizando cambio exacto:', err)
      setExchangeAlert(err.message || 'Error al completar el cambio')
    } finally {
      setIsFinalizingExact(false)
    }
  }

  const handleCobrarClick = (): void => {
    if (activeTicket.items.length === 0) return

    if (isExchange && exchangeBalance && exchangeInfo) {
      if (exchangeBalance.status === 'insufficient') {
        setExchangeAlert(
          `No es posible cobrar: El monto de los nuevos productos (${formatCLP(totalAmount)}) debe ser igual o superior al crédito devuelto (${formatCLP(exchangeInfo.exchangeCredit)}).\n\nFaltan ${formatCLP(exchangeBalance.remainingCredit)} por cubrir (no se entrega dinero en efectivo por saldo sobrante).`
        )
        return
      }
      if (exchangeBalance.status === 'exact') {
        setIsConfirmExactModalOpen(true)
        return
      }
    }

    setIsCheckoutModalOpen(true)
  }

  // Keyboard shortcut listener for Sales screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Escape / Enter for exchange alert modal
      if ((e.key === 'Escape' || e.key === 'Enter') && exchangeAlert) {
        e.preventDefault()
        setExchangeAlert(null)
        barcodeInputRef.current?.focus()
        return
      }

      // Escape / Enter for item removal modal
      if (e.key === 'Escape' && itemToDelete) {
        e.preventDefault()
        setItemToDelete(null)
        barcodeInputRef.current?.focus()
        return
      }

      if (e.key === 'Enter' && itemToDelete) {
        e.preventDefault()
        removeItem(itemToDelete.code)
        setItemToDelete(null)
        barcodeInputRef.current?.focus()
        return
      }

      // Escape / Enter for ticket discard / cancel exchange modal
      if (e.key === 'Escape' && ticketToDiscard) {
        e.preventDefault()
        setTicketToDiscard(null)
        barcodeInputRef.current?.focus()
        return
      }

      if (e.key === 'Enter' && ticketToDiscard) {
        e.preventDefault()
        const idx = ticketToDiscard.index
        setTicketToDiscard(null)
        deleteTicket(idx)
        barcodeInputRef.current?.focus()
        return
      }

      // Escape: close confirm exact modal if open
      if (e.key === 'Escape' && isConfirmExactModalOpen) {
        e.preventDefault()
        setIsConfirmExactModalOpen(false)
        return
      }

      // Enter: confirm exact modal if open
      if (e.key === 'Enter' && isConfirmExactModalOpen && !isFinalizingExact) {
        e.preventDefault()
        handleFinalizeExactExchange()
        return
      }

      const isAnyModalOpen =
        isSearchModalOpen ||
        isCheckoutModalOpen ||
        isHistoryModalOpen ||
        isWithdrawalModalOpen ||
        isConfirmExactModalOpen ||
        Boolean(itemToDelete) ||
        Boolean(ticketToDiscard) ||
        Boolean(exchangeAlert)

      if (!isAnyModalOpen && activeTicket.items.length > 0) {
        // Navegación con flechas arriba y abajo en el carrito
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const currentIndex = activeTicket.items.findIndex((i) => i.product_code === selectedProductCode)
          if (currentIndex > 0) {
            setSelectedProductCode(activeTicket.items[currentIndex - 1].product_code)
          } else if (currentIndex === -1) {
            setSelectedProductCode(activeTicket.items[activeTicket.items.length - 1].product_code)
          }
          return
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          const currentIndex = activeTicket.items.findIndex((i) => i.product_code === selectedProductCode)
          if (currentIndex !== -1 && currentIndex < activeTicket.items.length - 1) {
            setSelectedProductCode(activeTicket.items[currentIndex + 1].product_code)
          } else if (currentIndex === -1) {
            setSelectedProductCode(activeTicket.items[0].product_code)
          }
          return
        }

        // Teclas + y - para sumar o restar en el producto seleccionado (funciona incluso con foco en el input de código)
        const isPlus = e.key === '+' || e.key === 'Add' || (e.key === '=' && e.shiftKey)
        const isMinus = e.key === '-' || e.key === 'Subtract'

        if (isPlus || isMinus) {
          const activeEl = document.activeElement
          const isBarcodeFocused = activeEl === barcodeInputRef.current
          const isBodyOrNonInput = !activeEl || activeEl === document.body || !['INPUT', 'TEXTAREA'].includes(activeEl.tagName)

          if (isBarcodeFocused || isBodyOrNonInput) {
            e.preventDefault()
            e.stopPropagation()
            const targetItem =
              activeTicket.items.find((i) => i.product_code === selectedProductCode) ||
              activeTicket.items[activeTicket.items.length - 1]

            if (targetItem) {
              if (isPlus) {
                if (targetItem.quantity >= targetItem.stock) {
                  showMaxStockAlert(targetItem.name, targetItem.stock)
                } else {
                  updateQuantity(targetItem.product_code, targetItem.quantity + 1)
                }
              } else {
                handleDecreaseQuantity(targetItem)
              }
            }
            return
          }
        }
      }

      // F10: open search modal
      if (e.key === 'F10') {
        e.preventDefault()
        setIsSearchModalOpen(true)
      }
      // F12: checkout
      if (e.key === 'F12') {
        e.preventDefault()
        handleCobrarClick()
      }
      // Ctrl+T: New Ticket
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        if (currentSession?.id) {
          createTicket(currentSession.id)
        } else {
          createTicket()
        }
      }
      // Ctrl+W: Close / Discard current ticket
      if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        const currentTicket = tickets[activeTicketIndex]
        if (currentTicket) {
          if (currentTicket.exchangeInfo || currentTicket.items.length > 0) {
            setTicketToDiscard({
              index: activeTicketIndex,
              label: currentTicket.label,
              itemsCount: currentTicket.items.length,
              exchangeInfo: currentTicket.exchangeInfo || null
            })
            return
          }
          deleteTicket(activeTicketIndex)
          barcodeInputRef.current?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeTicket.items,
    selectedProductCode,
    activeTicketIndex,
    currentSession?.id,
    createTicket,
    deleteTicket,
    isExchange,
    exchangeBalance,
    exchangeInfo,
    totalAmount,
    isConfirmExactModalOpen,
    isFinalizingExact,
    itemToDelete,
    ticketToDiscard,
    exchangeAlert,
    isSearchModalOpen,
    isCheckoutModalOpen,
    isHistoryModalOpen,
    isWithdrawalModalOpen
  ])

  const handleBarcodeSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBarcodeError(null)

    const rawCode = barcodeInput.trim()
    if (!rawCode) return

    try {
      const product = await window.api.getProductByCode(rawCode)
      if (product && product.code) {
        if ((Number(product.stock) || 0) <= 0) {
          showOutOfStockAlert(product.name)
          setBarcodeInput('')
          return
        }
        addItem({
          code: product.code,
          name: product.name,
          sale_price: product.sale_price,
          stock: product.stock,
          variant_label: product.attribute_value || null
        }, 1)
        setSelectedProductCode(product.code)
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
    if ((Number(product.stock) || 0) <= 0) {
      showOutOfStockAlert(product.name)
      barcodeInputRef.current?.focus()
      return
    }
    addItem({
      code: product.code,
      name: product.name,
      sale_price: product.sale_price,
      stock: product.stock,
      variant_label: product.attribute_value || null
    }, 1)
    setSelectedProductCode(product.code)
    barcodeInputRef.current?.focus()
  }

  const handleDeleteTicketByIndex = async (e: React.MouseEvent, index: number): Promise<void> => {
    e.stopPropagation()
    const ticket = tickets[index]
    if (!ticket) return

    if (ticket.exchangeInfo || ticket.items.length > 0) {
      setTicketToDiscard({
        index,
        label: ticket.label,
        itemsCount: ticket.items.length,
        exchangeInfo: ticket.exchangeInfo || null
      })
      return
    }
    await deleteTicket(index)
    barcodeInputRef.current?.focus()
  }

  const handleContainerClick = (e: React.MouseEvent): void => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const isInteractive = target.closest('button, input, select, textarea, [role="button"], a')
    if (!isInteractive) {
      if (
        !isSearchModalOpen &&
        !isCheckoutModalOpen &&
        !isHistoryModalOpen &&
        !isWithdrawalModalOpen &&
        !isConfirmExactModalOpen &&
        !itemToDelete
      ) {
        barcodeInputRef.current?.focus()
      }
    }
  }

  return (
    <div onClick={handleContainerClick} className="flex-1 flex flex-col h-full bg-slate-100 select-none overflow-hidden">
      {/* Top Bar: Barcode Input + Simultaneous Tickets */}
      <div className="bg-white border-b border-lilac-200 px-4 py-2 flex flex-col gap-2 shadow-xs">
        {/* Ticket mini-tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {tickets.map((t, idx) => {
              const isActive = activeTicketIndex === idx
              const hasItems = t.items.length > 0
              const isSavedPending = Boolean(t.id)

              const isExchangeTab = Boolean(t.exchangeInfo)

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
                  className={`h-8 pl-3 pr-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isActive
                      ? isExchangeTab
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/50'
                        : 'bg-lilac-600 text-white shadow-xs'
                      : isExchangeTab
                      ? 'bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 hover:bg-lilac-50 text-slate-600'
                  }`}
                >
                  {isExchangeTab ? (
                    <ArrowLeftRight className="w-3.5 h-3.5 opacity-90 text-amber-200 shrink-0" />
                  ) : (
                    isSavedPending && <Clock className="w-3 h-3 opacity-80" />
                  )}
                  <span>{t.label}</span>
                  {hasItems && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? isExchangeTab
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-lilac-700 text-lilac-100'
                          : isExchangeTab
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
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
                        ? isExchangeTab
                          ? 'text-amber-200 hover:text-white hover:bg-amber-700'
                          : 'text-lilac-200 hover:text-white hover:bg-lilac-700'
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
              onClick={() => createTicket(currentSession?.id)}
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
                setBarcodeInput(e.target.value.replace(/[+\-]/g, '').toUpperCase())
              }}
              onKeyDown={(e) => {
                if (e.key === '+' || e.key === '-' || e.key === 'Add' || e.key === 'Subtract' || (e.key === '=' && e.shiftKey)) {
                  e.preventDefault()
                }
              }}
              placeholder="Escanear código de barras o escribir código y presionar Enter..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 focus:border-lilac-500 focus:bg-white rounded-xl text-sm font-mono text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition-all shadow-inner uppercase"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Agregar (Enter)
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
        {/* Banner de Cambio de Producto */}
        {isExchange && exchangeInfo && (
          <div className="mb-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-2xl p-4 flex flex-col gap-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 font-bold shrink-0">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      CAMBIO DE PRODUCTO — Venta original Folio #{exchangeInfo.originalFolio}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                      Ticket de Cambio
                    </span>
                    {exchangeBalance && exchangeBalance.status === 'insufficient' && activeTicket.items.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Faltan {formatCLP(exchangeBalance.remainingCredit)} por cubrir</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fecha de compra: {formatDateTime(exchangeInfo.originalDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">
                    Crédito a Favor
                  </span>
                  <span className="text-xl font-black text-amber-700">
                    {formatCLP(exchangeInfo.exchangeCredit)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTicketToDiscard({
                      index: activeTicketIndex,
                      label: activeTicket.label,
                      itemsCount: activeTicket.items.length,
                      exchangeInfo: exchangeInfo || null
                    })
                  }}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Cancelar cambio de producto y cerrar este ticket"
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>Cancelar Cambio</span>
                </button>
              </div>
            </div>

            {/* Advertencia si supera los 30 días */}
            {periodCheck.isExceeded && (
              <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Atención:</strong> Esta venta fue emitida hace {periodCheck.daysDiff} días (más de 1 mes). Se permite continuar bajo criterio comercial del vendedor.
                </span>
              </div>
            )}

            {/* Desglose de ítems devueltos */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 text-xs">
              <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Productos devueltos:
              </span>
              {exchangeInfo.returnedItems.map((item) => (
                <span
                  key={item.product_code}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="font-bold text-amber-700">{item.quantity}x</span>
                  <span>{item.name}</span>
                  <span className="text-slate-400">({formatCLP(item.unit_price * item.quantity)})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 bg-white rounded-2xl border border-lilac-100 shadow-sm overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-semibold text-slate-600 border-b border-slate-200">
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
                  const isSelected = selectedProductCode === it.product_code

                  return (
                    <tr
                      key={it.product_code}
                      onClick={() => setSelectedProductCode(it.product_code)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-lilac-100/90 ring-2 ring-lilac-500/80 ring-inset shadow-xs font-medium'
                          : 'hover:bg-slate-50'
                      }`}
                    >
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
                            onClick={() => handleDecreaseQuantity(it)}
                            className="px-2 py-1 text-slate-600 hover:bg-lilac-100 hover:text-lilac-900 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onFocus={(e) => {
                              setSelectedProductCode(it.product_code)
                              e.target.select()
                            }}
                            onClick={(e) => {
                              setSelectedProductCode(it.product_code)
                              ;(e.target as HTMLInputElement).select()
                            }}
                            onChange={(e) => {
                              const rawVal = e.target.value
                              if (rawVal === '') return
                              const v = parseInt(rawVal, 10)
                              if (isNaN(v) || v <= 0) {
                                setItemToDelete({
                                  code: it.product_code,
                                  name: it.name,
                                  variant_label: it.variant_label
                                })
                                return
                              }
                              if ((Number(it.stock) || 0) <= 0) {
                                showOutOfStockAlert(it.name)
                                return
                              }
                              if (v > it.stock) {
                                showMaxStockAlert(it.name, it.stock)
                                updateQuantity(it.product_code, it.stock)
                                return
                              }
                              updateQuantity(it.product_code, v)
                            }}
                            className="w-12 text-center text-xs font-bold bg-white py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if ((Number(it.stock) || 0) <= 0) {
                                showOutOfStockAlert(it.name)
                                return
                              }
                              if (it.quantity >= it.stock) {
                                showMaxStockAlert(it.name, it.stock)
                                return
                              }
                              updateQuantity(it.product_code, it.quantity + 1)
                            }}
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
                          onClick={() => {
                            setItemToDelete({
                              code: it.product_code,
                              name: it.name,
                              variant_label: it.variant_label
                            })
                          }}
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
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-lilac-50 hover:border-lilac-300 text-xs font-bold text-slate-700 hover:text-lilac-700 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <History className="w-4 h-4 text-lilac-600" />
            <span>Historial de Ventas</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWithdrawalModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-850 hover:text-amber-900 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-600" />
            <span>Salida de Dinero</span>
          </button>
        </div>

        {/* Right Totals & Cobrar Button */}
        {isExchange && exchangeInfo && exchangeBalance ? (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Nuevos artículos:</span>
              <div className="text-sm font-bold text-slate-700">{totalItemsCount} unidades</div>
              <div className="text-xs text-slate-500 font-semibold">{formatCLP(totalAmount)}</div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Crédito aplicado:</span>
              <div className="text-sm font-bold text-amber-700">− {formatCLP(exchangeInfo.exchangeCredit)}</div>
            </div>

            {exchangeBalance.status === 'insufficient' ? (
              <div className="text-right">
                <span className="text-xs text-rose-500 font-bold block">Falta por cubrir:</span>
                <span className="text-2xl font-black text-rose-600">
                  {formatCLP(exchangeBalance.remainingCredit)}
                </span>
              </div>
            ) : exchangeBalance.status === 'exact' ? (
              <div className="text-right">
                <span className="text-xs text-emerald-600 font-bold block">Cambio Exacto:</span>
                <span className="text-2xl font-black text-emerald-700">$ 0</span>
              </div>
            ) : (
              <div className="text-right">
                <span className="text-xs text-amber-600 font-bold block">Diferencia a Pagar:</span>
                <span className="text-3xl font-black text-slate-900">
                  {formatCLP(exchangeBalance.differenceToPay)}
                </span>
              </div>
            )}

            {exchangeBalance.status === 'insufficient' ? (
              <button
                type="button"
                onClick={handleCobrarClick}
                disabled={activeTicket.items.length === 0}
                className="px-8 py-3.5 rounded-2xl font-black text-base transition-all shadow-md bg-slate-200 text-slate-500 cursor-not-allowed flex items-center gap-2 active:scale-[0.99] disabled:opacity-50"
                title={`No es posible cobrar: Faltan ${formatCLP(exchangeBalance.remainingCredit)} por cubrir.`}
              >
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Cobrar (Faltan {formatCLP(exchangeBalance.remainingCredit)})</span>
              </button>
            ) : exchangeBalance.status === 'exact' ? (
              <button
                type="button"
                onClick={() => setIsConfirmExactModalOpen(true)}
                disabled={activeTicket.items.length === 0}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none hover:shadow-emerald-500/40 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Cobrar ($ 0) (F12)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(true)}
                disabled={activeTicket.items.length === 0}
                className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-base transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Cobrar Diferencia ({formatCLP(exchangeBalance.differenceToPay)}) (F12)</span>
              </button>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {/* Modals */}
      <ProductSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectProduct={handleSelectFromSearch}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        totalAmount={isExchange && exchangeBalance ? exchangeBalance.differenceToPay : totalAmount}
        onClose={() => setIsCheckoutModalOpen(false)}
        onSuccess={() => {
          setIsCheckoutModalOpen(false)
          barcodeInputRef.current?.focus()
        }}
      />

      <SalesHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false)
          barcodeInputRef.current?.focus()
        }}
      />

      <CashWithdrawalModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => {
          setIsWithdrawalModalOpen(false)
          barcodeInputRef.current?.focus()
        }}
      />

      {/* Modal de Confirmación para Cambio Exacto ($ 0) */}
      {isConfirmExactModalOpen && isExchange && exchangeInfo && (
        <div onClick={handleBackdropConfirmExact} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-3xl shadow-2xl border border-lilac-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs shrink-0">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Confirmar Cambio de Productos?
                </h3>
                <p className="text-xs text-slate-500">
                  Cambio exacto sin saldo restante ni diferencia a pagar
                </p>
              </div>
            </div>

            {/* Contenido / Resumen */}
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Venta original:</span>
                  <span className="font-bold font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Folio #{exchangeInfo.originalFolio}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total crédito devuelto:</span>
                  <span className="font-bold text-amber-700">{formatCLP(exchangeInfo.exchangeCredit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total nuevos artículos ({totalItemsCount} un.):</span>
                  <span className="font-bold text-slate-800">{formatCLP(totalAmount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-black text-sm">
                  <span className="text-emerald-800">Diferencia a Pagar:</span>
                  <span className="text-emerald-700 text-lg">$ 0</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="leading-relaxed">
                  El valor de los nuevos productos es exactamente igual al saldo del cambio.
                  Se repondrá el stock de los productos devueltos y se descontará el nuevo stock sin registrar movimientos de dinero en caja.
                </p>
              </div>
            </div>

            {/* Footer / Botones */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmExactModalOpen(false)}
                disabled={isFinalizingExact}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Volver a la Venta
              </button>
              <button
                type="button"
                onClick={handleFinalizeExactExchange}
                disabled={isFinalizingExact}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isFinalizingExact ? (
                  <span>Procesando cambio...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Cobrar ($ 0)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Producto del Ticket */}
      {itemToDelete && (
        <div onClick={handleBackdropItemToDelete} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-rose-50 via-rose-50/50 to-white border-b border-rose-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Quitar producto del ticket?
                </h3>
                <p className="text-xs text-slate-500">
                  La cantidad a vender llegó a 0
                </p>
              </div>
            </div>

            {/* Contenido / Detalle del Producto */}
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Código:</span>
                  <span className="font-bold font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {itemToDelete.code}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium shrink-0">Producto:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {itemToDelete.name}
                    {itemToDelete.variant_label && (
                      <span className="ml-1.5 text-[10px] text-lilac-700 bg-lilac-50 border border-lilac-200 px-1.5 py-0.5 rounded font-medium">
                        {itemToDelete.variant_label}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Confirmas que deseas eliminar este producto del ticket de venta?
              </p>
            </div>

            {/* Footer / Botones */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setItemToDelete(null)
                  barcodeInputRef.current?.focus()
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar (Esc)
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  removeItem(itemToDelete.code)
                  setItemToDelete(null)
                  barcodeInputRef.current?.focus()
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Quitar (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para descartar ticket / cancelar cambio */}
      {ticketToDiscard && (
        <div onClick={handleBackdropTicketDiscard} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    ticketToDiscard.exchangeInfo
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {ticketToDiscard.exchangeInfo ? (
                    <ArrowLeftRight className="w-5 h-5" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {ticketToDiscard.exchangeInfo
                      ? 'Cancelar Operación de Cambio'
                      : `Descartar ${ticketToDiscard.label}`}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {ticketToDiscard.exchangeInfo
                      ? `Venta original Folio #${ticketToDiscard.exchangeInfo.originalFolio}`
                      : `${ticketToDiscard.itemsCount} producto(s) en este ticket`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTicketToDiscard(null)
                  barcodeInputRef.current?.focus()
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 flex flex-col gap-3">
              {ticketToDiscard.exchangeInfo ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                    <span className="font-bold text-amber-900">
                      ¿Deseas cancelar la operación de cambio de producto?
                    </span>
                    <span className="text-amber-700 text-[11px]">
                      Crédito a favor:{' '}
                      <strong className="font-bold">
                        {formatCLP(ticketToDiscard.exchangeInfo.exchangeCredit)}
                      </strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Al cerrar este ticket se cancelará la operación de cambio y no se procesará la reposición ni salida de inventario.
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                    <span className="font-bold text-rose-900">
                      ¿Deseas descartar el ticket y sus productos?
                    </span>
                    <span className="text-rose-700 text-[11px]">
                      Se perderán los {ticketToDiscard.itemsCount} producto(s) agregados.
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Esta acción descartará el ticket actual y sus productos ingresados.
                  </p>
                </>
              )}
            </div>

            {/* Footer / Botones */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setTicketToDiscard(null)
                  barcodeInputRef.current?.focus()
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {ticketToDiscard.exchangeInfo ? 'Continuar con el cambio (Esc)' : 'Mantener ticket (Esc)'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const idx = ticketToDiscard.index
                  setTicketToDiscard(null)
                  deleteTicket(idx)
                  barcodeInputRef.current?.focus()
                }}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                  ticketToDiscard.exchangeInfo
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                }`}
              >
                {ticketToDiscard.exchangeInfo ? (
                  <>
                    <X className="w-4 h-4" />
                    <span>Sí, Cancelar Cambio (Enter)</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Descartar (Enter)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal informativo de Reglas de Cambio (reemplaza alert nativo) */}
      {exchangeAlert && (
        <div onClick={handleBackdropExchangeAlert} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Cambio no completado
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Regla de cambio de producto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExchangeAlert(null)
                  barcodeInputRef.current?.focus()
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {exchangeAlert}
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setExchangeAlert(null)
                  barcodeInputRef.current?.focus()
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/25 transition-all cursor-pointer"
              >
                Entendido (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de Producto sin stock o stock máximo alcanzado (duración 2.2 segundos al medio de la pantalla) */}
      {stockAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4 select-none animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white border-2 border-rose-500 rounded-3xl shadow-2xl px-8 py-6 flex items-center gap-5 max-w-lg mx-auto ring-8 ring-rose-500/10">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-rose-600 tracking-tight">
                {stockAlert.title}
              </span>
              {stockAlert.productName && (
                <span className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                  {stockAlert.productName}
                </span>
              )}
              {stockAlert.message && (
                <span className="text-xs text-slate-500 mt-0.5">
                  {stockAlert.message}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
