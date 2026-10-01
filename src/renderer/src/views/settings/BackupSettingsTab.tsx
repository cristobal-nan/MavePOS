import React, { useState, useEffect, useCallback } from 'react'
import {
  HardDrive,
  FolderOpen,
  Archive,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw
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
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [restoreModalFile, setRestoreModalFile] = useState<BackupInfo | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

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
  }, [loadBackupData])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const handleCreateBackup = async (): Promise<void> => {
    setIsCreatingBackup(true)
    setBackupMessage(null)
    try {
      const filePath = await window.api.createBackup()
      const list = await window.api.listBackups()
      setBackupsList(list)
      setBackupMessage({
        type: 'success',
        text: `Respaldo manual creado con éxito: ${filePath}`
      })
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: err.message || 'Error al generar respaldo manual.'
      })
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
        setBackupMessage({
          type: 'success',
          text: `Carpeta de respaldos actualizada a: ${chosen}`
        })
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

      setBackupMessage({
        type: 'success',
        text: `Base de datos restaurada con éxito desde: ${restoreModalFile.filename}`
      })
      setRestoreModalFile(null)
    } catch (err: any) {
      setBackupMessage({
        type: 'error',
        text: err.message || 'Error al restaurar el archivo de respaldo.'
      })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
      {/* Notification banner */}
      {backupMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            backupMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {backupMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{backupMessage.text}</span>
          </div>
          <button
            onClick={() => setBackupMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Directory & Create Card */}
      <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-lilac-600" />
            <h2 className="text-sm font-bold text-slate-800">Directorio y Respaldo Inmediato</h2>
          </div>
          <span className="text-xs text-slate-400">Retención automática de los últimos 7 respaldos</span>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
          <div className="space-y-1 overflow-hidden">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Carpeta de Almacenamiento
            </span>
            <p className="text-xs font-mono font-bold text-slate-700 truncate" title={backupDir}>
              {backupDir || 'Cargando directorio...'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSelectBackupDir}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors shadow-sm"
            >
              Cambiar Carpeta...
            </button>
            <button
              onClick={handleOpenBackupDir}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <FolderOpen className="w-4 h-4 text-lilac-600" />
              <span>Abrir Carpeta</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-lilac-600 shrink-0" />
            <span>
              Los respaldos se generan de forma consistente con WAL sin interrumpir las ventas en curso.
            </span>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 active:scale-95 shrink-0"
          >
            <Archive className="w-4 h-4" />
            <span>{isCreatingBackup ? 'Generando copia...' : 'Crear Respaldo Ahora'}</span>
          </button>
        </div>
      </div>

      {/* Existing Backups List */}
      <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-lilac-600" />
            <h2 className="text-sm font-bold text-slate-800">Respaldos Existentes</h2>
          </div>
          <span className="text-xs text-slate-400">{backupsList.length} archivos disponibles</span>
        </div>

        {backupsList.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 overflow-hidden">
            {backupsList.map((backup) => (
              <div
                key={backup.filename}
                className="p-3.5 flex items-center justify-between hover:bg-lilac-50/30 transition-colors text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 font-mono">{backup.filename}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {formatFileSize(backup.sizeBytes)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Fecha: {formatDateTime(backup.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRestoreModalFile(backup)}
                    className="px-3 py-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar...</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No hay copias de seguridad generadas en la carpeta seleccionada.
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <span>¿Restaurar copia de respaldo?</span>
              </div>
              <button
                onClick={() => setRestoreModalFile(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-amber-100/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Estás a punto de restaurar la base de datos con el siguiente archivo:
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-slate-800 space-y-1">
                <p className="font-bold">{restoreModalFile.filename}</p>
                <p className="text-[11px] text-slate-500">
                  Fecha: {formatDateTime(restoreModalFile.createdAt)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Tamaño: {formatFileSize(restoreModalFile.sizeBytes)}
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Atención: Acción destructiva
                </p>
                <p className="text-[11px] leading-relaxed">
                  Todos los datos creados con posterioridad a esta fecha serán reemplazados por el contenido
                  del respaldo.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreModalFile(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold transition-colors"
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
    </div>
  )
}
