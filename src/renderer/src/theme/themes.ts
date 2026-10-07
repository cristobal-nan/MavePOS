// src/renderer/src/theme/themes.ts
// ARCHIVO CENTRAL MAESTRO DE TEMAS Y COLORES
// Para agregar, modificar o crear un tema nuevo, solo se edita este archivo.

export type ThemeId = 'lila' | 'esmeralda' | 'oceano' | 'grafito'

export interface ThemeColors {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  previewColor: string
  colors: ThemeColors
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  lila: {
    id: 'lila',
    name: 'Mave Lila (Original)',
    description: 'Paleta oficial en tonos púrpura y lavanda suaves.',
    previewColor: '#8B5CF6',
    colors: {
      50: '#F5F3FF',
      100: '#EDE9FE',
      200: '#DDD6FE',
      300: '#C4B5FD',
      400: '#A78BFA',
      500: '#8B5CF6',
      600: '#7C3AED',
      700: '#6D28D9',
      800: '#5B21B6',
      900: '#4C1D95',
      950: '#2E1065'
    }
  },
  esmeralda: {
    id: 'esmeralda',
    name: 'Verde Esmeralda',
    description: 'Tonos verdes naturales, frescos y relajantes para la vista.',
    previewColor: '#10B981',
    colors: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
      950: '#022C22'
    }
  },
  oceano: {
    id: 'oceano',
    name: 'Azul Océano',
    description: 'Tonos azules profesionales, equilibrados y nítidos.',
    previewColor: '#3B82F6',
    colors: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
      950: '#172554'
    }
  },
  grafito: {
    id: 'grafito',
    name: 'Gris Grafito',
    description: 'Estilo neutro, minimalista y elegante en escala carbón y pizarra.',
    previewColor: '#64748B',
    colors: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#020617'
    }
  }
}

export const DEFAULT_THEME_ID: ThemeId = 'lila'

/**
 * Convierte un color HEX (#RRGGBB) a formato de canales RGB separados por espacio ("R G B")
 * para su uso directo con variables CSS y la sintaxis moderna rgb(var(...) / <alpha-value>).
 */
export function hexToRgb(hex: string): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

/**
 * Aplica el tema seleccionado inyectando las variables CSS dinámicamente en document.documentElement.
 * Las clases Tailwind como bg-lilac-500, text-lilac-600, border-lilac-200, etc. se actualizan al instante.
 */
export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME_ID]
  const root = document.documentElement

  root.setAttribute('data-theme', theme.id)

  const shades: (keyof ThemeColors)[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  shades.forEach((shade) => {
    const hex = theme.colors[shade]
    if (hex) {
      root.style.setProperty(`--color-theme-${shade}`, hex)
      root.style.setProperty(`--color-theme-${shade}-rgb`, hexToRgb(hex))
    }
  })
}

export type SurfaceMode = 'light' | 'dark' | 'system'
export type ResolvedSurface = 'light' | 'dark'

export const DEFAULT_SURFACE_MODE: SurfaceMode = 'system'

let mediaQueryList: MediaQueryList | null = null
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

/**
 * Resuelve el modo de superficie actual a 'light' o 'dark'.
 * Si el modo es 'system', consulta prefers-color-scheme del sistema operativo.
 */
export function resolveSurface(mode: SurfaceMode): ResolvedSurface {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }
  return mode
}

/**
 * Aplica el modo de superficie en document.documentElement mediante la clase 'dark' y atributos data.
 * Si mode es 'system', registra un listener para reaccionar inmediatamente a cambios en Windows.
 */
export function applySurfaceMode(mode: SurfaceMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved = resolveSurface(mode)

  root.setAttribute('data-surface-mode', mode)
  root.setAttribute('data-surface', resolved)

  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (mediaQueryList && mediaQueryListener) {
      mediaQueryList.removeEventListener('change', mediaQueryListener)
      mediaQueryList = null
      mediaQueryListener = null
    }

    if (mode === 'system') {
      mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQueryListener = (e: MediaQueryListEvent): void => {
        const nextResolved: ResolvedSurface = e.matches ? 'dark' : 'light'
        root.setAttribute('data-surface', nextResolved)
        if (nextResolved === 'dark') {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
      mediaQueryList.addEventListener('change', mediaQueryListener)
    }
  }
}

