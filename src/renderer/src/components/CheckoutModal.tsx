import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  CreditCard,
  Banknote,
  SendHorizontal,
  CheckCircle,
  AlertCircle,
  Coins,
  Receipt,
  ArrowRight,
  Printer,
  FileText,
  Archive,
  Loader2
} from 'lucide-react'
import clsx from 'clsx'
import { PaymentMethod, CompletedSaleResult } from '@shared/types'
import { formatCLP, parseCLP } from '../utils/formatters'
import { calculatePaymentChange } from '@shared/finance'
import { useSalesStore } from '../store/salesStore'
import { useCashStore } from '../store/cashStore'
import { useModalStack } from '../utils/modalStack'

interface CheckoutModalProps {
  isOpen: boolean
  totalAmount: number
  onClose: () => void
  onSuccess: (result: CompletedSaleResult) => void
}

type TabMethod = 'cash' | 'card' | 'transfer' | 'mixed'

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  totalAmount,
  onClose,
  onSuccess
}) => {
  const { currentSession } = useCashStore()
  const { finalizeSale } = useSalesStore()

  const { handleBackdropClick } = useModalStack({
    id: 'sales-checkout-modal',
    isOpen,
    onClose,
    closeOnBackdrop: true
  })

  const [activeMethod, setActiveMethod] = useState<TabMethod>('cash')
  const [cashGiven, setCashGiven] = useState<string>('')
  const [mixedCash, setMixedCash] = useState<string>('')
  const [mixedCard, setMixedCard] = useState<string>('')
  const [mixedTransfer, setMixedTransfer] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedResult, setCompletedResult] = useState<CompletedSaleResult | null>(null)
  const [isPrintingThermal, setIsPrintingThermal] = useState(false)
  const [isPrintingNormal, setIsPrintingNormal] = useState(false)
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false)
  const [printStatusMsg, setPrintStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const cashInputRef = useRef<HTMLInputElement>(null)
  const METHODS: TabMethod[] = ['cash', 'card', 'transfer', 'mixed']

  useEffect(() => {
    if (isOpen) {
      setActiveMethod('cash')
      setCashGiven(totalAmount.toLocaleString('es-CL'))
      setMixedCash('')
      setMixedCard('')
      setMixedTransfer('')
      setError(null)
      setCompletedResult(null)
      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 50)
    }
  }, [isOpen, totalAmount])

  const parsedCashGiven = parseCLP(cashGiven)
  const { change: cashChange } = calculatePaymentChange(totalAmount, parsedCashGiven)

  // Quick cash bill shortcuts
  const commonBills = [
    { label: 'Exacto', amount: totalAmount },
    { label: '$ 5.000', amount: 5000 },
    { label: '$ 10.000', amount: 10000 },
    { label: '$ 20.000', amount: 20000 }
  ].filter((b) => b.amount >= totalAmount)

  const handleSelectQuickBill = (amount: number): void => {
    setCashGiven(amount.toLocaleString('es-CL'))
    cashInputRef.current?.focus()
  }

  const handleConfirmPayment = async (printReceipt: boolean = true): Promise<void> => {
    if (isSubmitting) return
    setError(null)

    if (!currentSession) {
      setError('No hay una sesión de caja activa abierta.')
      return
    }

    const payments: { method: PaymentMethod; amount: number }[] = []
    let cashPaidAmount: number | undefined

    if (activeMethod === 'cash') {
      if (parsedCashGiven < totalAmount) {
        setError(`El monto entregado (${formatCLP(parsedCashGiven)}) es menor al total (${formatCLP(totalAmount)}).`)
        return
      }
      payments.push({ method: 'cash', amount: totalAmount })
      cashPaidAmount = parsedCashGiven
    } else if (activeMethod === 'card') {
      payments.push({ method: 'card', amount: totalAmount })
    } else if (activeMethod === 'transfer') {
      payments.push({ method: 'transfer', amount: totalAmount })
    } else if (activeMethod === 'mixed') {
      const c = parseCLP(mixedCash)
      const d = parseCLP(mixedCard)
      const t = parseCLP(mixedTransfer)
      const mixedSum = c + d + t

      if (mixedSum !== totalAmount) {
        setError(`La suma de los métodos (${formatCLP(mixedSum)}) debe ser exactamente igual al total (${formatCLP(totalAmount)}). Diferencia: ${formatCLP(totalAmount - mixedSum)}`)
        return
      }

      if (c > 0) payments.push({ method: 'cash', amount: c })
      if (d > 0) payments.push({ method: 'card', amount: d })
      if (t > 0) payments.push({ method: 'transfer', amount: t })
    }

    setIsSubmitting(true)
    try {
      const result = await finalizeSale({
        cashSessionId: currentSession.id,
        payments,
        cashPaid: cashPaidAmount
      })
      setCompletedResult(result)
      setPrintStatusMsg(null)
      onSuccess(result)

      // Imprimir ticket térmico solo si printReceipt es true
      if (printReceipt) {
        try {
          const pConfig = await window.api.getPrinterConfig()
          if (pConfig.thermalInterface) {
            const saleDetail = await window.api.getSaleDetail(result.sale.id)
            if (saleDetail) {
              await window.api.printThermalReceipt(saleDetail, result.change)
            }
          }
        } catch (printErr) {
          console.warn('Impresión de ticket falló (no crítico):', printErr)
        }
      }
    } catch (err: any) {
      console.error('Error al registrar venta:', err)
      setError(err.message || 'Error al completar la venta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Atajos de teclado en el modal de cobro: Flechas horizontales para alternar método, Enter/Shift+Enter/F11 para cobrar
  useEffect(() => {
    if (!isOpen) return

    const handleModalKeyDown = (e: KeyboardEvent): void => {
      // 1. Pantalla de venta completada: Enter, Escape o Barra espaciadora continúa
      if (completedResult) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
        return
      }

      // 2. F11 o Shift+Enter -> Cobrar sin imprimir
      if (e.key === 'F11' || (e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault()
        handleConfirmPayment(false)
        return
      }

      // 3. Enter normal -> Cobrar e imprimir
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleConfirmPayment(true)
        return
      }

      // 4. Flechas horizontales: navegar entre métodos de pago
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveMethod((prev) => {
          const currentIndex = METHODS.indexOf(prev)
          const nextIndex =
            e.key === 'ArrowRight'
              ? (currentIndex + 1) % METHODS.length
              : (currentIndex - 1 + METHODS.length) % METHODS.length
          const nextMethod = METHODS[nextIndex]

          if (nextMethod === 'cash') {
            setTimeout(() => {
              cashInputRef.current?.focus()
              cashInputRef.current?.select()
            }, 50)
          }
          return nextMethod
        })
      }
    }

    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [
    isOpen,
    completedResult,
    activeMethod,
    parsedCashGiven,
    totalAmount,
    currentSession,
    mixedCash,
    mixedCard,
    mixedTransfer,
    isSubmitting
  ])

  const handlePrintThermal = async (): Promise<void> => {
    if (!completedResult) return
    setIsPrintingThermal(true)
    setPrintStatusMsg(null)
    try {
      const saleDetail = await window.api.getSaleDetail(completedResult.sale.id)
      if (!saleDetail) {
        setPrintStatusMsg({ type: 'error', text: 'No se encontró el detalle de la venta.' })
        return
      }
      const res = await window.api.printThermalReceipt(saleDetail, completedResult.change)
      if (res.success) {
        setPrintStatusMsg({ type: 'success', text: '¡Ticket térmico enviado a la impresora!' })
      } else {
        setPrintStatusMsg({ type: 'error', text: res.error || 'Error al imprimir.' })
      }
    } catch (err: any) {
      setPrintStatusMsg({ type: 'error', text: err.message || 'Error al imprimir ticket térmico.' })
    } finally {
      setIsPrintingThermal(false)
    }
  }

  const handlePrintNormal = async (): Promise<void> => {
    if (!completedResult) return
    setIsPrintingNormal(true)
    setPrintStatusMsg(null)
    try {
      const saleDetail = await window.api.getSaleDetail(completedResult.sale.id)
      if (!saleDetail) {
        setPrintStatusMsg({ type: 'error', text: 'No se encontró el detalle de la venta.' })
        return
      }
      const res = await window.api.printNormalReceipt(saleDetail)
      if (res.success) {
        setPrintStatusMsg({ type: 'success', text: '¡Comprobante enviado a la impresora de Windows!' })
      } else {
        setPrintStatusMsg({ type: 'error', text: res.error || 'Error al imprimir comprobante.' })
      }
    } catch (err: any) {
      setPrintStatusMsg({ type: 'error', text: err.message || 'Error al imprimir comprobante.' })
    } finally {
      setIsPrintingNormal(false)
    }
  }

  const handleOpenDrawer = async (): Promise<void> => {
    setIsOpeningDrawer(true)
    setPrintStatusMsg(null)
    try {
      const res = await window.api.openCashDrawer()
      if (res.success) {
        setPrintStatusMsg({ type: 'success', text: '¡Cajón de dinero abierto!' })
      } else {
        setPrintStatusMsg({ type: 'error', text: res.error || 'Error al abrir cajón.' })
      }
    } catch (err: any) {
      setPrintStatusMsg({ type: 'error', text: err.message || 'Error al abrir cajón.' })
    } finally {
      setIsOpeningDrawer(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Success Screen */}
        {completedResult ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div
              className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-2xs border border-emerald-200/80 dark:border-emerald-800/60"
              aria-hidden="true"
            >
              <CheckCircle className="w-9 h-9" />
            </div>

            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Venta completada con éxito
            </span>

            <h3 id="checkout-modal-title" className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-0.5 tabular-nums">
              Folio #{completedResult.sale.folio}
            </h3>
            <span className="text-xs font-semibold text-lilac-700 dark:text-lilac-300 bg-lilac-50 dark:bg-lilac-950/40 border border-lilac-200/60 dark:border-lilac-800/50 px-2.5 py-0.5 rounded-full mb-2 tabular-nums">
              Ticket de turno #{completedResult.sale.ticket_number ?? 0}
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Total pagado: <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{formatCLP(completedResult.sale.total)}</span>
            </p>

            {completedResult.change > 0 && (
              <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 mb-4 text-center">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Vuelto a entregar
                </span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {formatCLP(completedResult.change)}
                </div>
              </div>
            )}

            {/* Print Status Message */}
            {printStatusMsg && (
              <div
                className={clsx(
                  'w-full p-2.5 rounded-xl text-xs font-semibold mb-3 flex items-center gap-2',
                  printStatusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                )}
              >
                {printStatusMsg.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{printStatusMsg.text}</span>
              </div>
            )}

            {/* Print Action Buttons */}
            <div className="w-full grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={handlePrintThermal}
                disabled={isPrintingThermal}
                className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors duration-150 motion-reduce:transition-none flex flex-col items-center gap-1.5 disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
              >
                {isPrintingThermal ? (
                  <Loader2 className="w-4 h-4 text-lilac-600 dark:text-lilac-400 animate-spin" aria-hidden="true" />
                ) : (
                  <Printer className="w-4 h-4 text-lilac-600 dark:text-lilac-400" aria-hidden="true" />
                )}
                <span>{isPrintingThermal ? 'Imprimiendo…' : 'Ticket térmico'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintNormal}
                disabled={isPrintingNormal}
                className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors duration-150 motion-reduce:transition-none flex flex-col items-center gap-1.5 disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
              >
                {isPrintingNormal ? (
                  <Loader2 className="w-4 h-4 text-lilac-600 dark:text-lilac-400 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="w-4 h-4 text-lilac-600 dark:text-lilac-400" aria-hidden="true" />
                )}
                <span>{isPrintingNormal ? 'Imprimiendo…' : 'Comprobante normal'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenDrawer}
                disabled={isOpeningDrawer}
                className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors duration-150 motion-reduce:transition-none flex flex-col items-center gap-1.5 disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
              >
                {isOpeningDrawer ? (
                  <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" aria-hidden="true" />
                ) : (
                  <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                )}
                <span>{isOpeningDrawer ? 'Abriendo…' : 'Abrir cajón'}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-lilac-600 hover:bg-lilac-700 active:bg-lilac-800 text-white rounded-xl font-bold text-sm transition-colors duration-150 motion-reduce:transition-none shadow-md shadow-lilac-500/25 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
            >
              <span>Continuar con nueva venta</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          /* Payment Form Screen */
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                <Receipt className="w-5 h-5 text-lilac-600 dark:text-lilac-400" aria-hidden="true" />
                <h2 id="checkout-modal-title" className="text-base font-bold tracking-tight">Cobro de Venta</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar modal de cobro"
                title="Cerrar modal de cobro"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Total Banner */}
            <div className="bg-lilac-600 dark:bg-lilac-950/80 dark:border-b dark:border-lilac-800/60 px-6 py-4 text-white flex items-center justify-between shadow-inner">
              <span className="text-sm font-medium text-lilac-100 dark:text-lilac-200">Total a pagar:</span>
              <span className="text-3xl font-black tracking-tight tabular-nums">{formatCLP(totalAmount)}</span>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  Método de pago:
                </label>
                <div role="tablist" aria-label="Métodos de pago" className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMethod === 'cash'}
                    onClick={() => setActiveMethod('cash')}
                    className={clsx(
                      'py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border cursor-pointer',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
                      activeMethod === 'cash'
                        ? 'bg-lilac-100 text-lilac-950 border-lilac-300 ring-2 ring-lilac-400/50 dark:bg-lilac-950/80 dark:text-lilac-100 dark:border-lilac-700'
                        : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    )}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMethod === 'card'}
                    onClick={() => setActiveMethod('card')}
                    className={clsx(
                      'py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border cursor-pointer',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
                      activeMethod === 'card'
                        ? 'bg-lilac-100 text-lilac-950 border-lilac-300 ring-2 ring-lilac-400/50 dark:bg-lilac-950/80 dark:text-lilac-100 dark:border-lilac-700'
                        : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    )}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <span>Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMethod === 'transfer'}
                    onClick={() => setActiveMethod('transfer')}
                    className={clsx(
                      'py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border cursor-pointer',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
                      activeMethod === 'transfer'
                        ? 'bg-lilac-100 text-lilac-950 border-lilac-300 ring-2 ring-lilac-400/50 dark:bg-lilac-950/80 dark:text-lilac-100 dark:border-lilac-700'
                        : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    )}
                  >
                    <SendHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>Transf.</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMethod === 'mixed'}
                    onClick={() => setActiveMethod('mixed')}
                    className={clsx(
                      'py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 border cursor-pointer',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
                      activeMethod === 'mixed'
                        ? 'bg-lilac-100 text-lilac-950 border-lilac-300 ring-2 ring-lilac-400/50 dark:bg-lilac-950/80 dark:text-lilac-100 dark:border-lilac-700'
                        : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    )}
                  >
                    <Coins className="w-4 h-4 text-lilac-600 dark:text-lilac-400" aria-hidden="true" />
                    <span>Mixto</span>
                  </button>
                </div>
              </div>

              {/* Method Detail: Cash */}
              {activeMethod === 'cash' && (
                <div className="space-y-4 bg-slate-50 dark:bg-slate-850/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <div>
                    <label htmlFor="cash-given-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ¿Con cuánto paga el cliente?
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 dark:text-slate-500" aria-hidden="true">
                        $
                      </span>
                      <input
                        id="cash-given-input"
                        ref={cashInputRef}
                        type="text"
                        inputMode="numeric"
                        value={cashGiven}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setCashGiven(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        className="w-full pl-8 pr-4 py-2.5 text-xl font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none tabular-nums shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Common bills */}
                  {commonBills.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Paga con:</span>
                      {commonBills.map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => handleSelectQuickBill(b.amount)}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 hover:bg-lilac-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-lilac-800 dark:hover:text-lilac-200 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold transition-colors duration-150 motion-reduce:transition-none shadow-2xs tabular-nums cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vuelto Calculation */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Vuelto:</span>
                    <span
                      className={clsx(
                        'text-xl font-black tabular-nums',
                        parsedCashGiven >= totalAmount
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {formatCLP(cashChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* Method Detail: Card */}
              {activeMethod === 'card' && (
                <div className="p-5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 rounded-xl flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">Pago con tarjeta de débito o crédito</p>
                    <p>
                      Pasa la tarjeta por el POS Transbank o Redelcom por el monto total de{' '}
                      <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCLP(totalAmount)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Method Detail: Transfer */}
              {activeMethod === 'transfer' && (
                <div className="p-5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-xl flex items-center gap-3">
                  <SendHorizontal className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">Transferencia bancaria</p>
                    <p>
                      Verifica el comprobante recibido por el monto exacto de{' '}
                      <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCLP(totalAmount)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Method Detail: Mixed */}
              {activeMethod === 'mixed' && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-850/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Ingresa los montos parciales para cada método (la suma debe ser{' '}
                    <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{formatCLP(totalAmount)}</strong>):
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor="mixed-cash-input" className="w-24 text-xs font-semibold text-slate-700 dark:text-slate-300">Efectivo:</label>
                      <input
                        id="mixed-cash-input"
                        type="text"
                        value={mixedCash}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedCash(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none tabular-nums"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor="mixed-card-input" className="w-24 text-xs font-semibold text-slate-700 dark:text-slate-300">Tarjeta:</label>
                      <input
                        id="mixed-card-input"
                        type="text"
                        value={mixedCard}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedCard(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none tabular-nums"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor="mixed-transfer-input" className="w-24 text-xs font-semibold text-slate-700 dark:text-slate-300">Transf.:</label>
                      <input
                        id="mixed-transfer-input"
                        type="text"
                        value={mixedTransfer}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedTransfer(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">Suma actual:</span>
                    <span
                      className={clsx(
                        'tabular-nums font-mono',
                        parseCLP(mixedCash) + parseCLP(mixedCard) + parseCLP(mixedTransfer) === totalAmount
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {formatCLP(parseCLP(mixedCash) + parseCLP(mixedCard) + parseCLP(mixedTransfer))} / {formatCLP(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Botones de Acción de Cobro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmPayment(true)}
                  disabled={isSubmitting}
                  className="py-3 px-4 bg-lilac-600 hover:bg-lilac-700 active:bg-lilac-800 text-white rounded-xl font-bold text-sm transition-colors duration-150 motion-reduce:transition-none shadow-md shadow-lilac-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
                  title="Registrar venta y emitir ticket térmico (Enter)"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Printer className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{isSubmitting ? 'Cobrando…' : 'Cobrar e Imprimir (Enter)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmPayment(false)}
                  disabled={isSubmitting}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-sm transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900"
                  title="Registrar venta sin emitir ticket impreso (Shift+Enter o F11)"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  )}
                  <span>{isSubmitting ? 'Cobrando…' : 'Cobrar sin Imprimir (F11)'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
