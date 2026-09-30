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
  footerLabel = 'Total Efectivo Físico'
}) => {
  const total = countedCash !== undefined ? countedCash : calculateCountedCash(denominationCounts)
  const isAllZero = Object.values(denominationCounts || {}).every((v) => !v || v === 0)

  const badgeStyles = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    lilac: 'bg-lilac-50 text-lilac-700 border-lilac-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200'
  }[badgeVariant]

  return (
    <div className="bg-white border border-lilac-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3 flex-1 select-none">
      {/* Header */}
      <div className="border-b border-slate-100 pb-2.5 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-4 h-4 text-lilac-600 shrink-0" />
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {badgeLabel && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyles}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {readOnly && isAllZero && emptyMessage ? (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 my-auto">
          <p className="font-semibold text-slate-700 mb-1">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400">Total registrado: {formatCLP(total)}</p>
        </div>
      ) : (
        /* Tabla de 3 Columnas */
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2 px-3 w-5/12">Denominación</th>
                <th className="py-2 px-3 w-3/12 text-center">Cantidad</th>
                <th className="py-2 px-3 w-4/12 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {CHILEAN_DENOMINATIONS.map((d) => {
                const count = denominationCounts?.[d.value] || 0
                const subtotal = d.value * count
                return (
                  <tr key={d.value} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-1.5 px-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{d.label}</span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                            d.type === 'bill'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {d.type === 'bill' ? 'Billete' : 'Moneda'}
                        </span>
                      </div>
                    </td>

                    <td className="py-1.5 px-3 text-center">
                      {readOnly ? (
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {count > 0 ? `${count} un.` : '—'}
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={count || ''}
                            onChange={(e) =>
                              onDenominationChange?.(d.value, parseInt(e.target.value, 10))
                            }
                            className="w-16 px-2 py-1 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg bg-slate-50 text-center focus:outline-none focus:bg-white focus:border-lilac-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">un.</span>
                        </div>
                      )}
                    </td>

                    <td className="py-1.5 px-3 text-right">
                      <span
                        className={`text-xs font-bold font-mono ${
                          subtotal > 0 ? 'text-slate-900' : 'text-slate-300'
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
              <tfoot className="bg-lilac-50/60 border-t-2 border-lilac-200 font-bold">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-slate-800 text-xs uppercase tracking-wide">
                    {footerLabel}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-black text-lilac-800 font-mono">
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
