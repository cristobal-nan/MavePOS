import { create } from 'zustand'
import { CashSession, CashCutSummary, CloseCashSessionInput } from '@shared/types'

interface CashState {
  currentSession: CashSession | null
  currentSummary: CashCutSummary | null
  pastSessions: CashSession[]
  isLoading: boolean
  isSummaryLoading: boolean
  error: string | null

  // Actions
  checkCurrentSession: () => Promise<void>
  fetchSummary: (sessionId: number) => Promise<void>
  fetchPastSessions: () => Promise<void>
  openSession: (openingFund: number) => Promise<boolean>
  closeSession: (
    sessionId: number,
    closingData?: Omit<CloseCashSessionInput, 'sessionId'>
  ) => Promise<boolean>
  clearError: () => void
}

export const useCashStore = create<CashState>((set, get) => ({
  currentSession: null,
  currentSummary: null,
  pastSessions: [],
  isLoading: true,
  isSummaryLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  checkCurrentSession: async () => {
    set({ isLoading: true, error: null })
    try {
      if (window.api?.cash?.getCurrentSession) {
        const session = await window.api.cash.getCurrentSession()
        set({ currentSession: session, isLoading: false })
        if (session) {
          await get().fetchSummary(session.id)
        }
      } else {
        set({ currentSession: null, isLoading: false })
      }
    } catch (err: any) {
      console.error('Error verificando sesión de caja:', err)
      set({ error: err.message || 'Error al verificar sesión de caja', isLoading: false })
    }
  },

  fetchSummary: async (sessionId: number) => {
    set({ isSummaryLoading: true, error: null })
    try {
      if (!window.api?.cash?.getSessionSummary) {
        throw new Error('API no disponible')
      }
      const summary = await window.api.cash.getSessionSummary(sessionId)
      set({ currentSummary: summary, isSummaryLoading: false })
    } catch (err: any) {
      console.error('Error al cargar resumen de corte de caja:', err)
      set({ error: err.message || 'Error al obtener resumen de caja', isSummaryLoading: false })
    }
  },

  fetchPastSessions: async () => {
    try {
      if (!window.api?.cash?.getPastSessions) return
      const past = await window.api.cash.getPastSessions(50, 0)
      set({ pastSessions: past })
    } catch (err: any) {
      console.error('Error al cargar sesiones históricas:', err)
    }
  },

  openSession: async (openingFund: number) => {
    set({ error: null })
    try {
      if (!window.api?.cash?.openSession) {
        throw new Error('API no disponible')
      }
      const session = await window.api.cash.openSession(openingFund)
      set({ currentSession: session })
      await get().fetchSummary(session.id)
      return true
    } catch (err: any) {
      console.error('Error abriendo sesión de caja:', err)
      set({ error: err.message || 'Error al abrir caja' })
      return false
    }
  },

  closeSession: async (
    sessionId: number,
    closingData?: Omit<CloseCashSessionInput, 'sessionId'>
  ) => {
    set({ error: null })
    try {
      if (!window.api?.cash?.closeSession) {
        throw new Error('API no disponible')
      }
      await window.api.cash.closeSession(sessionId, closingData)
      set({ currentSession: null, currentSummary: null })
      await get().fetchPastSessions()
      return true
    } catch (err: any) {
      console.error('Error cerrando sesión de caja:', err)
      set({ error: err.message || 'Error al cerrar caja' })
      return false
    }
  }
}))
