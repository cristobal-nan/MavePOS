import { create } from 'zustand'
import { TabId } from '../components/NavigationTabs'

export type CloseModalStep = 'closed' | 'ask_cash_close' | 'countdown_backup'

interface UIState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  closeModalStep: CloseModalStep
  openCloseModal: (step?: CloseModalStep) => void
  closeCloseModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'ventas',
  setActiveTab: (tab) => set({ activeTab: tab }),
  closeModalStep: 'closed',
  openCloseModal: (step = 'ask_cash_close') => set({ closeModalStep: step }),
  closeCloseModal: () => set({ closeModalStep: 'closed' })
}))
