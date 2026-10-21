import { create } from 'zustand'
import {
  AppEdition,
  LicenseStatus,
  LicenseValidationResult,
  ActivateLicenseResult
} from '@shared/types'

interface LicenseState {
  machineId: string
  edition: AppEdition
  topology: 'single' | 'multi'
  isActivated: boolean
  licenseKey: string | null
  activatedAt: string | null
  isLoading: boolean
  isActivating: boolean
  error: string | null

  // Actions
  loadLicense: () => Promise<LicenseStatus | null>
  validateKey: (key: string) => Promise<LicenseValidationResult>
  activateKey: (key: string) => Promise<ActivateLicenseResult>
  deactivateLicense: () => Promise<{ success: boolean }>
}

export const useLicenseStore = create<LicenseState>((set) => ({
  machineId: '',
  edition: 'pos',
  topology: 'single',
  isActivated: false,
  licenseKey: null,
  activatedAt: null,
  isLoading: false,
  isActivating: false,
  error: null,

  loadLicense: async () => {
    set({ isLoading: true, error: null })
    try {
      if (typeof window !== 'undefined' && window.api?.license) {
        const status = await window.api.license.getStatus()
        set({
          machineId: status.machineId,
          edition: status.edition,
          topology: status.topology,
          isActivated: status.isActivated,
          licenseKey: status.licenseKey,
          activatedAt: status.activatedAt || null,
          isLoading: false
        })
        return status
      }
    } catch (err: any) {
      console.error('Error al cargar estado de licencia:', err)
      set({ error: err.message || 'Error al cargar licencia', isLoading: false })
    }
    set({ isLoading: false })
    return null
  },

  validateKey: async (key: string) => {
    if (typeof window !== 'undefined' && window.api?.license) {
      return await window.api.license.validateKey(key)
    }
    return { valid: false, error: 'invalid_format', message: 'API de licencia no disponible' }
  },

  activateKey: async (key: string) => {
    set({ isActivating: true, error: null })
    try {
      if (typeof window !== 'undefined' && window.api?.license) {
        const result = await window.api.license.activate(key)
        if (result.success && result.status) {
          set({
            machineId: result.status.machineId,
            edition: result.status.edition,
            topology: result.status.topology,
            isActivated: result.status.isActivated,
            licenseKey: result.status.licenseKey,
            activatedAt: result.status.activatedAt || null,
            isActivating: false,
            error: null
          })
        } else {
          set({ isActivating: false, error: result.message || 'Error al activar clave' })
        }
        return result
      }
      return { success: false, message: 'API de licencia no disponible' }
    } catch (err: any) {
      set({ isActivating: false, error: err.message || 'Error inesperado al activar' })
      return { success: false, message: err.message }
    }
  },

  deactivateLicense: async () => {
    set({ isLoading: true, error: null })
    try {
      if (typeof window !== 'undefined' && window.api?.license) {
        const res = await window.api.license.deactivate()
        if (res.success) {
          set({
            edition: 'pos',
            topology: 'single',
            isActivated: false,
            licenseKey: null,
            activatedAt: null,
            isLoading: false
          })
        }
        return res
      }
      return { success: false }
    } catch (err: any) {
      set({ error: err.message || 'Error al desactivar licencia', isLoading: false })
      return { success: false }
    }
  }
}))
