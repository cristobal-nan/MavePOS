import React, { useState, useEffect, useCallback } from 'react'
import { Wallet, RotateCcw, Info } from 'lucide-react'
import { CHILEAN_DENOMINATIONS, DEFAULT_WITHDRAWAL_RULES, WithdrawalRules } from '@shared/finance'
import { useSettingsStore, DirtyFieldChange } from '../../store/settingsStore'

export const CashSettingsTab: React.FC = () => {
  const [initialRules, setInitialRules] = useState<WithdrawalRules>({ ...DEFAULT_WITHDRAWAL_RULES })
  const [rules, setRules] = useState<WithdrawalRules>({ ...DEFAULT_WITHDRAWAL_RULES })
  const [isLoaded, setIsLoaded] = useState(false)

  const registerSubTabState = useSettingsStore((s) => s.registerSubTabState)
  const clearSubTabState = useSettingsStore((s) => s.clearSubTabState)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((settings) => {
        if (!isMounted) return
        let loadedRules = { ...DEFAULT_WITHDRAWAL_RULES }
        if (settings?.cash_cut_withdrawal_rules) {
          try {
            const parsed = JSON.parse(settings.cash_cut_withdrawal_rules)
            loadedRules = { ...DEFAULT_WITHDRAWAL_RULES, ...parsed }
          } catch (e) {
            console.error('Error parseando cash_cut_withdrawal_rules:', e)
          }
        }
        setInitialRules(loadedRules)
        setRules(loadedRules)
        setIsLoaded(true)
      })
      .catch((err) => {
        console.error('Error al cargar configuración de retiro:', err)
      })

    return () => {
      isMounted = false
      clearSubTabState()
    }
  }, [clearSubTabState])

  const handleLimitChange = (denomValue: number, rawValue: string): void => {
    const trimmed = rawValue.trim()
    setRules((prev) => ({
      ...prev,
      [denomValue]: trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10) || 0)
    }))
  }

  const handleToggleUnlimited = (denomValue: number, isUnlimited: boolean): void => {
    setRules((prev) => ({
      ...prev,
      [denomValue]: isUnlimited ? null : (denomValue === 20000 ? 0 : 2)
    }))
  }

  const handleRestoreDefaults = (): void => {
    setRules({ ...DEFAULT_WITHDRAWAL_RULES })
  }

  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await window.api.setSetting('cash_cut_withdrawal_rules', JSON.stringify(rules))
      setInitialRules({ ...rules })
      return true
    } catch (err: any) {
      console.error('Error guardando reglas de retiro:', err)
      return false
    }
  }, [rules])

  const handleDiscard = useCallback((): void => {
    setRules({ ...initialRules })
  }, [initialRules])

  // Track dirty changes
  useEffect(() => {
    if (!isLoaded) return

    const changes: DirtyFieldChange[] = []
    for (const denom of CHILEAN_DENOMINATIONS) {
      const currentVal = rules[denom.value]
      const initVal = initialRules[denom.value]

      if (currentVal !== initVal) {
        const descCurrent = currentVal === null ? 'Ilimitado (dejar todo)' : `${currentVal} unidades`
        changes.push({
          field: `Fondo Billete/Moneda ${denom.label}`,
          value: descCurrent
        })
      }
    }

    const isDirty = changes.length > 0
    registerSubTabState(isDirty, changes, handleSave, handleDiscard)
  }, [rules, initialRules, isLoaded, handleSave, handleDiscard, registerSubTabState])

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150">
      {/* Resumen explicativo */}
      <div className="bg-lilac-50/60 border border-lilac-200/80 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800">
            Reglas de Retiro y Fondo para Siguiente Turno
          </h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Al realizar el corte de turno (F4), el sistema calcula automáticamente el dinero que debe
            permanecer en caja para el siguiente turno y el <strong>Monto de Retiro</strong> a entregar.
            Aquí puedes definir cuántas unidades de cada billete o moneda se dejan como fondo de caja.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-lilac-800 bg-white/70 py-1.5 px-3 rounded-lg border border-lilac-200 inline-flex">
            <Info className="w-4 h-4 shrink-0 text-lilac-600" />
            <span>
              Regla recomendada por defecto: retirar todos los billetes de $20.000 (dejar 0) y dejar máximo 2 billetes de $10.000.
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de configuración por denominación */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Unidades a conservar en fondo de caja
          </h3>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-lilac-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer valores por defecto</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {CHILEAN_DENOMINATIONS.map((denom) => {
            const limit = rules[denom.value]
            const isUnlimited = limit === null || limit === undefined

            return (
              <div
                key={denom.value}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                      denom.type === 'bill'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {denom.type === 'bill' ? 'B' : 'M'}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900">{denom.label}</span>
                    <span className="text-[11px] text-slate-500 block">
                      {denom.type === 'bill' ? 'Billete' : 'Moneda'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Selector de Ilimitado vs Límite Fijo */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isUnlimited}
                        onChange={(e) => handleToggleUnlimited(denom.value, e.target.checked)}
                        className="rounded border-slate-300 text-lilac-600 focus:ring-lilac-500 cursor-pointer"
                      />
                      <span>Dejar todas (sin límite)</span>
                    </label>
                  </div>

                  {/* Input de cantidad si no es ilimitado */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Dejar máx:</span>
                    <input
                      type="number"
                      min={0}
                      disabled={isUnlimited}
                      value={isUnlimited ? '' : limit ?? 0}
                      onChange={(e) => handleLimitChange(denom.value, e.target.value)}
                      placeholder={isUnlimited ? '∞' : '0'}
                      className={`w-16 px-2.5 py-1 text-center font-black text-xs rounded-lg border transition-all ${
                        isUnlimited
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-900 border-slate-300 focus:border-lilac-500 focus:ring-1 focus:ring-lilac-500'
                      }`}
                    />
                    <span className="text-slate-400 text-xs w-8">unid.</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
