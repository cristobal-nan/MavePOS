import React from 'react'
import { Coins, CheckCircle2, XCircle } from 'lucide-react'
import { formatCLP } from '../../utils/formatters'
import { CHILEAN_DENOMINATIONS } from '@shared/finance'
export { CHILEAN_DENOMINATIONS }

interface DenominationsCalculatorProps {
  denominationCounts: Record<number, number>
  onDenominationChange: (value: number, count: number) => void
  countedCash: number
  expectedCash: number
  difference: number
}

export const DenominationsCalculator: React.FC<DenominationsCalculatorProps> = ({
  denominationCounts,
  onDenominationChange,
  countedCash,
  expectedCash,
  difference
}) => {
  return (
    <div className="bg-white border border-lilac-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="border-b border-slate-100 pb-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Coins className="w-4 h-4 text-lilac-600" />
          <span>Arqueo Físico de Efectivo (Calculadora de Billetes y Monedas)</span>
        </h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Ingresa la cantidad física de cada billete y moneda encontrada en el cajón monetario.
        </p>
      </div>

      {/* Tabla de 3 Columnas: Monto | Cantidad | Total */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
            <tr>
              <th className="py-2.5 px-4 w-1/3">Monto (Billete / Moneda)</th>
              <th className="py-2.5 px-4 w-1/3 text-center">Cantidad</th>
              <th className="py-2.5 px-4 w-1/3 text-right">Total ($ CLP)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {CHILEAN_DENOMINATIONS.map((d) => {
              const count = denominationCounts[d.value] || 0
              const subtotal = d.value * count
              return (
                <tr key={d.value} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{d.label}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.type === 'bill'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {d.type === 'bill' ? 'Billete' : 'Moneda'}
                      </span>
                    </div>
                  </td>

                  <td className="py-2 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 max-w-[140px] w-full justify-center">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={count || ''}
                        onChange={(e) =>
                          onDenominationChange(d.value, parseInt(e.target.value, 10))
                        }
                        className="w-24 px-3 py-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-xl bg-slate-50 text-center focus:outline-none focus:bg-white focus:border-lilac-500 focus:ring-2 focus:ring-lilac-500/20"
                      />
                      <span className="text-[11px] text-slate-400 font-medium">un.</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <span
                      className={`text-sm font-bold ${
                        subtotal > 0 ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {formatCLP(subtotal)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-lilac-50/50 border-t-2 border-lilac-200 font-bold">
            <tr>
              <td colSpan={2} className="py-3 px-4 text-slate-800 text-xs uppercase tracking-wider">
                Total Efectivo Físico Contado
              </td>
              <td className="py-3 px-4 text-right text-base font-black text-lilac-800">
                {formatCLP(countedCash)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Comparador de Cuadre: Esperado vs Real */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              Efectivo Esperado
            </span>
            <span className="text-lg font-bold text-slate-800">
              {formatCLP(expectedCash)}
            </span>
          </div>

          <div className="text-slate-300 text-xl font-light">vs</div>

          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              Efectivo Contado Real
            </span>
            <span className="text-lg font-black text-slate-900">
              {formatCLP(countedCash)}
            </span>
          </div>
        </div>

        {/* Badge de Diferencia */}
        <div>
          {difference === 0 ? (
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Caja Cuadrada Exacta ($ 0)</span>
            </div>
          ) : difference > 0 ? (
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Sobrante en Caja: +{formatCLP(difference)}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Faltante en Caja: −{formatCLP(Math.abs(difference))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
