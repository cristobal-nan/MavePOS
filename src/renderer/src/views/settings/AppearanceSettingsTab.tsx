import React, { useState } from 'react'
import { Palette, Check, Sun, Moon, Laptop } from 'lucide-react'
import { THEMES, ThemeId, SurfaceMode, resolveSurface } from '../../theme/themes'
import { useUIStore } from '../../store/uiStore'

interface SurfaceOption {
  id: SurfaceMode
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const SURFACE_OPTIONS: SurfaceOption[] = [
  {
    id: 'light',
    name: 'Modo Claro',
    description: 'Fondo blanco tradicional y altos contrastes.',
    icon: Sun
  },
  {
    id: 'dark',
    name: 'Modo Oscuro',
    description: 'Paleta Slate profunda (#0F172A) para reducir la fatiga visual.',
    icon: Moon
  },
  {
    id: 'system',
    name: 'Sistema (Automático)',
    description: 'Sincronizado de forma reactiva con el tema de Windows.',
    icon: Laptop
  }
]

export const AppearanceSettingsTab: React.FC = () => {
  const { currentTheme, setTheme, surfaceMode, setSurfaceMode } = useUIStore()
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const handleSelectTheme = (id: ThemeId): void => {
    setTheme(id)
    setSuccessNotice(`Tema cambiado a "${THEMES[id].name}"`)
    setTimeout(() => {
      setSuccessNotice(null)
    }, 3000)
  }

  const handleSelectSurface = (mode: SurfaceMode): void => {
    setSurfaceMode(mode)
    const label =
      mode === 'system'
        ? 'Modo automático sincronizado con el Sistema'
        : mode === 'dark'
        ? 'Modo Oscuro activado'
        : 'Modo Claro activado'
    setSuccessNotice(label)
    setTimeout(() => {
      setSuccessNotice(null)
    }, 3000)
  }

  const themeList = Object.values(THEMES)
  const currentResolved = resolveSurface('system')

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 transition-colors duration-200">
      {/* ---------------- SECCIÓN 1: MODO DE SUPERFICIE (CLARO / OSCURO / SISTEMA) ---------------- */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col gap-4 transition-colors duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-lilac-50 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shrink-0 shadow-inner transition-colors duration-200">
            {surfaceMode === 'dark' ? (
              <Moon className="w-6 h-6" />
            ) : surfaceMode === 'light' ? (
              <Sun className="w-6 h-6" />
            ) : (
              <Laptop className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 transition-colors duration-200">
              Modo de Superficie (Claro / Oscuro)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed transition-colors duration-200">
              Configura el fondo general de la aplicación. Puedes trabajar en modo claro, activar el modo oscuro profundo
              diseñado para turnos de noche o dejar que se sincronice automáticamente con Windows.
            </p>
          </div>
        </div>

        {/* Grid de 3 opciones de superficie */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {SURFACE_OPTIONS.map((option) => {
            const isSelected = surfaceMode === option.id
            const Icon = option.icon

            return (
              <div
                key={option.id}
                onClick={() => handleSelectSurface(option.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-200 ${
                  isSelected
                    ? 'border-lilac-600 bg-lilac-50/40 dark:bg-slate-700/80 ring-2 ring-lilac-100 dark:ring-lilac-950'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      isSelected
                        ? 'bg-lilac-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 dark:bg-lilac-950/80 text-lilac-700 dark:text-lilac-300 transition-colors duration-200 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Activo
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 transition-colors duration-200">
                    <span>{option.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed transition-colors duration-200">
                    {option.description}
                  </p>
                  {option.id === 'system' && isSelected && (
                    <span className="inline-block mt-2 text-[10px] font-medium text-lilac-600 dark:text-lilac-400">
                      Windows detectado: {currentResolved === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------------- SECCIÓN 2: PALETA DE ACENTOS Y TEMAS ---------------- */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex items-start gap-4 transition-colors duration-200">
        <div className="w-12 h-12 rounded-2xl bg-lilac-50 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shrink-0 shadow-inner transition-colors duration-200">
          <Palette className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 transition-colors duration-200">
            Color de Acento del Sistema
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed transition-colors duration-200">
            Personaliza el matiz de botones, resaltados y barras interactivas. Las decisiones de color se encuentran
            centralizadas en <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono text-[11px] transition-colors duration-200">src/renderer/src/theme/themes.ts</code> para que puedas agregar o ajustar paletas futuras en un solo lugar.
          </p>
        </div>
      </div>

      {/* Grid de temas de acento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {themeList.map((theme) => {
          const isSelected = currentTheme === theme.id

          return (
            <div
              key={theme.id}
              onClick={() => handleSelectTheme(theme.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer flex flex-col justify-between gap-4 bg-white dark:bg-slate-800 relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-200 ${
                isSelected
                  ? 'border-lilac-600 ring-2 ring-lilac-100 dark:ring-lilac-950'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Muestra de color principal circular */}
                  <div
                    className="w-10 h-10 rounded-xl shadow-inner flex items-center justify-center shrink-0 text-white font-bold"
                    style={{ backgroundColor: theme.colors[500] }}
                  >
                    {isSelected && <Check className="w-5 h-5 stroke-[3]" />}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition-colors duration-200">
                      <span>{theme.name}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 dark:bg-lilac-950/80 text-lilac-700 dark:text-lilac-300 transition-colors duration-200">
                          Activo
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition-colors duration-200">
                      {theme.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tira degradada de tonalidades de la paleta */}
              <div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-700 transition-colors duration-200">
                <div className="h-4 flex-1 rounded-l-md" style={{ backgroundColor: theme.colors[100] }} title="100" />
                <div className="h-4 flex-1" style={{ backgroundColor: theme.colors[300] }} title="300" />
                <div className="h-4 flex-1" style={{ backgroundColor: theme.colors[500] }} title="500 (Acento)" />
                <div className="h-4 flex-1" style={{ backgroundColor: theme.colors[600] }} title="600 (Botones)" />
                <div className="h-4 flex-1 rounded-r-md" style={{ backgroundColor: theme.colors[800] }} title="800 (Oscuro)" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Notificación flotante de cambio de tema / superficie */}
      {successNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-slate-800 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <Palette className="w-4 h-4 text-lilac-400 shrink-0" />
          <span className="font-bold">{successNotice}</span>
        </div>
      )}
    </div>
  )
}
