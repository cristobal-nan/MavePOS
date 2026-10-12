import React from 'react'
import { LucideIcon, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: LucideIcon
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: EmptyStateAction | React.ReactNode
  secondaryAction?: EmptyStateAction
  children?: React.ReactNode
  compact?: boolean
  className?: string
}

function isActionObject(action: unknown): action is EmptyStateAction {
  return typeof action === 'object' && action !== null && 'label' in action && 'onClick' in action
}

/**
 * EmptyState Canónico — Estado vacío estandarizado para tablas, paneles y vistas.
 *
 * Cumple con:
 * - Filosofía Anthropic: Sin clichés de IA (sin tarjetas flotantes artificiales ni gradientes vacíos),
 *   copy activo orientado a la tarea y sin callejones sin salida.
 * - Guías Vercel: focus-visible accesible, targets mínimos de toque (>=38px), motion-reduce,
 *   semántica ARIA y soporte dual (Claro y Slate Profundo).
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
  secondaryAction,
  children,
  compact = false,
  className
}) => {
  const renderActionButton = (btn: EmptyStateAction, isSecondary = false) => {
    const BtnIcon = btn.icon
    const isPrimary = btn.variant ? btn.variant === 'primary' : !isSecondary

    return (
      <button
        key={btn.label}
        type="button"
        onClick={btn.onClick}
        disabled={btn.disabled || btn.loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none cursor-pointer',
          'transition-colors duration-150 motion-reduce:transition-none',
          'focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900',
          compact ? 'px-3 py-1.5 text-xs h-8 min-w-[7rem]' : 'px-4 py-2 text-sm h-10 min-w-[8.5rem]',
          isPrimary
            ? 'bg-lilac-600 hover:bg-lilac-700 active:bg-lilac-800 text-white shadow-2xs dark:bg-lilac-600 dark:hover:bg-lilac-500'
            : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs',
          (btn.disabled || btn.loading) && 'opacity-50 cursor-not-allowed hover:bg-auto'
        )}
      >
        {btn.loading ? (
          <Loader2 className={clsx('animate-spin shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} aria-hidden="true" />
        ) : BtnIcon ? (
          <BtnIcon className={clsx('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} aria-hidden="true" />
        ) : null}
        <span>{btn.loading ? `${btn.label}…` : btn.label}</span>
      </button>
    )
  }

  return (
    <div
      role="status"
      className={clsx(
        'flex flex-col items-center justify-center text-center select-none',
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      {Icon && (
        <div
          className={clsx(
            'flex items-center justify-center rounded-xl shrink-0 shadow-2xs',
            'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500',
            'border border-slate-200/80 dark:border-slate-700/80',
            compact ? 'w-9 h-9 mb-2.5' : 'w-12 h-12 mb-3.5'
          )}
          aria-hidden="true"
        >
          <Icon className={clsx(compact ? 'w-4.5 h-4.5' : 'w-6 h-6')} aria-hidden="true" />
        </div>
      )}

      <h3
        className={clsx(
          'font-semibold text-slate-900 dark:text-slate-100 tracking-tight',
          compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={clsx(
            'text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto text-pretty leading-relaxed',
            compact ? 'text-[11px]' : 'text-xs sm:text-sm'
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction || children) && (
        <div
          className={clsx(
            'flex flex-wrap items-center justify-center gap-2.5',
            compact ? 'mt-3' : 'mt-5'
          )}
        >
          {action && (isActionObject(action) ? renderActionButton(action) : action)}
          {secondaryAction && renderActionButton(secondaryAction, true)}
          {children}
        </div>
      )}
    </div>
  )
}
