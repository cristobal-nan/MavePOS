import { create } from 'zustand'
import { TabId } from '../components/NavigationTabs'
import {
  ThemeId,
  DEFAULT_THEME_ID,
  applyTheme,
  SurfaceMode,
  DEFAULT_SURFACE_MODE,
  applySurfaceMode
} from '../theme/themes'

export type CloseModalStep = 'closed' | 'ask_cash_close' | 'countdown_backup'

interface UIState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  closeModalStep: CloseModalStep
  openCloseModal: (step?: CloseModalStep) => void
  closeCloseModal: () => void
  currentTheme: ThemeId
  setTheme: (themeId: ThemeId) => Promise<void>
  loadTheme: () => Promise<void>
  surfaceMode: SurfaceMode
  setSurfaceMode: (mode: SurfaceMode) => Promise<void>
  loadSurfaceMode: () => Promise<void>
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'ventas',
  setActiveTab: (tab) => set({ activeTab: tab }),
  closeModalStep: 'closed',
  openCloseModal: (step = 'ask_cash_close') => set({ closeModalStep: step }),
  closeCloseModal: () => set({ closeModalStep: 'closed' }),
  currentTheme: DEFAULT_THEME_ID,
  setTheme: async (themeId: ThemeId) => {
    applyTheme(themeId)
    set({ currentTheme: themeId })
    try {
      await window.api.setSetting('app_theme', themeId)
    } catch (e) {
      console.error('Error guardando configuración de tema:', e)
    }
  },
  loadTheme: async () => {
    try {
      const savedTheme = (await window.api.getSetting('app_theme')) as ThemeId | null
      const themeToApply = savedTheme || DEFAULT_THEME_ID
      applyTheme(themeToApply)
      set({ currentTheme: themeToApply })
    } catch {
      applyTheme(DEFAULT_THEME_ID)
      set({ currentTheme: DEFAULT_THEME_ID })
    }
  },
  surfaceMode: DEFAULT_SURFACE_MODE,
  setSurfaceMode: async (mode: SurfaceMode) => {
    applySurfaceMode(mode)
    set({ surfaceMode: mode })
    try {
      await window.api.setSetting('app_surface_mode', mode)
    } catch (e) {
      console.error('Error guardando configuración de modo de superficie:', e)
    }
  },
  loadSurfaceMode: async () => {
    try {
      const saved = (await window.api.getSetting('app_surface_mode')) as SurfaceMode | null
      const modeToApply =
        saved && ['light', 'dark', 'system'].includes(saved) ? saved : DEFAULT_SURFACE_MODE
      applySurfaceMode(modeToApply)
      set({ surfaceMode: modeToApply })
    } catch {
      applySurfaceMode(DEFAULT_SURFACE_MODE)
      set({ surfaceMode: DEFAULT_SURFACE_MODE })
    }
  }
}))
