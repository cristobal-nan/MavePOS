import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  RotateCcw,
  AlertTriangle,
  Clock,
  X,
  Archive,
  Loader2,
  CheckCircle2
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
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false)
  const [drawerFeedback, setDrawerFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleOpenDrawer = async (): Promise<void> => {
    setIsOpeningDrawer(true)
    setDrawerFeedback(null)
    try {
      const res = await window.api.openCashDrawer()
      if (!res.success) {
        setDrawerFeedback({
          type: 'error',
          text: res.error || 'No se pudo abrir el cajón. Verifica la impresora térmica en Configuración.'
        })
      } else {
        setDrawerFeedback({
          type: 'success',
          text: 'Pulso de apertura enviado al cajón.'
        })
      }
    } catch (err: any) {
      setDrawerFeedback({
        type: 'error',
        text: err.message || 'Error al enviar señal al cajón de dinero.'
      })
    } finally {
      setIsOpeningDrawer(false)
    }
  }

  useEffect(() => {
    if (!drawerFeedback) return
    const timer = setTimeout(() => setDrawerFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [drawerFeedback])

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
              <>
                <button
                  type="button"
                  onClick={handleOpenDrawer}
                  disabled={isOpeningDrawer}
                  title="Abrir cajón de dinero (emitir pulso de apertura a la impresora)"
                  className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 dark:active:bg-amber-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {isOpeningDrawer ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  ) : (
                    <Archive className="w-3.5 h-3.5 text-slate-950" />
                  )}
                  <span>{isOpeningDrawer ? 'Abriendo...' : 'Abrir Cajón'}</span>
                </button>

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
              </>
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
      {/* Toast Flotante Fijo para Feedback de Cajón (Cero Layout Shift) */}
      {drawerFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
              drawerFeedback.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-950/20'
            }`}
          >
            {drawerFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0" />
            )}
            <span>{drawerFeedback.text}</span>
            <button
              type="button"
              onClick={() => setDrawerFeedback(null)}
              className="ml-2 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
