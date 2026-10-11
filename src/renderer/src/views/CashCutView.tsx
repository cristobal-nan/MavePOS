import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  RotateCcw,
  AlertTriangle,
  Clock,
  X
} from 'lucide-react'
import { useCashStore } from '../store/cashStore'
import { groupSessionsByDay } from '../utils/formatters'
import { ActiveCashCutTab } from './cashCut/ActiveCashCutTab'
import { CashCutHistoryTab } from './cashCut/CashCutHistoryTab'

type CashCutTab = 'active' | 'history'

export const CashCutView: React.FC = () => {
  const {
    currentSession,
    pastSessions,
    fetchSummary,
    fetchPastSessions,
    error,
    clearError,
    activeCutDraft,
    resetCutDraft
  } = useCashStore()

  const [activeTab, setActiveTab] = useState<CashCutTab>('active')
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)

  const dailyRecordsCount = useMemo(() => {
    return groupSessionsByDay(pastSessions).length
  }, [pastSessions])

  const isDraftEmpty = useMemo(() => {
    const { denominationCounts, notes, cardMachineInput, transferVerifiedInput } = activeCutDraft
    const hasDenominations = Object.values(denominationCounts || {}).some((v) => v > 0)
    return !hasDenominations && !notes.trim() && !cardMachineInput.trim() && !transferVerifiedInput.trim()
  }, [activeCutDraft])

  useEffect(() => {
    if (currentSession?.id) {
      fetchSummary(currentSession.id)
    }
    fetchPastSessions()
  }, [currentSession?.id, activeTab])

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-lilac-100 dark:border-slate-700 px-4 sm:px-6 pt-3 gap-2 pb-0 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shadow-inner shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                Corte de Caja
              </h1>
            </div>
          </div>

          {/* Actions & Alerts */}
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {currentSession && activeTab === 'active' && (
              <button
                type="button"
                onClick={() => {
                  if (!isDraftEmpty) {
                    setIsConfirmClearOpen(true)
                  }
                }}
                disabled={isDraftEmpty}
                title={isDraftEmpty ? 'No hay campos que limpiar' : 'Limpiar conteo físico, montos y observaciones'}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isDraftEmpty
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-rose-50 dark:bg-slate-800 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40 active:scale-95 cursor-pointer'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Campos</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-transparent -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 cursor-pointer ${
              activeTab === 'active'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Corte de Turno Actual</span>
            {currentSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'border-lilac-600 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Registros Diarios</span>
            {dailyRecordsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 leading-none">
                {dailyRecordsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Sub-modules */}
      {activeTab === 'active' ? (
        <ActiveCashCutTab onSwitchToHistory={() => setActiveTab('history')} />
      ) : (
        <CashCutHistoryTab />
      )}

      {/* Modal de confirmación para limpiar campos */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Limpiar campos del arqueo?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sesión #{currentSession?.id}</p>
              </div>
            </div>

            <div className="bg-rose-50/50 dark:bg-slate-800/80 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl p-4 text-xs flex flex-col gap-2">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Se borrarán las cantidades físicas de billetes y monedas contadas, el total de máquina POS, transferencias y las observaciones ingresadas en este turno.
              </p>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                Esta acción no se puede deshacer.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCutDraft()
                  setIsConfirmClearOpen(false)
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Campos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
