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
import { ViewHeader } from '../components/common/ViewHeader'
import { SubTabs, SubTabItem } from '../components/common/SubTabs'
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

  useEffect(() => {
    if (!isConfirmClearOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsConfirmClearOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConfirmClearOpen])

  const subTabItems: SubTabItem<CashCutTab>[] = useMemo(() => [
    {
      id: 'active',
      label: 'Corte de Turno Actual',
      icon: Calculator,
      badge: currentSession ? 'Activo' : undefined
    },
    {
      id: 'history',
      label: 'Registros Diarios',
      icon: Clock,
      badge: dailyRecordsCount > 0 ? dailyRecordsCount : undefined
    }
  ], [currentSession, dailyRecordsCount])

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      {/* Top Header Canónico */}
      <ViewHeader
        title="Corte de Caja"
        icon={Calculator}
        badge={
          currentSession ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sesión #{currentSession.id}
            </span>
          ) : undefined
        }
        primaryAction={
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  aria-label="Cerrar notificación de error"
                  className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded"
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
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500 ${
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
        }
      />

      {/* SubTabs Canónicas */}
      <div className="px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center shrink-0 h-11 sm:h-12">
        <SubTabs
          tabs={subTabItems}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          ariaLabel="Secciones de corte de caja"
        />
      </div>

      {/* Main Content Sub-modules */}
      {activeTab === 'active' ? (
        <ActiveCashCutTab onSwitchToHistory={() => setActiveTab('history')} />
      ) : (
        <CashCutHistoryTab />
      )}

      {/* Modal de confirmación para limpiar campos */}
      {isConfirmClearOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-draft-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 id="clear-draft-title" className="text-base font-bold text-slate-900 dark:text-white">
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCutDraft()
                  setIsConfirmClearOpen(false)
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
