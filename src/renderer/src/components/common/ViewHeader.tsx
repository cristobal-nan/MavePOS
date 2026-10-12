import React from 'react'
import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export interface ViewHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  badge?: React.ReactNode
  children?: React.ReactNode
  primaryAction?: React.ReactNode
  className?: string
}

/**
 * ViewHeader Canónico — Encabezado uniforme y simétrico para todas las vistas del POS.
 * Cumple con accesibilidad (semántica de encabezados, focus-visible) y estética Slate Profundo.
 */
export const ViewHeader: React.FC<ViewHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  primaryAction,
  className
}) => {
  return (
    <header
      className={clsx(
        'px-6 py-4 border-b border-slate-200 dark:border-slate-800',
        'bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm',
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0',
        className
      )}
    >
      {/* Título e Iconografía */}
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs',
              'bg-lilac-50 dark:bg-lilac-950/40 text-lilac-700 dark:text-lilac-300',
              'border border-lilac-200/60 dark:border-lilac-800/50'
            )}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Barra de herramientas, filtros y acciones primarias */}
      {(children || primaryAction) && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {children}
          {primaryAction}
        </div>
      )}
    </header>
  )
}
