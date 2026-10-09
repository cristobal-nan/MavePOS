import React, { useState, useEffect, useCallback } from 'react'
import { Printer, Archive, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Eye } from 'lucide-react'
import { PrinterConfig, PrinterInfo } from '@shared/types'
import { useSettingsStore, DirtyFieldChange } from '../../store/settingsStore'
import { ThermalTicketPreviewModal } from '../../components/ThermalTicketPreviewModal'

const DEFAULT_CONFIG: PrinterConfig = {
  thermalType: 'epson',
  thermalInterfaceType: 'windows_printer',
  thermalInterface: '',
  paperWidth: '80mm',
  openDrawerOnPrint: true,
  autoPrintOnSale: false,
  normalPrinterName: ''
}

export const PrinterSettingsTab: React.FC = () => {
  const [printersList, setPrintersList] = useState<PrinterInfo[]>([])
  const [initialConfig, setInitialConfig] = useState<PrinterConfig>(DEFAULT_CONFIG)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_CONFIG)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false)
  const [printerFeedback, setPrinterFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const registerSubTabState = useSettingsStore((s) => s.registerSubTabState)
  const clearSubTabState = useSettingsStore((s) => s.clearSubTabState)

  useEffect(() => {
    let isMounted = true
    Promise.all([window.api.getPrinterConfig(), window.api.getInstalledPrinters()])
      .then(([config, list]) => {
        if (!isMounted) return
        setInitialConfig(config)
        setPrinterConfig(config)
        setPrintersList(list)
        setIsLoaded(true)
      })
      .catch((err) => {
        console.error('Error cargando configuración de impresoras:', err)
      })

    return () => {
      isMounted = false
      clearSubTabState()
    }
  }, [clearSubTabState])

  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await window.api.savePrinterConfig(printerConfig)
      setInitialConfig({ ...printerConfig })
      return true
    } catch (err: any) {
      console.error('Error guardando configuración de impresoras:', err)
      return false
    }
  }, [printerConfig])

  const handleDiscard = useCallback((): void => {
    setPrinterConfig({ ...initialConfig })
  }, [initialConfig])

  // Track dirty changes
  useEffect(() => {
    if (!isLoaded) return

    const changes: DirtyFieldChange[] = []
    if (printerConfig.thermalType !== initialConfig.thermalType) {
      changes.push({ field: 'Modelo Impresora Térmica', value: printerConfig.thermalType })
    }
    if (printerConfig.thermalInterfaceType !== initialConfig.thermalInterfaceType) {
      changes.push({ field: 'Tipo Conexión Térmica', value: printerConfig.thermalInterfaceType })
    }
    if (printerConfig.thermalInterface !== initialConfig.thermalInterface) {
      changes.push({ field: 'Puerto / Dispositivo Térmico', value: printerConfig.thermalInterface || '(ninguno)' })
    }
    if (printerConfig.paperWidth !== initialConfig.paperWidth) {
      changes.push({ field: 'Ancho de Papel', value: printerConfig.paperWidth })
    }
    if (printerConfig.openDrawerOnPrint !== initialConfig.openDrawerOnPrint) {
      changes.push({
        field: 'Apertura de Cajón al Imprimir',
        value: printerConfig.openDrawerOnPrint ? 'Activado' : 'Desactivado'
      })
    }
    if (printerConfig.autoPrintOnSale !== initialConfig.autoPrintOnSale) {
      changes.push({
        field: 'Impresión Automática en Venta',
        value: printerConfig.autoPrintOnSale ? 'Activado' : 'Desactivado'
      })
    }
    if (printerConfig.normalPrinterName !== initialConfig.normalPrinterName) {
      changes.push({
        field: 'Impresora Estándar Windows',
        value: printerConfig.normalPrinterName || '(ninguna)'
      })
    }

    const isDirty = changes.length > 0
    registerSubTabState(isDirty, changes, handleSave, handleDiscard)
  }, [printerConfig, initialConfig, isLoaded, handleSave, handleDiscard, registerSubTabState])

  const handleRefreshPrinters = async (): Promise<void> => {
    try {
      const pList = await window.api.getInstalledPrinters()
      setPrintersList(pList)
    } catch (err) {
      console.error('Error refrescando impresoras:', err)
    }
  }

  const showFeedback = (type: 'success' | 'error', text: string): void => {
    setPrinterFeedback({ type, text })
    if (type === 'success') {
      setTimeout(() => {
        setPrinterFeedback((curr) => (curr?.text === text ? null : curr))
      }, 4000)
    }
  }

  const handleTestPrinter = async (): Promise<void> => {
    setIsTestingPrinter(true)
    setPrinterFeedback(null)
    try {
      await window.api.savePrinterConfig(printerConfig)
      const res = await window.api.testThermalPrinter(printerConfig)
      if (res.success) {
        showFeedback('success', '¡Ticket de prueba enviado exitosamente a la impresora térmica!')
      } else {
        showFeedback('error', res.error || 'No se pudo comunicar con la impresora térmica.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Error durante la prueba de impresión.')
    } finally {
      setIsTestingPrinter(false)
    }
  }

  const handleOpenCashDrawer = async (): Promise<void> => {
    setIsOpeningDrawer(true)
    setPrinterFeedback(null)
    try {
      await window.api.savePrinterConfig(printerConfig)
      const res = await window.api.openCashDrawer(printerConfig)
      if (res.success) {
        showFeedback('success', '¡Pulso de apertura emitido al cajón de dinero!')
      } else {
        showFeedback('error', res.error || 'No se pudo emitir el pulso al cajón.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Error al enviar pulso al cajón.')
    } finally {
      setIsOpeningDrawer(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
        className="space-y-6"
      >
        {/* Card 1: Impresora Térmica */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Impresora Térmica de Tickets (ESC/POS)</h2>
            </div>
            <span className="text-xs text-slate-400">Emisión de boletas de venta y comprobantes de caja</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Conexión</label>
              <select
                value={printerConfig.thermalInterfaceType}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    thermalInterfaceType: e.target.value as any
                  })
                }
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {printerConfig.thermalInterfaceType === 'windows_printer'
                    ? 'Impresora Térmica de Windows'
                    : 'Dirección IP / Puerto'}
                </label>
                {printerConfig.thermalInterfaceType === 'windows_printer' && (
                  <button
                    type="button"
                    onClick={handleRefreshPrinters}
                    className="text-[11px] font-semibold text-lilac-600 dark:text-lilac-400 hover:text-lilac-700 flex items-center gap-1 cursor-pointer"
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
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
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
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
                />
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Protocolo ESC/POS</label>
              <select
                value={printerConfig.thermalType}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    thermalType: e.target.value as any
                  })
                }
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
              >
                <option value="epson">Epson ESC/POS (Estándar compatible genérico)</option>
                <option value="star">Star Micronics (Modo Star Line)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ancho del Rollo de Papel</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '80mm' })}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    printerConfig.paperWidth === '80mm'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="block text-xs">80 mm</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">48 columnas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '58mm' })}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    printerConfig.paperWidth === '58mm'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Cajón de Dinero y Automatización</h2>
            </div>
            <span className="text-xs text-slate-400">Pulsos ESC/POS y flujos en caja</span>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={printerConfig.openDrawerOnPrint}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    openDrawerOnPrint: e.target.checked
                  })
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-lilac-600 focus:ring-lilac-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Abrir cajón de dinero automáticamente</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Envía un pulso de apertura estándar RJ11 a través de la impresora térmica al imprimir cada ticket.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={printerConfig.autoPrintOnSale}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    autoPrintOnSale: e.target.checked
                  })
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-lilac-600 focus:ring-lilac-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Imprimir ticket automáticamente al cobrar</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Al confirmar el pago de una venta en caja, imprime el ticket de inmediato sin esperar confirmación adicional.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Card 3: Impresora Normal de Documentos (A4 / Hoja Completa) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Impresora Normal de Windows (A4 / Carta)</h2>
            </div>
            <span className="text-xs text-slate-400">Para comprobantes de tamaño carta o facturas completas</span>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dispositivo de Windows</label>
            <select
              value={printerConfig.normalPrinterName || ''}
              onChange={(e) =>
                setPrinterConfig({
                  ...printerConfig,
                  normalPrinterName: e.target.value
                })
              }
              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
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
        <div className="flex flex-wrap items-center justify-start gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-4 py-2 bg-lilac-50 hover:bg-lilac-100 dark:bg-lilac-950/40 dark:hover:bg-lilac-900/60 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-lilac-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
              title="Previsualizar cómo se verá el ticket térmico en pantalla"
            >
              <Eye className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
              <span>Previsualizar Ticket</span>
            </button>

            <button
              type="button"
              onClick={handleTestPrinter}
              disabled={isTestingPrinter}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isTestingPrinter ? (
                <Loader2 className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
              )}
              <span>{isTestingPrinter ? 'Imprimiendo test...' : 'Probar Impresión de Ticket'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCashDrawer}
              disabled={isOpeningDrawer}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isOpeningDrawer ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>{isOpeningDrawer ? 'Enviando pulso...' : 'Probar Apertura de Cajón'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Previsualización de Ticket Térmico */}
      <ThermalTicketPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        initialPaperWidth={printerConfig.paperWidth}
        printerConfig={printerConfig}
      />

      {/* Toast Flotante Fijo (Bottom-Right, Cero Layout Shift) */}
      {printerFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none max-w-md ${
            printerFeedback.type === 'success'
              ? 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
              : 'bg-white dark:bg-slate-800 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
          }`}
        >
          {printerFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{printerFeedback.text}</span>
          <button
            onClick={() => setPrinterFeedback(null)}
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
