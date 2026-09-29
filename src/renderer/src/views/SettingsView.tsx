import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldAlert,
  X,
  Store,
  FolderOpen,
  Archive,
  Keyboard,
  HardDrive,
  RotateCcw,
  Save,
  Info,
  Printer
} from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'
import { useCashStore } from '../store/cashStore'
import { BackupInfo, PrinterConfig, PrinterInfo } from '../../../shared/types'
import { formatDateTime } from '../utils/formatters'

export const SettingsView: React.FC = () => {
  const { fetchProducts, loadMetadata } = useCatalogStore()
  const { checkCurrentSession } = useCashStore()

  // Active section tab
  const [activeSubTab, setActiveSubTab] = useState<'business' | 'printers' | 'backups' | 'shortcuts' | 'danger'>('business')

  // Business settings state
  const [businessName, setBusinessName] = useState('')
  const [businessRut, setBusinessRut] = useState('')
  const [businessActivity, setBusinessActivity] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [ticketFooter, setTicketFooter] = useState('')
  const [isSavingBusiness, setIsSavingBusiness] = useState(false)
  const [businessSavedMessage, setBusinessSavedMessage] = useState<string | null>(null)

  // Backups state
  const [backupDir, setBackupDir] = useState<string>('')
  const [backupsList, setBackupsList] = useState<BackupInfo[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [restoreModalFile, setRestoreModalFile] = useState<BackupInfo | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  // Printer settings state
  const [printersList, setPrintersList] = useState<PrinterInfo[]>([])
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    thermalType: 'epson',
    thermalInterfaceType: 'windows_printer',
    thermalInterface: '',
    paperWidth: '80mm',
    openDrawerOnPrint: true,
    autoPrintOnSale: false,
    normalPrinterName: ''
  })
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false)
  const [printerFeedback, setPrinterFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSavingPrinterConfig, setIsSavingPrinterConfig] = useState(false)

  // Reset database state (Danger zone)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [keepSettings, setKeepSettings] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null)

  // Load all settings & backups & printers
  const loadSettingsAndBackups = useCallback(async () => {
    try {
      const all = await window.api.getAllSettings()
      setBusinessName(all.business_name || '')
      setBusinessRut(all.business_rut || '')
      setBusinessActivity(all.business_activity || '')
      setBusinessAddress(all.business_address || '')
      setBusinessPhone(all.business_phone || '')
      setBusinessEmail(all.business_email || '')
      setTicketFooter(all.ticket_footer_message || '')

      const dir = await window.api.getBackupDirectory()
      setBackupDir(dir)

      const list = await window.api.listBackups()
      setBackupsList(list)

      const pConfig = await window.api.getPrinterConfig()
      setPrinterConfig(pConfig)

      const pList = await window.api.getInstalledPrinters()
      setPrintersList(pList)
    } catch (err) {
      console.error('Error cargando configuraciones y respaldos:', err)
    }
  }, [])

  useEffect(() => {
    loadSettingsAndBackups()
  }, [loadSettingsAndBackups])

  // Save Printer Configuration
  const handleSavePrinterConfig = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault()
    setIsSavingPrinterConfig(true)
    setPrinterFeedback(null)
    try {
      await window.api.savePrinterConfig(printerConfig)
      setPrinterFeedback({
        type: 'success',
        text: '¡Configuración de impresoras guardada correctamente!'
      })
      setTimeout(() => setPrinterFeedback(null), 4000)
    } catch (err: any) {
      setPrinterFeedback({
        type: 'error',
        text: err.message || 'Error al guardar configuración de impresoras.'
      })
    } finally {
      setIsSavingPrinterConfig(false)
    }
  }

  // Refresh OS Printers
  const handleRefreshPrinters = async (): Promise<void> => {
    try {
      const pList = await window.api.getInstalledPrinters()
      setPrintersList(pList)
    } catch (err) {
      console.error('Error refrescando impresoras:', err)
    }
  }

  // Test Thermal Printer
  const handleTestPrinter = async (): Promise<void> => {
    setIsTestingPrinter(true)
    setPrinterFeedback(null)
    try {
      await window.api.savePrinterConfig(printerConfig)
      const res = await window.api.testThermalPrinter(printerConfig)
      if (res.success) {
        setPrinterFeedback({
          type: 'success',
          text: '¡Ticket de prueba enviado exitosamente a la impresora térmica!'
        })
      } else {
        setPrinterFeedback({
          type: 'error',
          text: res.error || 'No se pudo comunicar con la impresora térmica.'
        })
      }
    } catch (err: any) {
      setPrinterFeedback({
        type: 'error',
        text: err.message || 'Error durante la prueba de impresión.'
      })
    } finally {
      setIsTestingPrinter(false)
    }
  }

  // Open Cash Drawer
  const handleOpenCashDrawer = async (): Promise<void> => {
    setIsOpeningDrawer(true)
    setPrinterFeedback(null)
    try {
      await window.api.savePrinterConfig(printerConfig)
      const res = await window.api.openCashDrawer(printerConfig)
      if (res.success) {
        setPrinterFeedback({
          type: 'success',
          text: '¡Pulso de apertura emitido al cajón de dinero!'
        })
      } else {
        setPrinterFeedback({
          type: 'error',
          text: res.error || 'No se pudo emitir el pulso al cajón.'
        })
      }
    } catch (err: any) {
      setPrinterFeedback({
        type: 'error',
        text: err.message || 'Error al enviar pulso al cajón.'
      })
    } finally {
      setIsOpeningDrawer(false)
    }
  }

  // Save Business Data
  const handleSaveBusinessData = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSavingBusiness(true)
    setBusinessSavedMessage(null)

    try {
      await window.api.setSetting('business_name', businessName.trim())
      await window.api.setSetting('business_rut', businessRut.trim())
      await window.api.setSetting('business_activity', businessActivity.trim())
      await window.api.setSetting('business_address', businessAddress.trim())
      await window.api.setSetting('business_phone', businessPhone.trim())
      await window.api.setSetting('business_email', businessEmail.trim())
      await window.api.setSetting('ticket_footer_message', ticketFooter.trim())

      setBusinessSavedMessage('¡Datos del negocio guardados correctamente!')
      setTimeout(() => setBusinessSavedMessage(null), 4000)
    } catch (err: any) {
      console.error('Error guardando datos del negocio:', err)
    } finally {
      setIsSavingBusiness(false)
    }
  }

  // Backup operations
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
      await loadSettingsAndBackups()

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

  // Reset Database operations
  const handleOpenResetModal = (): void => {
    setConfirmText('')
    setResetSuccessMessage(null)
    setResetErrorMessage(null)
    setIsResetModalOpen(true)
  }

  const handleExecuteReset = async (): Promise<void> => {
    if (confirmText.trim().toUpperCase() !== 'VACIAR') return

    setIsResetting(true)
    setResetErrorMessage(null)

    try {
      await window.api.resetDatabase(keepSettings)

      await fetchProducts()
      await loadMetadata()
      await checkCurrentSession()
      await loadSettingsAndBackups()

      setIsResetModalOpen(false)
      setResetSuccessMessage(
        'La base de datos ha sido vaciada con éxito. El sistema está 100% limpio y listo para nuevas operaciones.'
      )
    } catch (err: any) {
      setResetErrorMessage(err.message || 'Error al vaciar la base de datos.')
    } finally {
      setIsResetting(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="flex-1 p-6 bg-slate-50 flex flex-col gap-6 overflow-y-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Configuración del Sistema</h1>
            <p className="text-xs text-slate-500">
              Datos comerciales, copias de seguridad automáticas, atajos de teclado y mantenimiento.
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('business')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'business'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Datos del Negocio</span>
          </button>
          <button
            onClick={() => setActiveSubTab('printers')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'printers'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Impresoras y Periféricos</span>
          </button>
          <button
            onClick={() => setActiveSubTab('backups')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'backups'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Respaldos</span>
          </button>
          <button
            onClick={() => setActiveSubTab('shortcuts')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'shortcuts'
                ? 'bg-lilac-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Atajos de Teclado</span>
          </button>
          <button
            onClick={() => setActiveSubTab('danger')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'danger'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mantenimiento</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {resetSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{resetSuccessMessage}</span>
          </div>
          <button onClick={() => setResetSuccessMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* SUB-TAB 1: DATOS DEL NEGOCIO */}
      {activeSubTab === 'business' && (
        <form onSubmit={handleSaveBusinessData} className="max-w-3xl space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-lilac-600" />
                <h2 className="text-sm font-bold text-slate-800">Identificación y Datos Comerciales</h2>
              </div>
              <span className="text-xs text-slate-400">Se imprimirán en el encabezado de boletas y tickets</span>
            </div>

            {businessSavedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{businessSavedMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Comercial / Razón Social</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Lanas & Tejidos Mave"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">RUT del Negocio</label>
                <input
                  type="text"
                  value={businessRut}
                  onChange={(e) => setBusinessRut(e.target.value)}
                  placeholder="Ej: 76.123.456-7"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Giro Comercial</label>
                <input
                  type="text"
                  value={businessActivity}
                  onChange={(e) => setBusinessActivity(e.target.value)}
                  placeholder="Ej: Venta de Lanas, Hilos y Artículos de Costura"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección del Local</label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Ej: Av. Providencia 1234, Local 5, Santiago"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="Ej: +56 9 1234 5678"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico de Contacto</label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="Ej: contacto@lanasmave.cl"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Mensaje de Pie de Ticket</label>
                <textarea
                  rows={2}
                  value={ticketFooter}
                  onChange={(e) => setTicketFooter(e.target.value)}
                  placeholder="Ej: ¡Muchas gracias por su preferencia! Cambios dentro de 30 días presentando este comprobante."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingBusiness}
                className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingBusiness ? 'Guardando...' : 'Guardar Datos del Negocio'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB: IMPRESORAS Y PERIFÉRICOS */}
      {activeSubTab === 'printers' && (
        <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
          {/* Feedback banner */}
          {printerFeedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
                printerFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {printerFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-semibold">{printerFeedback.text}</span>
              </div>
              <button
                onClick={() => setPrinterFeedback(null)}
                className="text-slate-400 hover:text-slate-600 font-bold ml-4"
              >
                ×
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSavePrinterConfig} className="space-y-6">
            {/* Card 1: Impresora Térmica */}
            <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-lilac-600" />
                  <h2 className="text-sm font-bold text-slate-800">Impresora Térmica de Tickets (ESC/POS)</h2>
                </div>
                <span className="text-xs text-slate-400">Emisión de boletas de venta y comprobantes de caja</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Tipo de Interfaz */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Conexión</label>
                  <select
                    value={printerConfig.thermalInterfaceType}
                    onChange={(e) =>
                      setPrinterConfig({
                        ...printerConfig,
                        thermalInterfaceType: e.target.value as any
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 bg-white"
                  >
                    <option value="windows_printer">Impresora instalada en Windows (Spooler)</option>
                    <option value="tcp">Red Ethernet / WiFi (TCP/IP)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {printerConfig.thermalInterfaceType === 'windows_printer'
                      ? 'Recomendado: utiliza el controlador de Windows configurado en el equipo.'
                      : 'Conexión directa por socket IP (ej: tcp://192.168.1.100:9100).'}
                  </p>
                </div>

                {/* Selección de Impresora o Destino */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      {printerConfig.thermalInterfaceType === 'windows_printer'
                        ? 'Impresora Térmica de Windows'
                        : 'Dirección IP / Puerto'}
                    </label>
                    {printerConfig.thermalInterfaceType === 'windows_printer' && (
                      <button
                        type="button"
                        onClick={handleRefreshPrinters}
                        className="text-[11px] font-semibold text-lilac-600 hover:text-lilac-700 flex items-center gap-1"
                        title="Actualizar lista de impresoras de Windows"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Detectar</span>
                      </button>
                    )}
                  </div>

                  {printerConfig.thermalInterfaceType === 'windows_printer' ? (
                    <select
                      value={printerConfig.thermalInterface}
                      onChange={(e) =>
                        setPrinterConfig({
                          ...printerConfig,
                          thermalInterface: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 bg-white"
                    >
                      <option value="">-- Seleccionar impresora térmica --</option>
                      {printersList.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName || p.name} {p.isDefault ? '(Predeterminada del sistema)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={printerConfig.thermalInterface}
                      onChange={(e) =>
                        setPrinterConfig({
                          ...printerConfig,
                          thermalInterface: e.target.value
                        })
                      }
                      placeholder="tcp://192.168.1.100:9100"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-mono text-slate-800"
                    />
                  )}
                </div>

                {/* Protocolo / Driver */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Protocolo ESC/POS</label>
                  <select
                    value={printerConfig.thermalType}
                    onChange={(e) =>
                      setPrinterConfig({
                        ...printerConfig,
                        thermalType: e.target.value as any
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 bg-white"
                  >
                    <option value="epson">Epson ESC/POS (Estándar compatible genérico)</option>
                    <option value="star">Star Micronics (Modo Star Line)</option>
                  </select>
                </div>

                {/* Ancho del Papel */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ancho del Rollo de Papel</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '80mm' })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        printerConfig.paperWidth === '80mm'
                          ? 'border-lilac-500 bg-lilac-50/70 text-lilac-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-xs">80 mm</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">48 columnas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '58mm' })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        printerConfig.paperWidth === '58mm'
                          ? 'border-lilac-500 bg-lilac-50/70 text-lilac-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-xs">58 mm</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">32 columnas</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Cajón de Dinero y Automatización */}
            <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-lilac-600" />
                  <h2 className="text-sm font-bold text-slate-800">Cajón de Dinero y Automatización</h2>
                </div>
                <span className="text-xs text-slate-400">Pulsos ESC/POS y flujos en caja</span>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerConfig.openDrawerOnPrint}
                    onChange={(e) =>
                      setPrinterConfig({
                        ...printerConfig,
                        openDrawerOnPrint: e.target.checked
                      })
                    }
                    className="mt-0.5 rounded border-slate-300 text-lilac-600 focus:ring-lilac-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Abrir cajón de dinero automáticamente</span>
                    <span className="text-slate-500 text-[11px]">
                      Envía un pulso de apertura estándar RJ11 a través de la impresora térmica al imprimir cada ticket.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={printerConfig.autoPrintOnSale}
                    onChange={(e) =>
                      setPrinterConfig({
                        ...printerConfig,
                        autoPrintOnSale: e.target.checked
                      })
                    }
                    className="mt-0.5 rounded border-slate-300 text-lilac-600 focus:ring-lilac-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Imprimir ticket automáticamente al cobrar</span>
                    <span className="text-slate-500 text-[11px]">
                      Al confirmar el pago de una venta en caja, imprime el ticket de inmediato sin esperar confirmación adicional.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Card 3: Impresora Normal de Documentos (A4 / Hoja Completa) */}
            <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-lilac-600" />
                  <h2 className="text-sm font-bold text-slate-800">Impresora Normal de Windows (A4 / Carta)</h2>
                </div>
                <span className="text-xs text-slate-400">Para comprobantes de tamaño carta o facturas completas</span>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-slate-700 mb-1">Dispositivo de Windows</label>
                <select
                  value={printerConfig.normalPrinterName || ''}
                  onChange={(e) =>
                    setPrinterConfig({
                      ...printerConfig,
                      normalPrinterName: e.target.value
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 bg-white"
                >
                  <option value="">-- Impresora predeterminada del sistema --</option>
                  {printersList.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? '(Predeterminada del sistema)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Si no se especifica, se usará la impresora predeterminada de Windows para impresiones normales.
                </p>
              </div>
            </div>

            {/* Action Buttons & Testing */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestPrinter}
                  disabled={isTestingPrinter}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 text-lilac-600" />
                  <span>{isTestingPrinter ? 'Imprimiendo test...' : 'Probar Impresión de Ticket'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCashDrawer}
                  disabled={isOpeningDrawer}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isOpeningDrawer ? 'Enviando pulso...' : 'Probar Apertura de Cajón'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSavingPrinterConfig}
                className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPrinterConfig ? 'Guardando...' : 'Guardar Configuración de Impresión'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: RESPALDOS (BACKUPS) */}
      {activeSubTab === 'backups' && (
        <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
          {/* Notification */}
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
              <button onClick={() => setBackupMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">
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
        </div>
      )}

      {/* SUB-TAB 3: ATAJOS DE TECLADO */}
      {activeSubTab === 'shortcuts' && (
        <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-lilac-600" />
                <h2 className="text-sm font-bold text-slate-800">Guía de Atajos de Teclado del POS</h2>
              </div>
              <span className="text-xs text-slate-400">Optimizado para escáner HID y operación sin mouse</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Navigation Column */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-lilac-500" />
                  Navegación entre Pantallas
                </h3>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Pantalla de Ventas</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F1
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Catálogo de Productos</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F2
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Control de Inventario</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F3
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Historial de Ventas</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F4
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Corte de Caja (Arqueo)</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F5
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Reportes y Métricas</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F6
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Configuración</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F7
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Sales & Terminal Operations */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Operación en Punto de Venta
                </h3>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Cobrar Venta (Checkout)</span>
                    <kbd className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-mono font-bold text-emerald-700 shadow-xs">
                      F12
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Buscar Producto (Modal con %)</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-lilac-700 shadow-xs">
                      F10
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Confirmar Código Escaneado</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                      Enter
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Cerrar Modal / Cancelar</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                      Esc
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Cerrar Sistema POS</span>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-700 shadow-xs">
                      Alt + F4
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MANTENIMIENTO Y ZONA DE PELIGRO */}
      {activeSubTab === 'danger' && (
        <div className="max-w-2xl space-y-6 animate-in fade-in duration-150">
          {/* System Info Card */}
          <div className="bg-white rounded-2xl border border-lilac-100 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Database className="w-4 h-4 text-lilac-600" />
              <span>Estado de la Base de Datos Local</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 font-medium">Motor de BD</span>
                <span className="font-bold text-slate-700">SQLite (better-sqlite3)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 font-medium">Modo de Operación</span>
                <span className="font-bold text-emerald-600">WAL (Write-Ahead Logging) 100% Offline</span>
              </div>
            </div>
          </div>

          {/* Temporary Danger Zone */}
          <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              Temporal · Desarrollo
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-16">
                <h2 className="text-sm font-bold text-slate-800">Vaciar Base de Datos</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Elimina todos los datos operacionales: catálogo de productos, categorías, proveedores,
                  existencias, historial de inventario / kardex, sesiones de caja y ventas registradas.
                  Deja el sistema completamente limpio para reiniciar pruebas o reimportar desde cero.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-400 italic">
                Esta función está pensada para etapas de prueba y configuración inicial.
              </span>
              <button
                onClick={handleOpenResetModal}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vaciar Base de Datos...</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-800 font-bold text-base">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>¿Vaciar toda la base de datos?</span>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-red-100/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-600">
              {resetErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                  {resetErrorMessage}
                </div>
              )}

              <p className="font-semibold text-slate-800">
                Se eliminarán permanentemente los siguientes registros:
              </p>

              <ul className="space-y-1.5 pl-2">
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todos los productos simples, variables y variaciones
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todas las categorías y proveedores asociados
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todo el historial de ventas, comprobantes y pagos
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todas las sesiones de caja, arqueos y salidas de dinero
                </li>
                <li className="flex items-center gap-2 text-red-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Todo el historial de kardex y movimientos de inventario
                </li>
              </ul>

              {/* Keep settings checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepSettings}
                    onChange={(e) => setKeepSettings(e.target.checked)}
                    className="w-4 h-4 rounded text-lilac-600 focus:ring-lilac-500 accent-lilac-600 cursor-pointer"
                  />
                  <span>Preservar datos del negocio y rutas de respaldo</span>
                </label>
              </div>

              {/* Safety text challenge */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Para confirmar, escribe la palabra <span className="text-red-600 font-mono font-extrabold">VACIAR</span>:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escribe VACIAR..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl text-xs text-slate-800 font-mono focus:outline-none uppercase"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmText.trim().toUpperCase() !== 'VACIAR' || isResetting}
                onClick={handleExecuteReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Vaciando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Vaciar Definitivamente</span>
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
