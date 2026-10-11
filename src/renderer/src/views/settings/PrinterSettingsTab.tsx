import React, { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  Archive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Type,
  Sparkles,
  Columns
} from 'lucide-react'
import {
  PrinterConfig,
  PrinterInfo,
  SaleDetail
} from '@shared/types'
import { useSettingsStore, DirtyFieldChange } from '../../store/settingsStore'
import { ThermalTicketPaperView } from '../../components/ThermalTicketPaperView'

const POPULAR_FONTS = [
  { name: 'Segoe UI', value: 'Segoe UI, -apple-system, sans-serif', label: 'Segoe UI (Nativa Windows / Moderna)' },
  { name: 'Consolas', value: 'Consolas, monospace', label: 'Consolas (Monospaciada limpia / POS)' },
  { name: 'Arial', value: 'Arial, sans-serif', label: 'Arial (Estándar nítida)' },
  { name: 'Roboto', value: 'Roboto, sans-serif', label: 'Roboto (Geométrica / Clara)' },
  { name: 'Courier New', value: 'Courier New, monospace', label: 'Courier New (Clásica de máquina)' }
]

const SAMPLE_SALE: SaleDetail = {
  id: 999,
  folio: 142,
  ticket_number: 12,
  status: 'completed',
  cash_session_id: null,
  total: 12990,
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  total_items: 3,
  returned_items_count: 0,
  items: [
    {
      id: 1,
      sale_id: 999,
      product_code: 'LAN-MER-01',
      name: 'Ovillo Lana Merino 100g Azul Marino',
      quantity: 2,
      returned_qty: 0,
      unit_price: 4500
    },
    {
      id: 2,
      sale_id: 999,
      product_code: 'ACC-PAL-CIR4',
      name: 'Palillos Circulares Bambú #4',
      quantity: 1,
      returned_qty: 0,
      unit_price: 3990
    }
  ],
  payments: [
    {
      id: 1,
      sale_id: 999,
      method: 'cash',
      amount: 15000
    }
  ]
}

const DEFAULT_CONFIG: PrinterConfig = {
  thermalType: 'epson',
  thermalInterfaceType: 'windows_printer',
  thermalInterface: '',
  paperWidth: '80mm',
  openDrawerOnPrint: true,
  autoPrintOnSale: false,
  normalPrinterName: '',
  thermalFontFamily: 'font_a',
  thermalBodySize: 'normal',
  thermalHeaderEmphasis: 'double',
  thermalPrintMode: 'graphic',
  thermalItemsLayout: '2_cols',
  thermalTotalSize: 'double',
  thermalSystemFont: 'Segoe UI, -apple-system, sans-serif'
}

