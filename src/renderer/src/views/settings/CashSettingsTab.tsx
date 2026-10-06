import React, { useState, useEffect } from 'react'
import { Wallet, Save, RotateCcw, CheckCircle2, Info } from 'lucide-react'
import { CHILEAN_DENOMINATIONS, DEFAULT_WITHDRAWAL_RULES, WithdrawalRules } from '@shared/finance'
import { formatCLP } from '../../utils/formatters'

export const CashSettingsTab: React.FC = () => {
  const [rules, setRules] = useState<WithdrawalRules>({ ...DEFAULT_WITHDRAWAL_RULES })
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((settings) => {
        if (!isMounted) return
        if (settings?.cash_cut_withdrawal_rules) {
          try {
            const parsed = JSON.parse(settings.cash_cut_withdrawal_rules)
            setRules({ ...DEFAULT_WITHDRAWAL_RULES, ...parsed })
          } catch (e) {
            console.error('Error parseando cash_cut_withdrawal_rules:', e)
          }
        }
      })
      .catch((err) => {
        console.error('Error al cargar configuración de retiro:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

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

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    setSavedMessage(null)

    try {
      await window.api.setSetting('cash_cut_withdrawal_rules', JSON.stringify(rules))
      setSavedMessage('¡Reglas de fondo y retiro guardadas correctamente!')
      setTimeout(() => setSavedMessage(null), 4000)
    } catch (err: any) {
      console.error('Error guardando reglas de retiro:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-4xl">
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
            className="text-xs font-semibold text-lilac-600 hover:text-lilac-800 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar valores sugeridos</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {CHILEAN_DENOMINATIONS.map((denom) => {
            const limit = rules[denom.value]
            const isUnlimited = limit === null || limit === undefined

            return (
              <div
                key={denom.value}
                className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                    denom.type === 'bill'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {denom.type === 'bill' ? 'B' : 'M'}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{denom.label}</span>
                    <span className="text-[11px] text-slate-400">
                      {denom.type === 'bill' ? 'Billete' : 'Moneda'} ({formatCLP(denom.value)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Selector: Ilimitado vs Límite numérico */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => handleToggleUnlimited(denom.value, e.target.checked)}
                      className="rounded border-slate-300 text-lilac-600 focus:ring-lilac-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs">Dejar todas (sin retirar)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Dejar máximo:</span>
                    <input
                      type="number"
                      min={0}
                      disabled={isUnlimited}
                      value={isUnlimited ? '' : limit}
                      onChange={(e) => handleLimitChange(denom.value, e.target.value)}
                      placeholder={isUnlimited ? '∞' : '0'}
                      className={`w-20 px-2 py-1.5 text-center text-xs font-bold rounded-lg border focus:outline-none transition-colors ${
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

      {/* Botones de acción */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-md shadow-lilac-200 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Guardando...' : 'Guardar Reglas de Retiro'}</span>
        </button>
      </div>

      {/* Toast Flotante de Guardado Exitoso (Bottom-Right, sin Layout Shift) */}
      {savedMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-emerald-300 text-emerald-950 p-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{savedMessage}</span>
        </div>
      )}
    </form>
  )
}
