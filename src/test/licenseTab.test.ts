import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LicenseSettingsTab } from '../renderer/src/views/settings/LicenseSettingsTab'

let mockLicenseState = {
  machineId: 'MAVE-1234-5678-90AB',
  edition: 'pos' as 'pos' | 'erp',
  topology: 'single' as 'single' | 'multi',
  isActivated: false,
  licenseKey: null as string | null,
  activatedAt: null as string | null,
  isLoading: false,
  isActivating: false,
  error: null as string | null,
  loadLicense: vi.fn(),
  validateKey: vi.fn().mockResolvedValue({ valid: true }),
  activateKey: vi.fn().mockResolvedValue({ success: true }),
  deactivateLicense: vi.fn().mockResolvedValue({ success: true })
}

vi.mock('../renderer/src/store/licenseStore', () => ({
  useLicenseStore: (selector?: any) => {
    return selector ? selector(mockLicenseState) : mockLicenseState
  }
}))

describe('LicenseSettingsTab (Subpestaña F6 Licencia)', () => {
  beforeEach(() => {
    mockLicenseState = {
      machineId: 'MAVE-1234-5678-90AB',
      edition: 'pos',
      topology: 'single',
      isActivated: false,
      licenseKey: null,
      activatedAt: null,
      isLoading: false,
      isActivating: false,
      error: null,
      loadLicense: vi.fn(),
      validateKey: vi.fn().mockResolvedValue({ valid: true }),
      activateKey: vi.fn().mockResolvedValue({ success: true }),
      deactivateLicense: vi.fn().mockResolvedValue({ success: true })
    }

    // @ts-ignore
    global.window = global.window || {}
    // @ts-ignore
    global.window.api = {
      // @ts-ignore
      ...(global.window.api || {}),
      license: {
        getMachineId: vi.fn().mockResolvedValue('MAVE-1234-5678-90AB'),
        getStatus: vi.fn().mockResolvedValue({
          machineId: 'MAVE-1234-5678-90AB',
          edition: 'pos',
          topology: 'single',
          isActivated: false,
          licenseKey: null,
          activatedAt: null
        }),
        validateKey: vi.fn().mockResolvedValue({ valid: true }),
        activate: vi.fn().mockResolvedValue({ success: true }),
        deactivate: vi.fn().mockResolvedValue({ success: true })
      }
    }
  })

  it('muestra el identificador de instalación (machine_id) en tipografía monospace con botón de copiado', () => {
    const html = renderToStaticMarkup(React.createElement(LicenseSettingsTab))

    expect(html).toContain('MAVE-1234-5678-90AB')
    expect(html).toContain('font-mono')
    expect(html).toContain('Copiar Código')
    expect(html).toContain('WhatsApp')
  })

  it('muestra el estado actual en modo POS Estándar cuando no está activada', () => {
    const html = renderToStaticMarkup(React.createElement(LicenseSettingsTab))

    expect(html).toContain('Edición POS Estándar (Modo Básico)')
    expect(html).toContain('POS Estándar')
    expect(html).toContain('Monocaja (1 PC Autónoma)')
  })

  it('muestra el estado POS + ERP con insignia de activación cuando la licencia está activa', () => {
    mockLicenseState = {
      ...mockLicenseState,
      edition: 'erp',
      topology: 'multi',
      isActivated: true,
      licenseKey: 'MOCK.KEY',
      activatedAt: '2026-10-21T12:00:00.000Z'
    }

    const html = renderToStaticMarkup(React.createElement(LicenseSettingsTab))

    expect(html).toContain('Licencia Comercial Activa')
    expect(html).toContain('POS + ERP')
    expect(html).toContain('Multicaja (Red Local)')
    expect(html).toContain('Desactivar Licencia')
  })

  it('provee un campo de texto para pegar la clave y botón para activar', () => {
    const html = renderToStaticMarkup(React.createElement(LicenseSettingsTab))

    expect(html).toContain('textarea')
    expect(html).toContain('activation-key-input')
    expect(html).toContain('Activar Licencia')
  })

  it('incluye un contenedor de espacio reservado permanente para evitar Layout Shift', () => {
    const html = renderToStaticMarkup(React.createElement(LicenseSettingsTab))

    expect(html).toContain('validation-feedback-reserved')
    expect(html).toContain('h-6')
  })
})
