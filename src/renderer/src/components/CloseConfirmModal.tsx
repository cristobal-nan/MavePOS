import React, { useEffect, useState } from 'react'
import { AlertCircle, Archive, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react'
import { CashSession } from '@shared/types'
import { useUIStore } from '../store/uiStore'
import { useModalStack } from '../utils/modalStack'

type BackupStatus = 'idle' | 'backing_up' | 'completed' | 'error'

export const CloseConfirmModal: React.FC = () => {
  const { closeModalStep, openCloseModal, closeCloseModal } = useUIStore()
  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [hasSales, setHasSales] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [isProcessing, setIsProcessing] = useState(false)
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [backupFilePath, setBackupFilePath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCancel = (): void => {
    if (backupStatus === 'backing_up' || backupStatus === 'completed') return
    closeCloseModal()
    setIsProcessing(false)
    setBackupStatus('idle')
  }

  const { handleBackdropClick } = useModalStack({
    id: 'close-confirm-modal',
    isOpen: closeModalStep !== 'closed',
    onClose: handleCancel,
    closeOnBackdrop: backupStatus === 'idle'
  })

  // Reset state each time we enter 'countdown_backup'
  useEffect(() => {
    if (closeModalStep === 'countdown_backup') {
      setCountdown(5)
      setIsProcessing(false)
      setBackupStatus('idle')
      setBackupFilePath(null)
      setErrorMessage(null)
    }
  }, [closeModalStep])

  // Listen to main process close request (X button or Alt+F4)
  useEffect(() => {
    if (!window.api?.onPromptClose) return

    const unsubscribe = window.api.onPromptClose(async () => {
      try {
        const session = await window.api.getCurrentCashSession()
        setActiveSession(session)
        if (session) {
          try {
            const summary = await window.api.cash.getSessionSummary(session.id)
            const salesExist = ((summary?.salesCount ?? 0) > 0 || (summary?.salesTotal ?? 0) > 0)
            setHasSales(salesExist)
          } catch {
            setHasSales(true)
          }
          openCloseModal('ask_cash_close')
        } else {
          // Si no hay sesión de caja abierta (ej: pantalla de apertura de fondo), salir directo sin modal ni respaldo
          await window.api.confirmClose(false)
        }
      } catch (err) {
        console.error('Error fetching cash session:', err)
        await window.api.confirmClose(false)
      }
    })

    return unsubscribe
  }, [openCloseModal])

  // 5-second countdown for automatic backup
  useEffect(() => {
    if (closeModalStep !== 'countdown_backup') return
    if (backupStatus !== 'idle') return

    if (countdown <= 0) {
      handleStartBackup()
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [closeModalStep, countdown, backupStatus])

  const handleStartBackup = async (): Promise<void> => {
    setBackupStatus('backing_up')
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      const createdPath = await window.api.createBackup()
      setBackupFilePath(createdPath)
      setBackupStatus('completed')
      setTimeout(async () => {
        try {
          await window.api.confirmClose(false)
        } catch (err) {
          console.error('Error closing application after backup:', err)
        }
      }, 1500)
    } catch (err: any) {
      console.error('Error creating backup before close:', err)
      setErrorMessage(err?.message || 'Error al generar la copia de seguridad.')
      setBackupStatus('error')
      setIsProcessing(false)
    }
  }

  const handleNoBackupExit = async (): Promise<void> => {
    setIsProcessing(true)
    try {
      await window.api.confirmClose(false)
    } catch (err) {
      console.error('Error closing application:', err)
    }
  }

  const handleNoCloseCash = async (): Promise<void> => {
    // Leave cash session open and exit immediately
    setIsProcessing(true)
    await window.api.confirmClose(false)
  }

  const handleYesCloseCash = async (): Promise<void> => {
    if (!activeSession) return
    setIsProcessing(true)
    try {
      await window.api.closeCashSession(activeSession.id)
      openCloseModal('countdown_backup')
    } catch (err) {
      console.error('Error closing cash session:', err)
      openCloseModal('countdown_backup')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDiscardCash = async (): Promise<void> => {
    if (!activeSession) return
    setIsProcessing(true)
    try {
      if (window.api?.cash?.discardSession) {
        await window.api.cash.discardSession(activeSession.id)
      } else {
        await window.api.closeCashSession(activeSession.id)
      }
      openCloseModal('countdown_backup')
    } catch (err) {
      console.error('Error discarding cash session:', err)
      openCloseModal('countdown_backup')
    } finally {
      setIsProcessing(false)
    }
  }

  if (closeModalStep === 'closed') return null

  return (
    <div onClick={handleBackdropClick} className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-lilac-200 dark:border-slate-700 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Step 1: "¿Cerrar caja?" */}
        {closeModalStep === 'ask_cash_close' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title="Cancelar y volver"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {!hasSales ? 'No hubieron ventas este período' : '¿Deseas cerrar el turno de caja?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {!hasSales
                ? `Existe una sesión de caja activa abierta (Turno #${activeSession?.id}) sin ventas registradas. Al confirmar, la sesión se cerrará y no se registrará en el historial de cortes.`
                : `Existe una sesión de caja activa abierta (Turno #${activeSession?.id}). Si no la cierras ahora, continuará abierta cuando vuelvas a iniciar la aplicación.`}
            </p>

            <div className="flex flex-col gap-2">
              {!hasSales ? (
                <>
                  <button
                    onClick={handleDiscardCash}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar (no registrar en historial)</span>
                  </button>

                  <button
                    onClick={handleYesCloseCash}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                  >
                    Guardar igual en el historial
                  </button>
                </>
              ) : (
                <button
                  onClick={handleYesCloseCash}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sí, registrar cierre de caja</span>
                </button>
              )}

              <button
                onClick={handleNoCloseCash}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              >
                No, salir y mantener caja abierta
              </button>

              <button
                onClick={handleCancel}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-center font-medium cursor-pointer"
              >
                Cancelar y continuar en el POS
              </button>
            </div>
          </div>
        )}

        {/* Step 2: "Respaldo automático" */}
        {closeModalStep === 'countdown_backup' && (
          <>
            {/* Sub-estado 1: Cuenta regresiva (idle) */}
            {backupStatus === 'idle' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
                      <Archive className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-lilac-100 dark:bg-lilac-950/80 text-lilac-700 dark:text-lilac-300">
                      Respaldo de Seguridad
                    </span>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                    title="Cancelar y permanecer en el POS"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Cierre y Respaldo Automático
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                  Se generará una copia consistente de la base de datos en tus documentos antes de salir.
                </p>

                <div className="bg-lilac-50 dark:bg-slate-900/60 border border-lilac-200 dark:border-slate-700 rounded-xl p-4 text-center mb-6">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cerrando y respaldando automáticamente en:</p>
                  <div className="text-3xl font-extrabold text-lilac-700 dark:text-lilac-300 tracking-wider">
                    {countdown} <span className="text-sm font-medium text-lilac-500 dark:text-lilac-400">segundos</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleStartBackup}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Realizar respaldo ya</span>
                  </button>

                  <button
                    onClick={handleNoBackupExit}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                  >
                    No respaldar y salir
                  </button>

                  <button
                    onClick={handleCancel}
                    disabled={isProcessing}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-center font-medium cursor-pointer"
                  >
                    Cancelar y continuar en el POS
                  </button>
                </div>
              </div>
            )}

            {/* Sub-estado 2: Respaldo en progreso (spinner + barra de carga animada) */}
            {backupStatus === 'backing_up' && (
              <div className="p-8 text-center flex flex-col items-center animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-2xl bg-lilac-50 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-4 border border-lilac-100 dark:border-slate-700 shadow-sm relative">
                  <Loader2 className="w-8 h-8 animate-spin text-lilac-600 dark:text-lilac-400" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                  Generando Respaldo de Seguridad...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs leading-relaxed">
                  Creando una copia consistente de la base de datos antes de salir. Por favor espera y no apagues el equipo.
                </p>

                <div className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                      <span>Progreso del Respaldo</span>
                    </span>
                    <span className="text-lilac-600 dark:text-lilac-400 font-mono font-bold animate-pulse">Guardando...</span>
                  </div>
                  <div className="w-full bg-slate-200/80 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-lilac-500 via-purple-500 to-lilac-600 h-full rounded-full w-full animate-pulse" />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                    Destino: Documentos / Respaldos POS
                  </p>
                </div>
              </div>
            )}

            {/* Sub-estado 3: Respaldo completado con éxito (Check verde + mensaje) */}
            {backupStatus === 'completed' && (
              <div className="p-8 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-300" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                  ¡Respaldo Realizado con Éxito!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 max-w-xs leading-relaxed">
                  La copia de seguridad ha finalizado correctamente. Cerrando la aplicación...
                </p>

                <div className="w-full bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Estado del Respaldo</span>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-mono font-bold">100% Completado</span>
                  </div>
                  <div className="w-full bg-emerald-100 dark:bg-emerald-900/60 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full w-full transition-all duration-300" />
                  </div>
                  {backupFilePath && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center truncate font-mono px-1" title={backupFilePath}>
                      {backupFilePath}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Sub-estado 4: Error al respaldar */}
            {backupStatus === 'error' && (
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-100 dark:border-rose-800 shadow-sm mx-auto">
                  <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 text-center mb-1.5">
                  Error al Realizar el Respaldo
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center mb-4 leading-relaxed">
                  No se pudo generar la copia de seguridad antes de salir:
                </p>

                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-300 font-mono break-all mb-5">
                  {errorMessage || 'Error desconocido al guardar en disco.'}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleStartBackup}
                    className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Reintentar respaldo</span>
                  </button>

                  <button
                    onClick={handleNoBackupExit}
                    className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                  >
                    Salir de todos modos (sin respaldo)
                  </button>

                  <button
                    onClick={handleCancel}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-center font-medium cursor-pointer"
                  >
                    Cancelar y continuar en el POS
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
