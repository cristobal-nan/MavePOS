import { create } from 'zustand'

export interface DirtyFieldChange {
  field: string
  value: string
}

export type PendingNavigation =
  | { type: 'subtab'; target: string }
  | { type: 'mainTab'; target: string }

interface SettingsState {
  isDirty: boolean
  dirtyChanges: DirtyFieldChange[]
  saveHandler: (() => Promise<boolean>) | null
  discardHandler: (() => void) | null
  isSaving: boolean
  showUnsavedModal: boolean
  pendingNavigation: PendingNavigation | null
  toastMessage: string | null

  // Actions
  registerSubTabState: (
    isDirty: boolean,
    changes: DirtyFieldChange[],
    saveFn: () => Promise<boolean>,
    discardFn: () => void
  ) => void
  clearSubTabState: () => void
  saveCurrentSettings: () => Promise<boolean>
  discardCurrentSettings: () => void
  setPendingNavigation: (nav: PendingNavigation | null) => void
  setShowUnsavedModal: (show: boolean) => void
  setToastMessage: (msg: string | null) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isDirty: false,
  dirtyChanges: [],
  saveHandler: null,
  discardHandler: null,
  isSaving: false,
  showUnsavedModal: false,
  pendingNavigation: null,
  toastMessage: null,

  registerSubTabState: (isDirty, changes, saveFn, discardFn) => {
    set({
      isDirty,
      dirtyChanges: changes,
      saveHandler: saveFn,
      discardHandler: discardFn
    })
  },

  clearSubTabState: () => {
    set({
      isDirty: false,
      dirtyChanges: [],
      saveHandler: null,
      discardHandler: null
    })
  },

  saveCurrentSettings: async () => {
    const { saveHandler } = get()
    if (!saveHandler) return false

    set({ isSaving: true })
    try {
      const ok = await saveHandler()
      if (ok) {
        set({
          isDirty: false,
          dirtyChanges: [],
          isSaving: false,
          toastMessage: 'Cambios realizados correctamente'
        })
        setTimeout(() => {
          if (get().toastMessage === 'Cambios realizados correctamente') {
            set({ toastMessage: null })
          }
        }, 3500)
        return true
      }
    } catch (err) {
      console.error('Error guardando configuración:', err)
    } finally {
      set({ isSaving: false })
    }
    return false
  },

  discardCurrentSettings: () => {
    const { discardHandler } = get()
    if (discardHandler) {
      discardHandler()
    }
    set({
      isDirty: false,
      dirtyChanges: [],
      showUnsavedModal: false,
      pendingNavigation: null
    })
  },

  setPendingNavigation: (nav) => set({ pendingNavigation: nav }),
  setShowUnsavedModal: (show) => set({ showUnsavedModal: show }),
  setToastMessage: (msg) => set({ toastMessage: msg })
}))
