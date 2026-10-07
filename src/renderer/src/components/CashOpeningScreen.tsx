import React, { useState, useEffect } from 'react'
import { Banknote, CheckCircle, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useCashStore } from '../store/cashStore'
import { formatCLP } from '../utils/formatters'
import { calculateCountedCash } from '@shared/finance'
import { DenominationsCalculator } from '../views/cashCut/DenominationsCalculator'

export const CashOpeningScreen: React.FC = () => {
  const { openSession, getLastClosedSession, error, clearError } = useCashStore()

  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    10: 0
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inheritedFromSessionId, setInheritedFromSessionId] = useState<number | null>(null)

  // Cargar desglose heredado de la última sesión cerrada
  useEffect(() => {
    const loadInherited = async (): Promise<void> => {
      try {
        const lastSession = await getLastClosedSession()
        if (lastSession?.next_opening_denominations) {
          const raw = lastSession.next_opening_denominations
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          setDenominationCounts(parsed)
          setInheritedFromSessionId(lastSession.id)
        }
      } catch (err) {
        console.error('Error cargando denominaciones previas:', err)
      }
    }

    loadInherited()
  }, [getLastClosedSession])

  const currentAmount = calculateCountedCash(denominationCounts)

  const handleDenominationChange = (value: number, count: number): void => {
    clearError()
    setDenominationCounts((prev) => ({
      ...prev,
      [value]: Math.max(0, isNaN(count) ? 0 : count)
    }))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (currentAmount < 0) return

    setIsSubmitting(true)
    await openSession(currentAmount, denominationCounts)
    setIsSubmitting(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-lilac-50 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 select-none overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-850 rounded-3xl shadow-xl shadow-lilac-500/5 dark:shadow-none border border-lilac-100 dark:border-slate-800 p-7 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-3 shadow-inner">
          <Banknote className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">
          Apertura de Caja
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4 max-w-md">
          {inheritedFromSessionId
            ? `Fondo de caja sugerido del corte anterior (Turno #${inheritedFromSessionId}). Verifica las cantidades en gaveta y confirma para iniciar.`
            : 'Ingresa las cantidades de billetes y monedas en gaveta para abrir el turno de ventas.'}
        </p>

        {/* Inherited info badge */}
        {inheritedFromSessionId && (
          <div className="w-full mb-3.5 px-3.5 py-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="leading-snug">
              Billetes y monedas prellenados automáticamente desde el corte del <strong>Turno #{inheritedFromSessionId}</strong>.
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="w-full mb-4 p-3.5 bg-rose-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Calculadora de denominaciones de apertura */}
          <div className="w-full">
            <DenominationsCalculator
              title="Fondo Inicial por Denominación"
              subtitle="Conteo físico de billetes y monedas al abrir"
              denominationCounts={denominationCounts}
              onDenominationChange={handleDenominationChange}
              countedCash={currentAmount}
              readOnly={false}
              badgeLabel={inheritedFromSessionId ? 'Heredado de corte' : 'Nuevo turno'}
              badgeVariant={inheritedFromSessionId ? 'emerald' : 'lilac'}
              footerLabel="Fondo Inicial Total"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || currentAmount < 0}
            className="w-full py-3.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-lilac-500/25 flex items-center justify-center gap-2 hover:shadow-lilac-500/35 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <span>Iniciando sesión de caja...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Abrir Caja con {formatCLP(currentAmount)}</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 text-center">
          Presiona <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 font-mono">Enter</kbd> para confirmar y entrar al punto de venta.
        </p>
      </div>
    </div>
  )
}
