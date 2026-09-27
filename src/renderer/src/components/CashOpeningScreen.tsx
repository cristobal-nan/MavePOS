import React, { useState, useEffect, useRef } from 'react'
import { Banknote, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { useCashStore } from '../store/cashStore'
import { formatCLP, parseCLP } from '../utils/formatters'

export const CashOpeningScreen: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { openSession, error, clearError } = useCashStore()

  useEffect(() => {
    // Automatically focus the input field on mount
    inputRef.current?.focus()
  }, [])

  const currentAmount = parseCLP(inputValue)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    clearError()
    const raw = e.target.value
    const parsed = parseCLP(raw)
    if (parsed === 0 && !raw.trim()) {
      setInputValue('')
    } else {
      setInputValue(parsed.toLocaleString('es-CL'))
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (currentAmount < 0) return

    setIsSubmitting(true)
    const success = await openSession(currentAmount)
    setIsSubmitting(false)

    if (!success) {
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-lilac-50 via-slate-50 to-white select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-lilac-500/5 border border-lilac-100 p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-5 shadow-inner">
          <Banknote className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
          Apertura de Caja
        </h1>
        <p className="text-sm text-slate-500 text-center mb-8 max-w-sm">
          Ingresa el monto de fondo inicial en efectivo para iniciar el turno de ventas.
        </p>

        {/* Error message */}
        {error && (
          <div className="w-full mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          {/* Main Input Display */}
          <div className="w-full relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
              $
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full pl-10 pr-16 py-4 text-3xl font-extrabold text-slate-800 text-center bg-slate-50 border-2 border-lilac-200 rounded-2xl focus:outline-none focus:border-lilac-500 focus:bg-white transition-all shadow-inner tracking-wide"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-lilac-600 bg-lilac-100 px-2 py-1 rounded-md">
              CLP
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || currentAmount < 0}
            className="w-full py-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-lilac-500/25 flex items-center justify-center gap-2 hover:shadow-lilac-500/35 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <span>Iniciando sesión de caja...</span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Abrir Caja con {formatCLP(currentAmount)}</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-5 text-center">
          Presiona <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 text-[11px] font-mono">Enter</kbd> para confirmar y entrar al punto de venta.
        </p>
      </div>
    </div>
  )
}
