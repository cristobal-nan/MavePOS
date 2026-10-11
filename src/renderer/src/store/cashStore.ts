import { create } from 'zustand'
import { CashSession, CashCutSummary, CloseCashSessionInput } from '@shared/types'
import { useSalesStore } from './salesStore'

export interface ActiveCashCutDraft {
  denominationCounts: Record<number, number>
  notes: string
  cardMachineInput: string
  transferVerifiedInput: string
}

export const DEFAULT_DENOMINATION_COUNTS: Record<number, number> = {
  20000: 0,
  10000: 0,
  5000: 0,
  2000: 0,
  1000: 0,
  500: 0,
  100: 0,
  50: 0,
  10: 0
}

export const DEFAULT_CASH_CUT_DRAFT: ActiveCashCutDraft = {
  denominationCounts: DEFAULT_DENOMINATION_COUNTS,
  notes: '',
  cardMachineInput: '',
  transferVerifiedInput: ''
}

function loadDraftFromStorage(sessionId?: number | null): ActiveCashCutDraft {
  if (!sessionId) return { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`cash_cut_draft_${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          denominationCounts: {
            ...DEFAULT_DENOMINATION_COUNTS,
            ...(parsed.denominationCounts || {})
          },
          notes: typeof parsed.notes === 'string' ? parsed.notes : '',
          cardMachineInput: typeof parsed.cardMachineInput === 'string' ? parsed.cardMachineInput : '',
          transferVerifiedInput: typeof parsed.transferVerifiedInput === 'string' ? parsed.transferVerifiedInput : ''
        }
      }
    }
  } catch (e) {
    console.error('Error cargando borrador de corte de caja de almacenamiento:', e)
  }
  return { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
}

function saveDraftToStorage(sessionId?: number | null, draft?: ActiveCashCutDraft): void {
  if (!sessionId || !draft) return
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`cash_cut_draft_${sessionId}`, JSON.stringify(draft))
    }
  } catch (e) {
    console.error('Error guardando borrador de corte de caja en almacenamiento:', e)
  }
}

function clearDraftFromStorage(sessionId?: number | null): void {
  if (!sessionId) return
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`cash_cut_draft_${sessionId}`)
    }
  } catch (e) {
    console.error('Error limpiando borrador de corte de caja:', e)
  }
}

interface CashState {
  currentSession: CashSession | null
  currentSummary: CashCutSummary | null
  pastSessions: CashSession[]
  isLoading: boolean
  isSummaryLoading: boolean
  error: string | null

  // Estado persistente del arqueo/corte en curso
  activeCutDraft: ActiveCashCutDraft
  setDenominationCount: (denomination: number, count: number) => void
  setCutNotes: (notes: string) => void
  setCardMachineInput: (val: string) => void
  setTransferVerifiedInput: (val: string) => void
  resetCutDraft: () => void

  // Actions
  checkCurrentSession: () => Promise<void>
  fetchSummary: (sessionId: number) => Promise<void>
  fetchPastSessions: () => Promise<void>
  openSession: (openingFund: number, openingDenominations?: Record<number, number>) => Promise<boolean>
  closeSession: (
    sessionId: number,
    closingData?: Omit<CloseCashSessionInput, 'sessionId'>
  ) => Promise<boolean>
  discardSession: (sessionId: number) => Promise<boolean>
  clearError: () => void
  getLastClosedSession: () => Promise<CashSession | null>
  completedCutReceipt: any | null
  setCompletedCutReceipt: (data: any | null) => void
}

export const useCashStore = create<CashState>((set, get) => ({
  currentSession: null,
  currentSummary: null,
  completedCutReceipt: null,
  setCompletedCutReceipt: (data) => set({ completedCutReceipt: data }),
  pastSessions: [],
  isLoading: true,
  isSummaryLoading: false,
  error: null,

  activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } },

  setDenominationCount: (value: number, count: number) => {
    const current = get().activeCutDraft
    const nextCounts = {
      ...current.denominationCounts,
      [value]: Math.max(0, isNaN(count) ? 0 : count)
    }
    const nextDraft = { ...current, denominationCounts: nextCounts }
    set({ activeCutDraft: nextDraft })
    saveDraftToStorage(get().currentSession?.id, nextDraft)
  },

  setCutNotes: (notes: string) => {
    const nextDraft = { ...get().activeCutDraft, notes }
    set({ activeCutDraft: nextDraft })
    saveDraftToStorage(get().currentSession?.id, nextDraft)
  },

  setCardMachineInput: (cardMachineInput: string) => {
    const nextDraft = { ...get().activeCutDraft, cardMachineInput }
    set({ activeCutDraft: nextDraft })
    saveDraftToStorage(get().currentSession?.id, nextDraft)
  },

  setTransferVerifiedInput: (transferVerifiedInput: string) => {
    const nextDraft = { ...get().activeCutDraft, transferVerifiedInput }
    set({ activeCutDraft: nextDraft })
    saveDraftToStorage(get().currentSession?.id, nextDraft)
  },

  resetCutDraft: () => {
    clearDraftFromStorage(get().currentSession?.id)
    set({
      activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
    })
  },

  clearError: () => set({ error: null }),

  checkCurrentSession: async () => {
    set({ isLoading: true, error: null })
    try {
      if (window.api?.cash?.getCurrentSession) {
        const session = await window.api.cash.getCurrentSession()
        const draft = session ? loadDraftFromStorage(session.id) : { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
        set({ currentSession: session, activeCutDraft: draft, isLoading: false })
        if (session) {
          await get().fetchSummary(session.id)
        }
      } else {
        set({
          currentSession: null,
          activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } },
          isLoading: false
        })
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

  openSession: async (openingFund: number, openingDenominations?: Record<number, number>) => {
    set({ error: null })
    try {
      if (!window.api?.cash?.openSession) {
        throw new Error('API no disponible')
      }
      const session = await window.api.cash.openSession(openingFund, openingDenominations)
      clearDraftFromStorage(session.id)
      set({
        currentSession: session,
        activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
      })
      await get().fetchSummary(session.id)
      return true
    } catch (err: any) {
      console.error('Error abriendo sesión de caja:', err)
      set({ error: err.message || 'Error al abrir caja' })
      return false
    }
  },

  getLastClosedSession: async () => {
    try {
      if (!window.api?.cash?.getLastClosedSession) return null
      return await window.api.cash.getLastClosedSession()
    } catch (err: any) {
      console.error('Error al obtener última sesión cerrada:', err)
      return null
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
      clearDraftFromStorage(sessionId)
      set({
        currentSession: null,
        currentSummary: null,
        activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
      })
      useSalesStore.getState().resetTickets()
      await get().fetchPastSessions()
      return true
    } catch (err: any) {
      console.error('Error cerrando sesión de caja:', err)
      set({ error: err.message || 'Error al cerrar caja' })
      return false
    }
  },

  discardSession: async (sessionId: number) => {
    set({ error: null })
    try {
      if (!window.api?.cash?.discardSession) {
        throw new Error('API no disponible')
      }
      await window.api.cash.discardSession(sessionId)
      clearDraftFromStorage(sessionId)
      set({
        currentSession: null,
        currentSummary: null,
        activeCutDraft: { ...DEFAULT_CASH_CUT_DRAFT, denominationCounts: { ...DEFAULT_DENOMINATION_COUNTS } }
      })
      useSalesStore.getState().resetTickets()
      await get().fetchPastSessions()
      return true
    } catch (err: any) {
      console.error('Error descartando sesión de caja sin registrar:', err)
      set({ error: err.message || 'Error al cerrar caja sin registrar' })
      return false
    }
  }
}))
