import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingsStore } from '../renderer/src/store/settingsStore'

describe('SettingsStore (F6 Configuración)', () => {
  beforeEach(() => {
    useSettingsStore.getState().clearSubTabState()
    useSettingsStore.setState({
      showUnsavedModal: false,
      pendingNavigation: null,
      toastMessage: null,
      isSaving: false
    })
  })

  it('inicia en estado limpio sin cambios no guardados', () => {
    const state = useSettingsStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.dirtyChanges).toEqual([])
    expect(state.saveHandler).toBeNull()
    expect(state.discardHandler).toBeNull()
  })

  it('registra cambios sucios y handlers de la subpestaña', () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    const discardMock = vi.fn()

    useSettingsStore.getState().registerSubTabState(
      true,
      [{ field: 'Razón Social', value: 'Nuevo Nombre' }],
      saveMock,
      discardMock
    )

    const state = useSettingsStore.getState()
    expect(state.isDirty).toBe(true)
    expect(state.dirtyChanges).toHaveLength(1)
    expect(state.dirtyChanges[0]).toEqual({ field: 'Razón Social', value: 'Nuevo Nombre' })
  })

  it('guarda correctamente y activa el mensaje de éxito', async () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    const discardMock = vi.fn()

    useSettingsStore.getState().registerSubTabState(
      true,
      [{ field: 'Nombre Comercial', value: 'Mi Tienda' }],
      saveMock,
      discardMock
    )

    const success = await useSettingsStore.getState().saveCurrentSettings()
    expect(success).toBe(true)
    expect(saveMock).toHaveBeenCalledTimes(1)

    const state = useSettingsStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.dirtyChanges).toEqual([])
    expect(state.toastMessage).toBe('Cambios realizados correctamente')
  })

  it('descarta cambios y ejecuta el handler de descarte', () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    const discardMock = vi.fn()

    useSettingsStore.getState().registerSubTabState(
      true,
      [{ field: 'Dirección', value: 'Calle 123' }],
      saveMock,
      discardMock
    )

    useSettingsStore.getState().discardCurrentSettings()

    expect(discardMock).toHaveBeenCalledTimes(1)
    const state = useSettingsStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.dirtyChanges).toEqual([])
    expect(state.showUnsavedModal).toBe(false)
    expect(state.pendingNavigation).toBeNull()
  })

  it('gestiona la navegación pendiente y visibilidad del modal', () => {
    useSettingsStore.getState().setPendingNavigation({ type: 'subtab', target: 'printers' })
    useSettingsStore.getState().setShowUnsavedModal(true)

    let state = useSettingsStore.getState()
    expect(state.pendingNavigation).toEqual({ type: 'subtab', target: 'printers' })
    expect(state.showUnsavedModal).toBe(true)

    useSettingsStore.getState().setPendingNavigation(null)
    useSettingsStore.getState().setShowUnsavedModal(false)

    state = useSettingsStore.getState()
    expect(state.pendingNavigation).toBeNull()
    expect(state.showUnsavedModal).toBe(false)
  })
})
