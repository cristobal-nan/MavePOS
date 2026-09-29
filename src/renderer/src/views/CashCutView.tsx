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
      {/* Top Bar with Subtabs */}
      <div className="bg-white border-b border-lilac-200 px-6 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'active'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Corte de Turno Actual</span>
            {currentSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'bg-lilac-600 text-white shadow-md shadow-lilac-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historial de Cortes</span>
            {pastSessions.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pastSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* Refresh and Alerts */}
        <div className="flex items-center gap-3">
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

      {/* Main Content Sub-modules */}
      {activeTab === 'active' ? (
        <ActiveCashCutTab onSwitchToHistory={() => setActiveTab('history')} />
      ) : (
        <CashCutHistoryTab />
      )}
    </div>
  )
}
