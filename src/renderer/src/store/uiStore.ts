import { create } from 'zustand'
import { TabId } from '../components/NavigationTabs'

interface UIState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'ventas',
  setActiveTab: (tab) => set({ activeTab: tab })
}))
