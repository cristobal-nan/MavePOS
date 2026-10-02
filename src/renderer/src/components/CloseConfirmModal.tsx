import React, { useEffect, useState } from 'react'
import { AlertCircle, Archive, CheckCircle2, ShieldCheck, X } from 'lucide-react'
import { CashSession } from '@shared/types'
import { useUIStore } from '../store/uiStore'
import { useModalStack } from '../utils/modalStack'

export const CloseConfirmModal: React.FC = () => {
  const { closeModalStep, openCloseModal, closeCloseModal } = useUIStore()
  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleCancel = (): void => {
    closeCloseModal()
    setIsProcessing(false)
  }

  const { handleBackdropClick } = useModalStack({
    id: 'close-confirm-modal',
    isOpen: closeModalStep !== 'closed',
    onClose: handleCancel,
    closeOnBackdrop: true
  })

  // Reset countdown each time we enter 'countdown_backup'
  useEffect(() => {
    if (closeModalStep === 'countdown_backup') {
      setCountdown(5)
      setIsProcessing(false)
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

    if (countdown <= 0) {
      handleConfirmExit(true)
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [closeModalStep, countdown])


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

  const handleConfirmExit = async (shouldBackup: boolean): Promise<void> => {
    setIsProcessing(true)
    try {
      await window.api.confirmClose(shouldBackup)
    } catch (err) {
      console.error('Error closing application:', err)
    }
  }

  if (closeModalStep === 'closed') return null

  return (
    <div onClick={handleBackdropClick} className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Step 1: "¿Cerrar caja?" */}
        {closeModalStep === 'ask_cash_close' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Cancelar y volver"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              ¿Deseas cerrar el turno de caja?
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Existe una sesión de caja activa abierta (Turno #{activeSession?.id}).
              Si no la cierras ahora, continuará abierta cuando vuelvas a iniciar la aplicación.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleYesCloseCash}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sí, registrar cierre de caja</span>
              </button>

              <button
                onClick={handleNoCloseCash}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              >
                No, salir y mantener caja abierta
              </button>

              <button
                onClick={handleCancel}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 text-center font-medium cursor-pointer"
              >
                Cancelar y continuar en el POS
              </button>
            </div>
          </div>
        )}

        {/* Step 2: "Respaldo automático con cuenta regresiva" */}
        {closeModalStep === 'countdown_backup' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center">
                  <Archive className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-lilac-100 text-lilac-700">
                  Respaldo de Seguridad
                </span>
              </div>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Cancelar y permanecer en el POS"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Cierre y Respaldo Automático
            </h3>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Se generará una copia consistente de la base de datos en tus documentos antes de salir.
            </p>

            <div className="bg-lilac-50 border border-lilac-200 rounded-xl p-4 text-center mb-6">
              <p className="text-xs text-slate-500 mb-1">Cerrando y respaldando automáticamente en:</p>
              <div className="text-3xl font-extrabold text-lilac-700 tracking-wider">
                {countdown} <span className="text-sm font-medium text-lilac-500">segundos</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleConfirmExit(true)}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Realizar respaldo ya</span>
              </button>

              <button
                onClick={() => handleConfirmExit(false)}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              >
                No respaldar y salir
              </button>

              <button
                onClick={handleCancel}
                disabled={isProcessing}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 text-center font-medium cursor-pointer"
              >
                Cancelar y continuar en el POS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
