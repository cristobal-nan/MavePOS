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
  ArrowRight
} from 'lucide-react'
import { PaymentMethod, CompletedSaleResult } from '@shared/types'
import { formatCLP, parseCLP } from '../utils/formatters'
import { useSalesStore } from '../store/salesStore'
import { useCashStore } from '../store/cashStore'

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

  const [activeMethod, setActiveMethod] = useState<TabMethod>('cash')
  const [cashGiven, setCashGiven] = useState<string>('')
  const [mixedCash, setMixedCash] = useState<string>('')
  const [mixedCard, setMixedCard] = useState<string>('')
  const [mixedTransfer, setMixedTransfer] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedResult, setCompletedResult] = useState<CompletedSaleResult | null>(null)

  const cashInputRef = useRef<HTMLInputElement>(null)

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

  if (!isOpen) return null

  const parsedCashGiven = parseCLP(cashGiven)
  const cashChange = Math.max(0, parsedCashGiven - totalAmount)

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

  const handleConfirmPayment = async (): Promise<void> => {
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
      onSuccess(result)
    } catch (err: any) {
      console.error('Error al registrar venta:', err)
      setError(err.message || 'Error al completar la venta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-lilac-100 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Success Screen */}
        {completedResult ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle className="w-9 h-9" />
            </div>

            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Venta Completada con Éxito
            </span>

            <h3 className="text-2xl font-black text-slate-800 mb-1">
              Folio #{completedResult.sale.folio}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Total pagado: <span className="font-bold text-slate-700">{formatCLP(completedResult.sale.total)}</span>
            </p>

            {completedResult.change > 0 && (
              <div className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-center">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Vuelto a Entregar
                </span>
                <div className="text-3xl font-black text-emerald-600 mt-1">
                  {formatCLP(completedResult.change)}
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-lilac-500/25 flex items-center justify-center gap-2"
            >
              <span>Continuar con Nueva Venta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Payment Form Screen */
          <>
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Receipt className="w-5 h-5 text-lilac-600" />
                <span>Cobro de Venta</span>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Banner */}
            <div className="bg-lilac-600 px-6 py-4 text-white flex items-center justify-between shadow-inner">
              <span className="text-sm font-medium text-lilac-100">Total a Pagar:</span>
              <span className="text-3xl font-black tracking-tight">{formatCLP(totalAmount)}</span>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Método de Pago:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMethod('cash')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 border ${
                      activeMethod === 'cash'
                        ? 'bg-lilac-100 text-lilac-900 border-lilac-300 ring-2 ring-lilac-400/50'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMethod('card')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 border ${
                      activeMethod === 'card'
                        ? 'bg-lilac-100 text-lilac-900 border-lilac-300 ring-2 ring-lilac-400/50'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMethod('transfer')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 border ${
                      activeMethod === 'transfer'
                        ? 'bg-lilac-100 text-lilac-900 border-lilac-300 ring-2 ring-lilac-400/50'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <SendHorizontal className="w-4 h-4 text-amber-600" />
                    <span>Transf.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMethod('mixed')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 border ${
                      activeMethod === 'mixed'
                        ? 'bg-lilac-100 text-lilac-900 border-lilac-300 ring-2 ring-lilac-400/50'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Coins className="w-4 h-4 text-lilac-600" />
                    <span>Mixto</span>
                  </button>
                </div>
              </div>

              {/* Method Detail: Cash */}
              {activeMethod === 'cash' && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ¿Con cuánto paga el cliente?
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                        $
                      </span>
                      <input
                        ref={cashInputRef}
                        type="text"
                        inputMode="numeric"
                        value={cashGiven}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setCashGiven(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        className="w-full pl-8 pr-4 py-2.5 text-xl font-black text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-lilac-500 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Common bills */}
                  {commonBills.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-400">Paga con:</span>
                      {commonBills.map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => handleSelectQuickBill(b.amount)}
                          className="px-2.5 py-1 text-xs bg-white hover:bg-lilac-50 text-slate-700 hover:text-lilac-800 border border-slate-200 rounded-lg font-semibold transition-colors shadow-2xs"
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Vuelto Calculation */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Vuelto:</span>
                    <span
                      className={`text-xl font-black ${
                        parsedCashGiven >= totalAmount ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {formatCLP(cashChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* Method Detail: Card */}
              {activeMethod === 'card' && (
                <div className="p-5 bg-blue-50/50 border border-blue-200/60 rounded-2xl flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-blue-600 shrink-0" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-800 mb-0.5">Pago con Tarjeta de Débito / Crédito</p>
                    <p>Pasa la tarjeta por el POS Transbank o Redelcom por el monto total de <strong>{formatCLP(totalAmount)}</strong>.</p>
                  </div>
                </div>
              )}

              {/* Method Detail: Transfer */}
              {activeMethod === 'transfer' && (
                <div className="p-5 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-center gap-3">
                  <SendHorizontal className="w-8 h-8 text-amber-600 shrink-0" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-800 mb-0.5">Transferencia Bancaria</p>
                    <p>Verifica el comprobante por el monto exacto de <strong>{formatCLP(totalAmount)}</strong>.</p>
                  </div>
                </div>
              )}

              {/* Method Detail: Mixed */}
              {activeMethod === 'mixed' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <p className="text-xs text-slate-500 font-medium">
                    Ingresa los montos parciales para cada método (la suma debe ser {formatCLP(totalAmount)}):
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-xs font-semibold text-slate-700">Efectivo:</span>
                      <input
                        type="text"
                        value={mixedCash}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedCash(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-24 text-xs font-semibold text-slate-700">Tarjeta:</span>
                      <input
                        type="text"
                        value={mixedCard}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedCard(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-24 text-xs font-semibold text-slate-700">Transf.:</span>
                      <input
                        type="text"
                        value={mixedTransfer}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setMixedTransfer(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                    <span>Suma actual:</span>
                    <span
                      className={
                        parseCLP(mixedCash) + parseCLP(mixedCard) + parseCLP(mixedTransfer) === totalAmount
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }
                    >
                      {formatCLP(parseCLP(mixedCash) + parseCLP(mixedCard) + parseCLP(mixedTransfer))} / {formatCLP(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
                className="w-full py-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-lilac-500/25 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Registrando venta...</span>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Confirmar Cobro ({formatCLP(totalAmount)})</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
