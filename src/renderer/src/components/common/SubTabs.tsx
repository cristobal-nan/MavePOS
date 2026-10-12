import React, { useRef } from 'react'
import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export interface SubTabItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
  badge?: string | number
  disabled?: boolean
}

export interface SubTabsProps<T extends string = string> {
  tabs: SubTabItem<T>[]
  activeTab: T
  onChange: (id: T) => void
  ariaLabel?: string
  className?: string
  size?: 'sm' | 'md'
  variant?: 'tabs' | 'pills'
}

/**
 * SubTabs Canónicas — Pestañas auténticas para sub-navegación dentro de pantallas.
 * Diseño homogéneo con altura fija, borde inferior activo y estilo de pestañas de interfaz real.
 * Soporta navegación accesible por teclado (flechas, Home, End), roles ARIA, tabular-nums y tema dual.
 */
export function SubTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = 'Pestañas secundarias',
  className,
  size = 'md',
  variant = 'tabs'
}: SubTabsProps<T>): React.ReactElement {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const enabledTabs = tabs.filter((t) => !t.disabled)
    if (enabledTabs.length === 0) return

    let nextIndex = index

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (index + 1) % tabs.length
      while (tabs[nextIndex].disabled) {
        nextIndex = (nextIndex + 1) % tabs.length
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (index - 1 + tabs.length) % tabs.length
      while (tabs[nextIndex].disabled) {
        nextIndex = (nextIndex - 1 + tabs.length) % tabs.length
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
      while (tabs[nextIndex].disabled && nextIndex < tabs.length - 1) {
        nextIndex++
      }
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabs.length - 1
      while (tabs[nextIndex].disabled && nextIndex > 0) {
        nextIndex--
      }
    } else {
      return
    }

    const nextTab = tabs[nextIndex]
    if (nextTab && !nextTab.disabled) {
      onChange(nextTab.id)
      tabRefs.current[nextIndex]?.focus()
    }
  }

  // Variante auténtica de pestañas (tabs reales con borde inferior y altura uniforme)
  if (variant === 'tabs') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={clsx(
          'flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto select-none h-full',
          className
        )}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          const countValue = tab.count ?? tab.badge

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el
              }}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (!tab.disabled) onChange(tab.id)
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={clsx(
                'h-full flex items-center gap-2 px-3.5 sm:px-4 py-2 border-b-2 shrink-0 transition-all cursor-pointer font-semibold',
                'rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900',
                size === 'sm' ? 'text-xs' : 'text-xs sm:text-sm',
                isActive
                  ? 'border-lilac-600 dark:border-lilac-400 text-lilac-700 dark:text-lilac-300 bg-lilac-50/50 dark:bg-lilac-950/40 font-bold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600',
                tab.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:border-transparent'
              )}
            >
              {Icon && (
                <Icon
                  className={clsx(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-lilac-600 dark:text-lilac-400' : 'text-slate-400 dark:text-slate-400'
                  )}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              {countValue !== undefined && (
                <span
                  className={clsx(
                    'tabular-nums font-mono text-[11px] px-1.5 py-0.2 rounded-full font-bold shrink-0',
                    isActive
                      ? 'bg-lilac-200/80 dark:bg-lilac-900/80 text-lilac-800 dark:text-lilac-100 border border-lilac-300 dark:border-lilac-700/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  )}
                >
                  {countValue}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Variante pills (para filtros o switches compactos segmentados)
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        'bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl',
        'border border-slate-200/60 dark:border-slate-700/60',
        'flex items-center gap-1 w-fit max-w-full overflow-x-auto select-none',
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab
        const Icon = tab.icon
        const countValue = tab.count ?? tab.badge

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el
            }}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id)
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={clsx(
              'rounded-lg font-medium flex items-center gap-2 shrink-0 cursor-pointer',
              'transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm',
              isActive
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs border border-slate-200/60 dark:border-slate-600/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/40 border border-transparent',
              tab.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
            <span>{tab.label}</span>
            {countValue !== undefined && (
              <span
                className={clsx(
                  'tabular-nums font-mono text-[11px] px-1.5 py-0.2 rounded-full font-semibold shrink-0',
                  isActive
                    ? 'bg-lilac-100 dark:bg-lilac-950/70 text-lilac-800 dark:text-lilac-200 border border-lilac-200/60 dark:border-lilac-800/50'
                    : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400'
                )}
              >
                {countValue}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
