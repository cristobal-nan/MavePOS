import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ArrowUpRight,
  Banknote,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { useCashStore } from '../../store/cashStore'
import { useHistoryStore } from '../../store/historyStore'
import { formatCLP, formatDateTime, parseCLP } from '../../utils/formatters'

const QUICK_WITHDRAWAL_REASONS = [
  'Pago a Proveedor',
  'Retiro de Efectivo',
  'Compra de Insumos',
  'Flete / Encomienda',
  'Anticipo de Sueldo',
  'Gastos Varios de Caja'
]

interface CashWithdrawalModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CashWithdrawalModal: React.FC<CashWithdrawalModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentSession } = useCashStore()
  const { cashMovements, addCashMovement, fetchCashMovements } = useHistoryStore()

  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [withdrawalSuccessMsg, setWithdrawalSuccessMsg] = useState<string | null>(null)
  const [withdrawalErrorMsg, setWithdrawalErrorMsg] = useState<string | null>(null)
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false)

  const amountInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && currentSession?.id) {
      fetchCashMovements(currentSession.id)
      setWithdrawalAmount('')
      setWithdrawalReason('')
      setWithdrawalSuccessMsg(null)
      setWithdrawalErrorMsg(null)
      setTimeout(() => amountInputRef.current?.focus(), 50)
    }
  }, [isOpen, currentSession?.id, fetchCashMovements])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const totalCashWithdrawals = cashMovements.reduce((acc, m) => acc + m.amount, 0)

  const handleRegisterWithdrawal = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setWithdrawalSuccessMsg(null)
    setWithdrawalErrorMsg(null)

    if (!currentSession?.id) {
      setWithdrawalErrorMsg('No hay una sesión de caja activa')
      return
    }

    const amount = parseCLP(withdrawalAmount)
    if (amount <= 0) {
      setWithdrawalErrorMsg('Ingresa un monto válido mayor a cero')
      amountInputRef.current?.focus()
      return
    }

    if (!withdrawalReason.trim()) {
      setWithdrawalErrorMsg('Debes especificar un motivo para la salida de dinero')
      return
    }

    setIsSubmittingWithdrawal(true)
    const success = await addCashMovement(currentSession.id, amount, withdrawalReason.trim())
    setIsSubmittingWithdrawal(false)

    if (success) {
      setWithdrawalSuccessMsg(`Salida por ${formatCLP(amount)} registrada correctamente`)
      setWithdrawalAmount('')
      setWithdrawalReason('')
      setTimeout(() => setWithdrawalSuccessMsg(null), 4000)
      amountInputRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 font-bold">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Salida de Efectivo de Caja
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  {currentSession ? `Sesión #${currentSession.id}` : 'Sin Sesión'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Registra retiros o gastos menores en efectivo del turno actual
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-semibold text-slate-400 block">Total Salidas Turno:</span>
              <span className="text-lg font-black text-amber-700">{formatCLP(totalCashWithdrawals)}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {withdrawalSuccessMsg && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{withdrawalSuccessMsg}</span>
          </div>
        )}

        {withdrawalErrorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{withdrawalErrorMsg}</span>
          </div>
        )}

        {/* Content Body: Form + History List */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/50">
          {/* Formulario */}
          <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Banknote className="w-4 h-4 text-amber-600" />
              <span>Registrar Retiro</span>
            </h4>

            <form onSubmit={handleRegisterWithdrawal} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monto a Retirar (CLP) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    $
                  </span>
                  <input
                    ref={amountInputRef}
                    type="text"
                    required
                    value={withdrawalAmount}
                    onChange={(e) => {
                      setWithdrawalErrorMsg(null)
                      const val = e.target.value.replace(/\D/g, '')
                      setWithdrawalAmount(val ? Number(val).toLocaleString('es-CL') : '')
                    }}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none font-mono text-base font-bold text-slate-800 shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo o Destino del Dinero *
                </label>
                <input
                  type="text"
                  required
                  value={withdrawalReason}
                  onChange={(e) => {
                    setWithdrawalErrorMsg(null)
                    setWithdrawalReason(e.target.value)
                  }}
                  placeholder="Ej: Pago de flete, compra de cinta, etc."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none text-xs text-slate-800 shadow-inner"
                />
              </div>

              {/* Botones de Motivo Rápido */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Motivos frecuentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_WITHDRAWAL_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setWithdrawalReason(reason)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 text-[11px] font-medium border border-slate-200 transition-colors cursor-pointer"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdrawal || !currentSession}
                className="mt-2 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>
                  {isSubmittingWithdrawal ? 'Registrando...' : 'Confirmar Salida de Dinero'}
                </span>
              </button>
            </form>
          </div>

          {/* Historial de Salidas del Turno */}
          <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Salidas de este Turno</span>
              </h4>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {cashMovements.length} registro(s)
              </span>
            </div>

            <div className="flex-1 overflow-auto max-h-[360px] border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Hora</th>
                    <th className="py-2 px-3">Motivo</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {cashMovements.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400">
                        No se han registrado salidas de dinero en esta sesión.
                      </td>
                    </tr>
                  ) : (
                    cashMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-medium text-[11px]">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {m.reason}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                          − {formatCLP(m.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
