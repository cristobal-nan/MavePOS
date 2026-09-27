import { create } from 'zustand'
import { CashSession } from '@shared/types'

interface CashState {
  currentSession: CashSession | null
  isLoading: boolean
  error: string | null
  checkCurrentSession: () => Promise<void>
  openSession: (openingFund: number) => Promise<boolean>
  closeSession: (sessionId: number) => Promise<boolean>
  clearError: () => void
}

export const useCashStore = create<CashState>((set) => ({
  currentSession: null,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  checkCurrentSession: async () => {
    set({ isLoading: true, error: null })
    try {
      if (window.api?.getCurrentCashSession) {
        const session = await window.api.getCurrentCashSession()
        set({ currentSession: session, isLoading: false })
      } else {
        set({ currentSession: null, isLoading: false })
      }
    } catch (err: any) {
      console.error('Error verificando sesión de caja:', err)
      set({ error: err.message || 'Error al verificar sesión de caja', isLoading: false })
    }
  },

  openSession: async (openingFund: number) => {
    set({ error: null })
    try {
      if (!window.api?.openCashSession) {
        throw new Error('API no disponible')
      }
      const session = await window.api.openCashSession(openingFund)
      set({ currentSession: session })
      return true
    } catch (err: any) {
      console.error('Error abriendo sesión de caja:', err)
      set({ error: err.message || 'Error al abrir caja' })
      return false
    }
  },

  closeSession: async (sessionId: number) => {
    set({ error: null })
    try {
      if (!window.api?.closeCashSession) {
        throw new Error('API no disponible')
      }
      await window.api.closeCashSession(sessionId)
      set({ currentSession: null })
      return true
    } catch (err: any) {
      console.error('Error cerrando sesión de caja:', err)
      set({ error: err.message || 'Error al cerrar caja' })
      return false
    }
  }
}))
