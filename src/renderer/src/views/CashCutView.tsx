import React, { useState, useEffect } from 'react'
import {
  Calculator,
  RotateCcw,
  AlertTriangle,
  Clock,
  X
} from 'lucide-react'
import { useCashStore } from '../store/cashStore'
import { ActiveCashCutTab } from './cashCut/ActiveCashCutTab'
import { CashCutHistoryTab } from './cashCut/CashCutHistoryTab'

type CashCutTab = 'active' | 'history'

export const CashCutView: React.FC = () => {
  const {
    currentSession,
    pastSessions,
    isSummaryLoading,
    fetchSummary,
    fetchPastSessions,
    error,
    clearError
  } = useCashStore()

  const [activeTab, setActiveTab] = useState<CashCutTab>('active')

  useEffect(() => {
    if (currentSession?.id) {
      fetchSummary(currentSession.id)
    }
    fetchPastSessions()
  }, [currentSession?.id])

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="bg-white border-b border-lilac-100 px-4 sm:px-6 pt-3 gap-2 pb-0 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shadow-inner shrink-0">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Corte de Caja
              </h1>
            </div>
          </div>

          {/* Refresh and Alerts */}
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-rose-500 hover:text-rose-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {currentSession && (
              <button
                type="button"
                onClick={() => fetchSummary(currentSession.id)}
                disabled={isSummaryLoading}
                className="px-3 py-1.5 rounded-lg bg-lilac-50 border border-lilac-200 text-lilac-700 hover:bg-lilac-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar Resumen</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-transparent -mb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'active'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
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
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historial de Cortes</span>
            {pastSessions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 text-lilac-700 leading-none">
                {pastSessions.length}
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
    </div>
  )
}