export const PrinterSettingsTab: React.FC = () => {
  const [printersList, setPrintersList] = useState<PrinterInfo[]>([])
  const [initialConfig, setInitialConfig] = useState<PrinterConfig>(DEFAULT_CONFIG)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_CONFIG)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false)
  const [printerFeedback, setPrinterFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Previsualización fija
  const [previewMode, setPreviewMode] = useState<'sample' | 'last_sale'>('sample')
  const [lastSaleDetail, setLastSaleDetail] = useState<SaleDetail | null>(null)
  const [businessInfo, setBusinessInfo] = useState({
    name: 'PUNTO DE VENTA',
    rut: '',
    activity: '',
    address: '',
    phone: '',
    email: '',
    footerMessage: '¡Gracias por su preferencia!'
  })

  // Campo de fuente personalizada
  const [customFontInput, setCustomFontInput] = useState('')
  const [isUsingCustomFont, setIsUsingCustomFont] = useState(false)

  const registerSubTabState = useSettingsStore((s) => s.registerSubTabState)
  const clearSubTabState = useSettingsStore((s) => s.clearSubTabState)

  useEffect(() => {
    let isMounted = true
    Promise.all([
      window.api.getPrinterConfig(),
      window.api.getInstalledPrinters(),
      window.api.getAllSettings()
    ])
      .then(([config, list, allSettings]) => {
        if (!isMounted) return
        setInitialConfig(config)
        setPrinterConfig(config)
        setPrintersList(list)

        const sysFont = config.thermalSystemFont || 'Segoe UI, -apple-system, sans-serif'
        const matched = POPULAR_FONTS.some((f) => f.value === sysFont)
        if (!matched && sysFont) {
          setIsUsingCustomFont(true)
          setCustomFontInput(sysFont)
        }

        setBusinessInfo({
          name: allSettings.business_name || 'PUNTO DE VENTA',
          rut: allSettings.business_rut || '',
          activity: allSettings.business_activity || '',
          address: allSettings.business_address || '',
          phone: allSettings.business_phone || '',
          email: allSettings.business_email || '',
          footerMessage: allSettings.ticket_footer_message || '¡Gracias por su preferencia!'
        })
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

  const loadLastSale = useCallback(async (): Promise<void> => {
    try {
      const history = await window.api.getSalesHistory({ limit: 1 })
      if (Array.isArray(history) && history.length > 0) {
        const fullSale = await window.api.getSaleDetail(history[0].id)
        if (fullSale) {
          setLastSaleDetail(fullSale)
          setPreviewMode('last_sale')
          return
        }
      }
      setPreviewMode('sample')
      showFeedback('error', 'No hay ventas registradas aún. Mostrando venta de muestra.')
    } catch {
      setPreviewMode('sample')
    }
  }, [])

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
    const sysFont = initialConfig.thermalSystemFont || 'Segoe UI, -apple-system, sans-serif'
    const matched = POPULAR_FONTS.some((f) => f.value === sysFont)
    if (!matched && sysFont) {
      setIsUsingCustomFont(true)
      setCustomFontInput(sysFont)
    } else {
      setIsUsingCustomFont(false)
    }
  }, [initialConfig])

  // Seguimiento de cambios sucios (Dirty tracking)
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
    if (printerConfig.thermalFontFamily !== initialConfig.thermalFontFamily) {
      changes.push({
        field: 'Fuente ESC/POS',
        value: printerConfig.thermalFontFamily === 'font_b' ? 'Fuente B (Condensada)' : 'Fuente A (Estándar)'
      })
    }
    if (printerConfig.thermalPrintMode !== initialConfig.thermalPrintMode) {
      changes.push({
        field: 'Modo de Impresión',
        value: printerConfig.thermalPrintMode === 'graphic' ? 'Gráfico Silencioso' : 'ESC/POS RAW'
      })
    }
    if (printerConfig.thermalItemsLayout !== initialConfig.thermalItemsLayout) {
      changes.push({
        field: 'Columnas de Productos',
        value: printerConfig.thermalItemsLayout || '2_cols'
      })
    }
    if (printerConfig.thermalTotalSize !== initialConfig.thermalTotalSize) {
      changes.push({
        field: 'Tamaño del Total',
        value: printerConfig.thermalTotalSize === 'double' ? 'Doble Alto' : 'Normal'
      })
    }
    if (printerConfig.thermalSystemFont !== initialConfig.thermalSystemFont) {
      changes.push({
        field: 'Tipografía del Ticket',
        value: printerConfig.thermalSystemFont || 'Predeterminada'
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

  const activeTicketSale = previewMode === 'last_sale' && lastSaleDetail ? lastSaleDetail : SAMPLE_SALE
  const activeTicketChange =
    previewMode === 'last_sale' && lastSaleDetail
      ? Math.max(
          0,
          (lastSaleDetail.payments?.reduce((acc, p) => acc + p.amount, 0) || 0) - lastSaleDetail.total
        )
      : 2010

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150 pb-8">
      {/* Contenedor principal a 2 columnas fijas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Card 1: Dispositivo de Impresión Térmica */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Impresora Térmica de Tickets</h2>
              </div>
              <span className="text-xs text-slate-400">Destino de impresión rápida</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
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
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
                >
                  <option value="windows_printer">Impresora instalada en Windows (Spooler)</option>
                  <option value="tcp">Red Ethernet / WiFi (TCP/IP)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    {printerConfig.thermalInterfaceType === 'windows_printer'
                      ? 'Impresora Térmica'
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
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Seleccionar impresora térmica --</option>
                    {printersList.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? '(Predeterminada)' : ''}
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
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
                  />
                )}
              </div>
            </div>

            {/* Ancho del Papel */}
            <div className="pt-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs">Ancho del Rollo de Papel</label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '80mm' })}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    printerConfig.paperWidth === '80mm'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold">80 mm</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Estándar amplio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, paperWidth: '58mm' })}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    printerConfig.paperWidth === '58mm'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold">58 mm</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Rollo estrecho</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Diseño, Tipografía y Columnas */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Tipografía y Diseño del Ticket</h2>
              </div>
              <span className="text-xs text-slate-400">Personalización visual y estructura</span>
            </div>

            {/* Modo de Impresión: Gráfico Silencioso vs ESC/POS */}
            <div className="text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Modo de Procesamiento</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, thermalPrintMode: 'graphic' })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    (printerConfig.thermalPrintMode ?? 'graphic') === 'graphic'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold">Gráfico Silencioso (Recomendado)</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Permite fuentes del sistema, diseño pixel-perfect y sin ventanas de Windows.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, thermalPrintMode: 'raw_escpos' })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    printerConfig.thermalPrintMode === 'raw_escpos'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold">ESC/POS Nativo RAW</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Texto directo con chip ROM de la impresora (Font A / Font B).
                  </span>
                </button>
              </div>
            </div>

            {/* Selector de Tipografía */}
            {(printerConfig.thermalPrintMode ?? 'graphic') === 'graphic' ? (
              <div className="text-xs space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Tipografía del Ticket
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {POPULAR_FONTS.map((font) => {
                    const isSelected = !isUsingCustomFont && (printerConfig.thermalSystemFont || 'Segoe UI, -apple-system, sans-serif') === font.value
                    return (
                      <button
                        key={font.name}
                        type="button"
                        onClick={() => {
                          setIsUsingCustomFont(false)
                          setPrinterConfig({ ...printerConfig, thermalSystemFont: font.value })
                        }}
                        style={{ fontFamily: font.value }}
                        className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="block font-semibold">{font.name}</span>
                        <span className="block text-[10px] text-slate-400 font-sans mt-0.5">1234567890 $ 12.990</span>
                      </button>
                    )
                  })}
                </div>

                {/* Opción de fuente personalizada */}
                <div className="pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use-custom-font"
                      checked={isUsingCustomFont}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setIsUsingCustomFont(checked)
                        if (checked && customFontInput.trim()) {
                          setPrinterConfig({ ...printerConfig, thermalSystemFont: customFontInput.trim() })
                        } else if (!checked) {
                          setPrinterConfig({ ...printerConfig, thermalSystemFont: POPULAR_FONTS[0].value })
                        }
                      }}
                      className="rounded border-slate-300 text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <label htmlFor="use-custom-font" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Escribir nombre de otra fuente instalada en Windows
                    </label>
                  </div>

                  {isUsingCustomFont && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={customFontInput}
                        onChange={(e) => {
                          setCustomFontInput(e.target.value)
                          setPrinterConfig({ ...printerConfig, thermalSystemFont: e.target.value })
                        }}
                        placeholder="Ej: Tahoma, Verdana, Calibri, etc."
                        className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Selector ESC/POS ROM font */
              <div className="text-xs">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fuente Interna de la Impresora
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalFontFamily: 'font_a' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      printerConfig.thermalFontFamily !== 'font_b'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Fuente A (Estándar)</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Letra nítida estándar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalFontFamily: 'font_b' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      printerConfig.thermalFontFamily === 'font_b'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Fuente B (Condensada)</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Letra angosta y compacta</span>
                  </button>
                </div>
              </div>
            )}

            {/* Selector de Columnas de Productos */}
            <div className="text-xs pt-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                <span>Formato de Columnas de Productos</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, thermalItemsLayout: '2_cols' })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    (printerConfig.thermalItemsLayout ?? '2_cols') === '2_cols'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold text-xs">2 Columnas (Compacto)</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Nombre amplio sin cortar, precio unitario abajo y total a la derecha.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, thermalItemsLayout: '3_cols' })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    printerConfig.thermalItemsLayout === '3_cols'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold text-xs">3 Columnas</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Cant | Descripción | Total alineados en tabla.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterConfig({ ...printerConfig, thermalItemsLayout: '4_cols' })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    printerConfig.thermalItemsLayout === '4_cols'
                      ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold text-xs">4 Columnas (Tabular)</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Cant | Detalle | P.Unit | Total (ideal para 80mm).
                  </span>
                </button>
              </div>
            </div>

            {/* Selector de Tamaño de Totales e Interlineado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tamaño del Total
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalTotalSize: 'double' })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      (printerConfig.thermalTotalSize ?? 'double') === 'double'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Doble Alto</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Destacado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalTotalSize: 'normal' })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      printerConfig.thermalTotalSize === 'normal'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Normal</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Sobrio / compacto</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Interlineado del Cuerpo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalBodySize: 'normal' })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      printerConfig.thermalBodySize !== 'compact'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Estándar</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Espaciado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrinterConfig({ ...printerConfig, thermalBodySize: 'compact' })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      printerConfig.thermalBodySize === 'compact'
                        ? 'border-lilac-500 bg-lilac-50/70 dark:bg-lilac-950/40 text-lilac-900 dark:text-lilac-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">Compacto</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Ahorro de papel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Cajón de Dinero y Automatización */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-lilac-100 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Cajón de Dinero y Automatización</h2>
              </div>
              <span className="text-xs text-slate-400">Pulsos de apertura y flujo de venta</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-3 p-2.5 bg-slate-50/70 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100/70 transition-colors">
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
                    Emite el pulso estándar RJ11 de hardware al completarse la impresión del ticket.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 bg-slate-50/70 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:bg-slate-100/70 transition-colors">
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
                    Al finalizar el cobro en caja, imprime de inmediato sin preguntar al cajero.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Previsualización Fija en Tiempo Real (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3 sticky top-4">
          <div className="bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-lilac-100 dark:border-slate-800 p-4 shadow-sm flex flex-col items-center">
            {/* Cabecera de controles de la previsualización */}
            <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                <span>Previsualización Fija</span>
              </div>

              {/* Selector Muestra vs Última Venta */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode('sample')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    previewMode === 'sample'
                      ? 'bg-lilac-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Muestra
                </button>
                <button
                  type="button"
                  onClick={loadLastSale}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    previewMode === 'last_sale'
                      ? 'bg-lilac-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Última Venta
                </button>
              </div>
            </div>

            {/* Componente Fijo del Papel Térmico */}
            <div className="w-full flex justify-center py-2 overflow-x-auto">
              <ThermalTicketPaperView
                paperWidth={printerConfig.paperWidth}
                fontFamily={printerConfig.thermalFontFamily}
                systemFont={printerConfig.thermalSystemFont}
                printMode={printerConfig.thermalPrintMode}
                bodySize={printerConfig.thermalBodySize}
                headerEmphasis={printerConfig.thermalHeaderEmphasis}
                itemsLayout={printerConfig.thermalItemsLayout}
                totalSize={printerConfig.thermalTotalSize}
                activeSale={activeTicketSale}
                activeChange={activeTicketChange}
                businessInfo={businessInfo}
              />
            </div>

            {/* Botones de Prueba Directa debajo del Ticket */}
            <div className="w-full grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={handleTestPrinter}
                disabled={isTestingPrinter}
                className="w-full py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isTestingPrinter ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>{isTestingPrinter ? 'Imprimiendo...' : 'Probar Impresión'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCashDrawer}
                disabled={isOpeningDrawer}
                className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isOpeningDrawer ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isOpeningDrawer ? 'Enviando...' : 'Abrir Cajón'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Flotante Fijo para Feedback (Cero Layout Shift) */}
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
