import React, { useState, useEffect, useRef } from 'react'
import {
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Laptop,
  RotateCcw
} from 'lucide-react'
import { useLicenseStore } from '../../store/licenseStore'
import { LicenseValidationResult } from '@shared/types'
import { formatDateTime } from '../../utils/formatters'

export const LicenseSettingsTab: React.FC = () => {
  const {
    machineId,
    edition,
    topology,
    isActivated,
    activatedAt,
    isLoading,
    isActivating,
    loadLicense,
    validateKey,
    activateKey,
    deactivateLicense
  } = useLicenseStore()

  const [inputKey, setInputKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [validationResult, setValidationResult] = useState<LicenseValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [activationFeedback, setActivationFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const copyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar estado inicial al montar
  useEffect(() => {
    loadLicense()
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [loadLicense])

  // Validación reactiva de la clave ingresada
  useEffect(() => {
    const trimmed = inputKey.trim()
    if (!trimmed) {
      setValidationResult(null)
      return
    }

    let isCurrent = true
    setIsValidating(true)

    // Breve debounce de 150ms para no saturar al pegar
    const timer = setTimeout(async () => {
      try {
        const res = await validateKey(trimmed)
        if (isCurrent) {
          setValidationResult(res)
          setIsValidating(false)
        }
      } catch {
        if (isCurrent) {
          setValidationResult({
            valid: false,
            error: 'invalid_format',
            message: 'Error al verificar clave'
          })
          setIsValidating(false)
        }
      }
    }, 150)

    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [inputKey, validateKey])

  // Copiar Machine ID al portapapeles
  const handleCopyMachineId = async (): Promise<void> => {
    if (!machineId) return
    try {
      await navigator.clipboard.writeText(machineId)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2500)
    } catch {
      // Fallback
      setCopied(false)
    }
  }

  // Activar la licencia ingresada
  const handleActivate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmed = inputKey.trim()
    if (!trimmed) return

    setActivationFeedback(null)
    const result = await activateKey(trimmed)

    if (result.success) {
      setInputKey('')
      setValidationResult(null)
      setActivationFeedback({
        type: 'success',
        message: '¡Licencia activada con éxito! La edición POS + ERP está lista para operar.'
      })
    } else {
      setActivationFeedback({
        type: 'error',
        message: result.message || 'No se pudo activar la licencia.'
      })
    }

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => {
      setActivationFeedback(null)
    }, 6000)
  }

  // Desactivar licencia actual y volver a POS estándar
  const handleDeactivate = async (): Promise<void> => {
    if (!confirm('¿Desea desactivar la licencia de este equipo y regresar a la edición POS Estándar?')) {
      return
    }
    setIsDeactivating(true)
    try {
      await deactivateLicense()
      setActivationFeedback({
        type: 'success',
        message: 'Licencia desactivada. El sistema opera ahora en edición POS Estándar.'
      })
    } finally {
      setIsDeactivating(false)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => {
        setActivationFeedback(null)
      }, 5000)
    }
  }

  // Determinar clases de borde del input según validación
  const getInputStateClasses = (): string => {
    if (!inputKey.trim()) {
      return 'border-slate-300 dark:border-slate-700 focus:border-lilac-500 dark:focus:border-lilac-400'
    }
    if (isValidating) {
      return 'border-slate-300 dark:border-slate-700 focus:border-lilac-500'
    }
    if (validationResult?.valid) {
      return 'border-emerald-500 dark:border-emerald-500 focus:border-emerald-600'
    }
    return 'border-rose-500 dark:border-rose-500 focus:border-rose-600'
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150 pb-8">
      {/* Tarjeta 1: Identificador de Máquina (Hardware ID) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <Laptop className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            <span>Código de Instalación de este Computador</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Identificador Invariable
          </span>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">
              Machine ID (Hardware de la Placa Madre / SO)
            </span>
            <div className="flex items-center gap-2">
              <span
                data-testid="machine-id-display"
                className="font-mono tabular-nums text-lg sm:text-xl font-bold tracking-wider text-slate-800 dark:text-slate-100 select-all"
              >
                {machineId || (isLoading ? 'Cargando identificador…' : 'MAVE-0000-0000-0000')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyMachineId}
            disabled={!machineId}
            aria-label="Copiar código de máquina al portapapeles"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-600/20 ring-2 ring-emerald-300'
                : 'bg-lilac-600 hover:bg-lilac-700 text-white shadow-lilac-600/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-white" />
                <span>Copiar Código</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Envíe este código al desarrollador por WhatsApp para generar su clave de activación
          personalizada. Cada clave es 100% offline y queda vinculada de forma exclusiva e inmutable a este equipo.
        </p>
      </div>

      {/* Tarjeta 2: Estado del Plan y Licencia Actual */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            <span>Estado de Licencia del Sistema</span>
          </div>

          {/* Badge principal de estado */}
          {isActivated ? (
            <span
              data-testid="license-status-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Licencia Comercial Activa</span>
            </span>
          ) : (
            <span
              data-testid="license-status-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
              <span>Edición POS Estándar (Modo Básico)</span>
            </span>
          )}
        </div>

        {/* Resumen de dimensiones de la licencia */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Edición Activa</span>
            <span
              data-testid="license-edition-display"
              className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5"
            >
              {edition === 'erp' ? (
                <>
                  <span className="text-lilac-600 dark:text-lilac-400">POS + ERP</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-lilac-100 dark:bg-lilac-950/60 text-lilac-700 dark:text-lilac-300 font-semibold">
                    Completo
                  </span>
                </>
              ) : (
                <span>POS Estándar</span>
              )}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Topología de Red</span>
            <span
              data-testid="license-topology-display"
              className="font-bold text-slate-800 dark:text-slate-100 text-sm"
            >
              {topology === 'multi' ? 'Multicaja (Red Local)' : 'Monocaja (1 PC Autónoma)'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block mb-1 font-medium">Fecha de Activación</span>
            <span
              data-testid="license-activated-at-display"
              className="font-bold text-slate-800 dark:text-slate-100 font-mono"
            >
              {activatedAt ? formatDateTime(activatedAt) : '—'}
            </span>
          </div>
        </div>

        {/* Botón de desactivación si está activada */}
        {isActivated && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isDeactivating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Desactivar Licencia</span>
            </button>
          </div>
        )}
      </div>

      {/* Tarjeta 3: Activación y Validación de Clave */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
          <KeyRound className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
          <span>Activar o Actualizar Licencia</span>
        </div>

        <form onSubmit={handleActivate} className="space-y-3">
          <div>
            <label
              htmlFor="activation-key-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Clave de Activación Criptográfica
            </label>
            <textarea
              id="activation-key-input"
              data-testid="activation-key-input"
              rows={3}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Pegue aquí la clave de activación provista por el desarrollador (ej. eyJtYWNoaW5lSW...)"
              spellCheck={false}
              autoComplete="off"
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-mono font-medium outline-none transition-colors border shadow-2xs resize-none ${getInputStateClasses()}`}
            />
          </div>

          {/* Espacio Reservado Permanente para Feedback en Vivo (Cero Layout Shift) */}
          <div
            data-testid="validation-feedback-reserved"
            className="h-6 flex items-center text-xs select-none"
            aria-live="polite"
          >
            {isValidating && (
              <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verificando firma criptográfica…</span>
              </span>
            )}

            {!isValidating && validationResult?.valid && (
              <span
                data-testid="validation-success-text"
                className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Clave válida: Edición {validationResult.payload?.edition.toUpperCase()} (
                  {validationResult.payload?.topology === 'single' ? 'Monocaja' : 'Multicaja'})
                </span>
              </span>
            )}

            {!isValidating && validationResult && !validationResult.valid && (
              <span
                data-testid="validation-error-text"
                className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>
                  {validationResult.error === 'hardware_mismatch'
                    ? 'Esta clave fue generada para otro computador (no coincide el hardware)'
                    : validationResult.error === 'invalid_signature'
                    ? 'Firma de clave inválida o modificada'
                    : 'Formato de clave inválido o incompleto'}
                </span>
              </span>
            )}

            {!isValidating && !validationResult && !inputKey.trim() && (
              <span className="text-slate-400 dark:text-slate-500">
                Ingrese o pegue una clave para verificarla automáticamente en tiempo real.
              </span>
            )}
          </div>

          {/* Mensaje de resultado de activación */}
          {activationFeedback && (
            <div
              data-testid="activation-result-banner"
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 ${
                activationFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {activationFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{activationFeedback.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              La activación actualiza los módulos de forma inmediata sin reiniciar la aplicación.
            </span>

            <button
              type="submit"
              data-testid="activate-license-btn"
              disabled={!inputKey.trim() || isValidating || isActivating || validationResult?.valid === false}
              className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-lilac-600 hover:bg-lilac-700 text-white shadow-lilac-600/20"
            >
              {isActivating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activando…</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Activar Licencia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
