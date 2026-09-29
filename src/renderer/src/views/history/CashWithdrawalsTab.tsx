import React, { useState } from 'react'
import {
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

export const CashWithdrawalsTab: React.FC = () => {
  const { currentSession } = useCashStore()
  const { cashMovements, addCashMovement } = useHistoryStore()

  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [withdrawalSuccessMsg, setWithdrawalSuccessMsg] = useState<string | null>(null)
  const [withdrawalErrorMsg, setWithdrawalErrorMsg] = useState<string | null>(null)
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false)

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
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
      {/* Header Banner: Sesión Activa */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Salidas de Efectivo de Caja
            </h3>
            <p className="text-xs text-slate-500">
              {currentSession
                ? `Sesión Activa #${currentSession.id} — Fondo de apertura: ${formatCLP(
                    currentSession.opening_fund
                  )}`
                : 'No hay una sesión de caja abierta actualmente'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold text-slate-500">Total Salidas de esta Sesión:</span>
          <p className="text-2xl font-black text-amber-700">{formatCLP(totalCashWithdrawals)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Formulario de Salida */}
        <div className="md:col-span-5 bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-600" />
            <span>Registrar Nueva Salida</span>
          </h4>

          {withdrawalSuccessMsg && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{withdrawalSuccessMsg}</span>
            </div>
          )}

          {withdrawalErrorMsg && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{withdrawalErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterWithdrawal} className="flex flex-col gap-4">
            {/* Monto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monto a Retirar ($ CLP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={withdrawalAmount ? formatCLP(parseCLP(withdrawalAmount)).replace('$ ', '') : ''}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-base font-bold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
                  disabled={!currentSession}
                />
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo / Destino del Dinero <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Pago de flete, compra de cinta adhesiva..."
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                disabled={!currentSession}
              />
            </div>

            {/* Chips de Motivos Frecuentes */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Motivos sugeridos:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_WITHDRAWAL_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setWithdrawalReason(reason)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 text-[11px] text-slate-600 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!currentSession || isSubmittingWithdrawal}
              className="mt-2 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>
                {isSubmittingWithdrawal ? 'Registrando...' : 'Registrar Salida de Dinero'}
              </span>
            </button>
          </form>
        </div>

        {/* Tabla de Salidas Registradas */}
        <div className="md:col-span-7 bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Salidas Registradas en esta Sesión</span>
            </h4>
            <span className="text-xs font-semibold text-slate-500">
              {cashMovements.length} registro{cashMovements.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 border border-slate-100 rounded-xl overflow-hidden overflow-y-auto max-h-[380px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-28">Hora</th>
                  <th className="py-2 px-3">Motivo</th>
                  <th className="py-2 px-3 text-right w-32">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {cashMovements.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-500">No hay salidas registradas</p>
                      <p className="text-[11px] text-slate-400">
                        Cualquier retiro de efectivo quedará auditado aquí
                      </p>
                    </td>
                  </tr>
                ) : (
                  cashMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-500 font-mono text-[11px]">
                        {formatDateTime(mov.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{mov.reason}</td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-700">
                        − {formatCLP(mov.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {cashMovements.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Total salidas de caja:</span>
              <span className="font-black text-base text-amber-700">
                {formatCLP(totalCashWithdrawals)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
