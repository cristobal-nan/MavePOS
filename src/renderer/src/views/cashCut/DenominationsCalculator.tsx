import React from 'react'
import { Coins } from 'lucide-react'
import { formatCLP } from '../../utils/formatters'
import { CHILEAN_DENOMINATIONS, calculateCountedCash } from '@shared/finance'
export { CHILEAN_DENOMINATIONS }

export interface DenominationsCalculatorProps {
  title?: string
  subtitle?: string
  badgeLabel?: string
  badgeVariant?: 'slate' | 'lilac' | 'emerald' | 'amber'
  denominationCounts: Record<number, number>
  onDenominationChange?: (value: number, count: number) => void
  countedCash?: number
  readOnly?: boolean
  emptyMessage?: string
  hideFooter?: boolean
  footerLabel?: string
  onLastEnter?: () => void
  lastInputRef?: React.RefObject<HTMLInputElement | null> | React.MutableRefObject<HTMLInputElement | null>
}

export const DenominationsCalculator: React.FC<DenominationsCalculatorProps> = ({
  title = 'Calculadora de Billetes y Monedas',
  subtitle = 'Ingresa la cantidad física de cada billete y moneda.',
  badgeLabel,
  badgeVariant = 'lilac',
  denominationCounts,
  onDenominationChange,
  countedCash,
  readOnly = false,
  emptyMessage,
  hideFooter = false,
  footerLabel = 'Total Efectivo Físico',
  onLastEnter,
  lastInputRef
}) => {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
  const total = countedCash !== undefined ? countedCash : calculateCountedCash(denominationCounts)
  const isAllZero = Object.values(denominationCounts || {}).every((v) => !v || v === 0)

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        if (idx > 0) {
          inputRefs.current[idx - 1]?.focus()
          inputRefs.current[idx - 1]?.select()
        }
      } else {
        if (idx < CHILEAN_DENOMINATIONS.length - 1) {
          inputRefs.current[idx + 1]?.focus()
          inputRefs.current[idx + 1]?.select()
        } else if (onLastEnter) {
          onLastEnter()
        }
      }
    }
  }

  const badgeStyles = {
    slate: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600',
    lilac: 'bg-lilac-50 dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 border-lilac-200 dark:border-slate-600',
    emerald: 'bg-emerald-50 dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-slate-600',
    amber: 'bg-amber-50 dark:bg-slate-700 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-slate-600'
  }[badgeVariant]

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-3 flex-1 select-none">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700/80 pb-2.5 flex items-start justify-between gap-2 min-h-[50px]">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-lilac-600 dark:text-lilac-400 shrink-0" />
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {badgeLabel && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyles}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {readOnly && isAllZero && emptyMessage ? (
        <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 my-auto">
          <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 tabular-nums">Total registrado: {formatCLP(total)}</p>
        </div>
      ) : (
        /* Tabla de 3 Columnas */
        <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-bold">
              <tr className="h-9">
                <th className="px-3 w-5/12 align-middle">Denominación</th>
                <th className="px-3 w-3/12 text-center align-middle">Cantidad</th>
                <th className="px-3 w-4/12 text-right align-middle">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 bg-white dark:bg-slate-850">
              {CHILEAN_DENOMINATIONS.map((d, idx) => {
                const count = denominationCounts?.[d.value] || 0
                const subtotal = d.value * count
                return (
                  <tr key={d.value} className="h-10 hover:bg-slate-50/70 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 font-semibold text-slate-800 dark:text-slate-200 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{d.label}</span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            d.type === 'bill'
                              ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50'
                              : 'bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50'
                          }`}
                        >
                          {d.type === 'bill' ? 'Billete' : 'Moneda'}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 text-center align-middle">
                      {readOnly ? (
                        <div className="h-7 flex items-center justify-center">
                          <span className="font-mono tabular-nums font-bold text-xs text-slate-800 dark:text-slate-200">
                            {count > 0 ? `${count} un.` : '—'}
                          </span>
                        </div>
                      ) : (
                        <div className="h-7 inline-flex items-center gap-1 justify-center">
                          <input
                            ref={(el) => {
                              inputRefs.current[idx] = el
                              if (idx === CHILEAN_DENOMINATIONS.length - 1 && lastInputRef) {
                                (lastInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
                              }
                            }}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={count || ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                              onDenominationChange?.(d.value, isNaN(val) ? 0 : Math.max(0, val))
                            }}
                            onKeyDown={(e) => handleKeyDown(idx, e)}
                            onFocus={(e) => e.target.select()}
                            aria-label={`Cantidad de ${d.label}`}
                            className="w-16 h-7 px-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:border-lilac-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">un.</span>
                        </div>
                      )}
                    </td>

                    <td className="px-3 text-right align-middle">
                      <span
                        className={`text-xs font-bold font-mono tabular-nums ${
                          subtotal > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      >
                        {formatCLP(subtotal)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {!hideFooter && (
              <tfoot className="bg-lilac-50/60 dark:bg-slate-900/90 border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                <tr className="h-10">
                  <td colSpan={2} className="px-3 text-slate-800 dark:text-slate-200 text-xs font-semibold align-middle">
                    {footerLabel}
                  </td>
                  <td className="px-3 text-right text-sm font-black text-lilac-800 dark:text-lilac-300 font-mono tabular-nums align-middle">
                    {formatCLP(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
