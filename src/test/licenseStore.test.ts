import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLicenseStore } from '../renderer/src/store/licenseStore'

describe('LicenseStore (Estado reactivo de licenciamiento)', () => {
  beforeEach(() => {
    // Resetear store
    useLicenseStore.setState({
      machineId: '',
      edition: 'pos',
      topology: 'single',
      isActivated: false,
      licenseKey: null,
      activatedAt: null,
      isLoading: false,
      isActivating: false,
      error: null
    })

    // Mock window.api.license
    // @ts-ignore
    global.window = global.window || {}
    // @ts-ignore
    global.window.api = {
      // @ts-ignore
      ...(global.window.api || {}),
      license: {
        getMachineId: vi.fn().mockResolvedValue('MAVE-AAAA-BBBB-CCCC'),
        getStatus: vi.fn().mockResolvedValue({
          machineId: 'MAVE-AAAA-BBBB-CCCC',
          edition: 'pos',
          topology: 'single',
          isActivated: false,
          licenseKey: null,
          activatedAt: null
        }),
        validateKey: vi.fn().mockResolvedValue({
          valid: true,
          payload: {
            machineId: 'MAVE-AAAA-BBBB-CCCC',
            edition: 'erp',
            topology: 'single'
          }
        }),
        activate: vi.fn().mockResolvedValue({
          success: true,
          edition: 'erp',
          topology: 'single',
          status: {
            machineId: 'MAVE-AAAA-BBBB-CCCC',
            edition: 'erp',
            topology: 'single',
            isActivated: true,
            licenseKey: 'MOCK.KEY',
            activatedAt: '2026-10-21T00:00:00.000Z'
          }
        }),
        deactivate: vi.fn().mockResolvedValue({ success: true })
      }
    }
  })

  it('inicia por defecto en edición POS Estándar sin activación', () => {
    const state = useLicenseStore.getState()
    expect(state.edition).toBe('pos')
    expect(state.topology).toBe('single')
    expect(state.isActivated).toBe(false)
    expect(state.licenseKey).toBeNull()
  })

  it('loadLicense consulta getStatus y actualiza el estado', async () => {
    const status = await useLicenseStore.getState().loadLicense()

    expect(status).not.toBeNull()
    expect(status?.machineId).toBe('MAVE-AAAA-BBBB-CCCC')

    const state = useLicenseStore.getState()
    expect(state.machineId).toBe('MAVE-AAAA-BBBB-CCCC')
    expect(state.edition).toBe('pos')
    expect(state.isLoading).toBe(false)
  })

  it('validateKey delega la verificación al canal seguro IPC', async () => {
    const res = await useLicenseStore.getState().validateKey('TEST.KEY')

    expect(res.valid).toBe(true)
    expect(window.api.license.validateKey).toHaveBeenCalledWith('TEST.KEY')
  })

  it('activateKey actualiza inmediatamente la edición activa a erp en caso de éxito', async () => {
    const res = await useLicenseStore.getState().activateKey('MOCK.KEY')

    expect(res.success).toBe(true)
    expect(res.edition).toBe('erp')

    const state = useLicenseStore.getState()
    expect(state.edition).toBe('erp')
    expect(state.isActivated).toBe(true)
    expect(state.licenseKey).toBe('MOCK.KEY')
    expect(state.activatedAt).toBe('2026-10-21T00:00:00.000Z')
  })

  it('deactivateLicense regresa el estado a POS estándar', async () => {
    // Primero activar
    await useLicenseStore.getState().activateKey('MOCK.KEY')
    expect(useLicenseStore.getState().isActivated).toBe(true)

    // Luego desactivar
    const res = await useLicenseStore.getState().deactivateLicense()
    expect(res.success).toBe(true)

    const state = useLicenseStore.getState()
    expect(state.edition).toBe('pos')
    expect(state.isActivated).toBe(false)
    expect(state.licenseKey).toBeNull()
  })
})
