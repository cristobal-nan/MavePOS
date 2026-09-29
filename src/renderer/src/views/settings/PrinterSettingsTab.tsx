import React, { useState, useEffect } from 'react'
import { Printer, Archive, RefreshCw, CheckCircle2, AlertTriangle, Save } from 'lucide-react'
import { PrinterConfig, PrinterInfo } from '@shared/types'

export const PrinterSettingsTab: React.FC = () => {
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

  useEffect(() => {
    let isMounted = true
    Promise.all([window.api.getPrinterConfig(), window.api.getInstalledPrinters()])
      .then(([config, list]) => {
        if (!isMounted) return
        setPrinterConfig(config)
        setPrintersList(list)
      })
      .catch((err) => {
        console.error('Error cargando configuración de impresoras:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

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

  const handleRefreshPrinters = async (): Promise<void> => {
    try {
      const pList = await window.api.getInstalledPrinters()
      setPrintersList(pList)
    } catch (err) {
      console.error('Error refrescando impresoras:', err)
    }
  }

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

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
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
  )
}
