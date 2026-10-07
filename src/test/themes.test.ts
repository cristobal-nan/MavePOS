import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  THEMES,
  applyTheme,
  DEFAULT_THEME_ID,
  resolveSurface,
  applySurfaceMode,
  DEFAULT_SURFACE_MODE
} from '../renderer/src/theme/themes'
import { useUIStore } from '../renderer/src/store/uiStore'

describe('Temas y Modo de Superficie (Dark Mode)', () => {
  let originalDocument: any
  let originalWindow: any
  let classListSet: Set<string>
  let attributesMap: Map<string, string>
  let stylesMap: Map<string, string>

  beforeEach(() => {
    classListSet = new Set<string>()
    attributesMap = new Map<string, string>()
    stylesMap = new Map<string, string>()

    originalDocument = (global as any).document
    originalWindow = (global as any).window

    const mockElement = {
      classList: {
        add: (cls: string) => classListSet.add(cls),
        remove: (cls: string) => classListSet.delete(cls),
        contains: (cls: string) => classListSet.has(cls),
        toggle: (cls: string, force?: boolean) => {
          if (force !== undefined) {
            force ? classListSet.add(cls) : classListSet.delete(cls)
          } else {
            classListSet.has(cls) ? classListSet.delete(cls) : classListSet.add(cls)
          }
        }
      },
      setAttribute: (name: string, val: string) => attributesMap.set(name, String(val)),
      getAttribute: (name: string) => attributesMap.get(name) || null,
      removeAttribute: (name: string) => attributesMap.delete(name),
      style: {
        setProperty: (name: string, val: string) => stylesMap.set(name, String(val)),
        getPropertyValue: (name: string) => stylesMap.get(name) || ''
      }
    }

    ;(global as any).document = {
      documentElement: mockElement
    }

    ;(global as any).window = {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })),
      api: {
        setSetting: vi.fn().mockResolvedValue({ ok: true }),
        getSetting: vi.fn().mockResolvedValue('system')
      }
    }
  })

  afterEach(() => {
    ;(global as any).document = originalDocument
    ;(global as any).window = originalWindow
  })

  it('tiene definidos los 4 temas canónicos con sus 11 tonos', () => {
    expect(THEMES.lila).toBeDefined()
    expect(THEMES.esmeralda).toBeDefined()
    expect(THEMES.oceano).toBeDefined()
    expect(THEMES.grafito).toBeDefined()
    expect(DEFAULT_THEME_ID).toBe('lila')
    expect(DEFAULT_SURFACE_MODE).toBe('system')

    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    shades.forEach((shade) => {
      expect(THEMES.lila.colors[shade]).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(THEMES.esmeralda.colors[shade]).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(THEMES.oceano.colors[shade]).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(THEMES.grafito.colors[shade]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })

  it('aplica las variables CSS correspondientes al cambiar de tema', () => {
    applyTheme('esmeralda')
    expect(document.documentElement.getAttribute('data-theme')).toBe('esmeralda')
    expect(document.documentElement.style.getPropertyValue('--color-theme-500')).toBe(THEMES.esmeralda.colors[500])
    expect(document.documentElement.style.getPropertyValue('--color-theme-500-rgb')).toBe('16 185 129')

    applyTheme('lila')
    expect(document.documentElement.getAttribute('data-theme')).toBe('lila')
    expect(document.documentElement.style.getPropertyValue('--color-theme-500')).toBe(THEMES.lila.colors[500])
    expect(document.documentElement.style.getPropertyValue('--color-theme-500-rgb')).toBe('139 92 246')
  })

  it('resuelve correctamente la superficie para "light" y "dark"', () => {
    expect(resolveSurface('light')).toBe('light')
    expect(resolveSurface('dark')).toBe('dark')
  })

  it('resuelve "system" consultando matchMedia', () => {
    // Modo oscuro en sistema
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
    expect(resolveSurface('system')).toBe('dark')

    // Modo claro en sistema
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
    expect(resolveSurface('system')).toBe('light')
  })

  it('applySurfaceMode("dark") añade la clase .dark y actualiza dataset', () => {
    applySurfaceMode('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-surface')).toBe('dark')
    expect(document.documentElement.getAttribute('data-surface-mode')).toBe('dark')
  })

  it('applySurfaceMode("light") remueve la clase .dark y actualiza dataset', () => {
    document.documentElement.classList.add('dark')
    applySurfaceMode('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-surface')).toBe('light')
    expect(document.documentElement.getAttribute('data-surface-mode')).toBe('light')
  })

  it('useUIStore persiste surfaceMode a través de window.api.setSetting', async () => {
    const mockSetSetting = vi.fn().mockResolvedValue({ ok: true })
    const mockGetSetting = vi.fn().mockResolvedValue('dark')

    ;(window as any).api = {
      setSetting: mockSetSetting,
      getSetting: mockGetSetting
    }

    await useUIStore.getState().setSurfaceMode('dark')
    expect(useUIStore.getState().surfaceMode).toBe('dark')
    expect(mockSetSetting).toHaveBeenCalledWith('app_surface_mode', 'dark')

    await useUIStore.getState().loadSurfaceMode()
    expect(useUIStore.getState().surfaceMode).toBe('dark')
    expect(mockGetSetting).toHaveBeenCalledWith('app_surface_mode')
  })
})
