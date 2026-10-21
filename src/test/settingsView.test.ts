import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingsView } from '../renderer/src/views/SettingsView'
import { UnsavedChangesModal } from '../renderer/src/views/settings/UnsavedChangesModal'

let mockStoreState = {
  isDirty: true,
  isSaving: false,
  toastMessage: null,
  showUnsavedModal: false,
  dirtyChanges: [{ field: 'Nombre de fantasía', value: 'Mave Lanas' }],
  pendingNavigation: null,
  saveCurrentSettings: vi.fn().mockResolvedValue(true),
  discardCurrentSettings: vi.fn(),
  setPendingNavigation: vi.fn(),
  setShowUnsavedModal: vi.fn(),
  registerSubTabState: vi.fn(),
  clearSubTabState: vi.fn()
}

beforeEach(() => {
  // @ts-ignore
  global.window = global.window || {}
  // @ts-ignore
  global.window.api = {
    getAllSettings: vi.fn().mockResolvedValue({}),
    setSetting: vi.fn().mockResolvedValue(true)
  }
  mockStoreState = {
    isDirty: true,
    isSaving: false,
    toastMessage: null,
    showUnsavedModal: false,
    dirtyChanges: [{ field: 'Nombre de fantasía', value: 'Mave Lanas' }],
    pendingNavigation: null,
    saveCurrentSettings: vi.fn().mockResolvedValue(true),
    discardCurrentSettings: vi.fn(),
    setPendingNavigation: vi.fn(),
    setShowUnsavedModal: vi.fn(),
    registerSubTabState: vi.fn(),
    clearSubTabState: vi.fn()
  }
})

vi.mock('../renderer/src/store/settingsStore', () => ({
  useSettingsStore: (selector?: any) => {
    return selector ? selector(mockStoreState) : mockStoreState
  }
}))

vi.mock('../renderer/src/store/uiStore', () => ({
  useUIStore: Object.assign(
    (selector?: any) => {
      const state = {
        surfaceMode: 'dark',
        themeAccent: 'lilac',
        currentTheme: 'lilac',
        setTheme: vi.fn(),
        setSurfaceMode: vi.fn(),
        setActiveTab: vi.fn()
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        setActiveTab: vi.fn()
      })
    }
  )
}))

describe('Auditoría UI Pantalla 7: Configuración (SettingsView y UnsavedChangesModal)', () => {
  it('renderiza ViewHeader canónico con título, subtítulo, icono y badge de sistema', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsView))

    expect(html).toContain('Configuración del Sistema')
    expect(html).toContain('Sistema')
    expect(html).toContain('Guardar Cambios')
  })

  it('renderiza SubTabs canónicas con roles ARIA tablist y tabs de configuración', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsView))

    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('Datos del Negocio')
    expect(html).toContain('Apariencia y Temas')
    expect(html).toContain('Impresoras')
    expect(html).toContain('Fondo y Retiro')
    expect(html).toContain('Inventario')
    expect(html).toContain('Respaldos')
    expect(html).toContain('Atajos de Teclado')
    expect(html).toContain('Licencia')
    expect(html).toContain('Mantenimiento')
  })

  it('UnsavedChangesModal implementa semántica ARIA dialog, modalidad y contraste Slate Profundo', () => {
    mockStoreState = {
      ...mockStoreState,
      showUnsavedModal: true
    }
    const onProceed = vi.fn()
    const html = renderToStaticMarkup(
      React.createElement(UnsavedChangesModal, { onProceedNavigation: onProceed })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="unsaved-changes-title"')
    expect(html).toContain('dark:bg-slate-800')
    expect(html).toContain('Guardar y continuar')
    expect(html).toContain('Descartar y salir')
    expect(html).toContain('Mave Lanas')
  })
})
