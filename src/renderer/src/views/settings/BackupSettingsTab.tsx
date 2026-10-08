import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  HardDrive,
  FolderOpen,
  Archive,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Loader2,
  FileUp
} from 'lucide-react'
import { BackupInfo } from '@shared/types'
import { formatDateTime } from '../../utils/formatters'
import { useCatalogStore } from '../../store/catalogStore'
import { useCashStore } from '../../store/cashStore'

export const BackupSettingsTab: React.FC = () => {
  const { fetchProducts, loadMetadata } = useCatalogStore()
  const { checkCurrentSession } = useCashStore()

  const [backupDir, setBackupDir] = useState<string>('')
  const [backupsList, setBackupsList] = useState<BackupInfo[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [backupButtonState, setBackupButtonState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [restoreModalFile, setRestoreModalFile] = useState<BackupInfo | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isValidatingExternal, setIsValidatingExternal] = useState(false)
  const backupSuccessTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadBackupData = useCallback(async () => {
    try {
      const dir = await window.api.getBackupDirectory()
      setBackupDir(dir)
      const list = await window.api.listBackups()
      setBackupsList(list)
    } catch (err) {
      console.error('Error cargando información de respaldos:', err)
    }
  }, [])

  useEffect(() => {
    loadBackupData()
    return () => {
      if (backupSuccessTimerRef.current) {
        clearTimeout(backupSuccessTimerRef.current)
      }
    }
  }, [loadBackupData])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const showToast = (type: 'success' | 'error', text: string): void => {
    setBackupMessage({ type, text })
    setTimeout(() => {
      setBackupMessage(null)
    }, 4000)
  }

  const handleCreateBackup = async (): Promise<void> => {
    if (backupSuccessTimerRef.current) {
      clearTimeout(backupSuccessTimerRef.current)
    }
    setIsCreatingBackup(true)
    setBackupButtonState('loading')
    setBackupMessage(null)
    try {
      await window.api.createBackup()
      const list = await window.api.listBackups()
      setBackupsList(list)
      setBackupButtonState('success')
      backupSuccessTimerRef.current = setTimeout(() => {
        setBackupButtonState('idle')
      }, 3000)
    } catch (err: any) {
      showToast('error', err.message || 'Error al generar respaldo manual.')
      setBackupButtonState('error')
      backupSuccessTimerRef.current = setTimeout(() => {
        setBackupButtonState('idle')
      }, 3500)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleSelectBackupDir = async (): Promise<void> => {
    try {
      const chosen = await window.api.selectBackupDirectory()
      if (chosen) {
        setBackupDir(chosen)
        const list = await window.api.listBackups()
        setBackupsList(list)
        showToast('success', `Carpeta de respaldos actualizada a: ${chosen}`)
      }
    } catch (err: any) {
      console.error('Error seleccionando carpeta de respaldos:', err)
    }
  }

  const handleOpenBackupDir = async (): Promise<void> => {
    try {
      await window.api.openBackupDirectory()
    } catch (err) {
      console.error('Error abriendo carpeta de respaldos:', err)
    }
  }

  const handleSelectExternalBackup = async (): Promise<void> => {
    setIsValidatingExternal(true)
    try {
      const selected = await window.api.selectExternalBackup()
      if (selected) {
        setRestoreModalFile(selected)
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error al validar el archivo de respaldo seleccionado.')
    } finally {
      setIsValidatingExternal(false)
    }
  }

  const handleConfirmRestore = async (): Promise<void> => {
    if (!restoreModalFile) return
    setIsRestoring(true)
    try {
      await window.api.restoreBackup(restoreModalFile.filepath)

      // Refresh stores so the whole application immediately reflects restored database
      await fetchProducts()
      await loadMetadata()
      await checkCurrentSession()
      await loadBackupData()

      showToast('success', `Base de datos restaurada con éxito desde: ${restoreModalFile.filename}`)
      setRestoreModalFile(null)
    } catch (err: any) {
      showToast('error', err.message || 'Error al restaurar el archivo de respaldo.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150">
      {/* Directory & Create Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-lilac-100 dark:border-slate-700 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Directorio y Respaldo Inmediato</h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-400">Retención automática de los últimos 7 respaldos</span>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/80">
          <div className="space-y-1 overflow-hidden">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Carpeta de Almacenamiento
            </span>
            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate" title={backupDir}>
              {backupDir || 'Cargando directorio...'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSelectBackupDir}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            >
              Cambiar Carpeta...
            </button>
            <button
              onClick={handleOpenBackupDir}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <FolderOpen className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <span>Abrir Carpeta</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-lilac-600 dark:text-lilac-400 shrink-0" />
            <span>
              Los respaldos se generan de forma consistente con WAL sin interrumpir las ventas en curso.
            </span>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0 ${
              backupButtonState === 'loading'
                ? 'bg-lilac-700 cursor-wait opacity-90'
                : backupButtonState === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-600 shadow-emerald-200'
                : backupButtonState === 'error'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-lilac-600 hover:bg-lilac-700 active:scale-95 cursor-pointer'
            }`}
          >
            {backupButtonState === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generando respaldo...</span>
              </>
            ) : backupButtonState === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4 animate-in zoom-in-75 duration-200 text-white" />
                <span>¡Respaldo Realizado!</span>
              </>
            ) : backupButtonState === 'error' ? (
              <>
                <AlertTriangle className="w-4 h-4 text-white" />
                <span>Error al respaldar</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span>Crear Respaldo Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Existing Backups List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-lilac-100 dark:border-slate-700 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Respaldos Existentes</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 dark:text-slate-400">{backupsList.length} archivos disponibles</span>
            <button
              type="button"
              onClick={handleSelectExternalBackup}
              disabled={isValidatingExternal}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isValidatingExternal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-lilac-600 dark:text-lilac-400" />
              ) : (
                <FileUp className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
              )}
              <span>Seleccionar archivo...</span>
            </button>
          </div>
        </div>

        {backupsList.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200/70 dark:border-slate-700 overflow-hidden">
            {backupsList.map((backup) => (
              <div
                key={backup.filename}
                className="p-3.5 flex items-center justify-between hover:bg-lilac-50/30 dark:hover:bg-slate-700/40 transition-colors text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{backup.filename}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {formatFileSize(backup.sizeBytes)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400">
                    Fecha: {formatDateTime(backup.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRestoreModalFile(backup)}
                    className="px-3 py-1.5 bg-lilac-50 dark:bg-lilac-950/40 hover:bg-lilac-100 dark:hover:bg-lilac-900/60 text-lilac-700 dark:text-lilac-300 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar...</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3">
            <p>No hay copias de seguridad generadas en la carpeta seleccionada.</p>
            <button
              type="button"
              onClick={handleSelectExternalBackup}
              disabled={isValidatingExternal}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <FileUp className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
              <span>Examinar respaldo externo...</span>
            </button>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-800/60 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-base">
                <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>¿Restaurar copia de respaldo?</span>
              </div>
              <button
                onClick={() => setRestoreModalFile(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Estás a punto de restaurar la base de datos con el siguiente archivo:
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100">{restoreModalFile.filename}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fecha: {formatDateTime(restoreModalFile.createdAt)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tamaño: {formatFileSize(restoreModalFile.sizeBytes)}
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Atención: Acción destructiva
                </p>
                <p className="text-[11px] leading-relaxed">
                  Todos los datos creados con posterioridad a esta fecha serán reemplazados por el contenido
                  del respaldo.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreModalFile(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Restauración</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Flotante Fijo (Bottom-Right, Cero Layout Shift) */}
      {backupMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none max-w-md ${
            backupMessage.type === 'success'
              ? 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
              : 'bg-white dark:bg-slate-800 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
          }`}
        >
          {backupMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{backupMessage.text}</span>
          <button
            onClick={() => setBackupMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold ml-2 shrink-0 cursor-pointer text-base leading-none"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
