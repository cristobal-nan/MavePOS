import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Printer,
  Receipt,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Scissors
} from 'lucide-react'
import {
  PrinterConfig,
  SaleDetail,
  ThermalFontFamily,
  ThermalBodySize,
  ThermalHeaderEmphasis
} from '@shared/types'
import { formatCLP } from '../utils/formatters'
import { useModalStack } from '../utils/modalStack'

export interface ThermalTicketPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  initialPaperWidth?: '80mm' | '58mm'
  printerConfig?: PrinterConfig
}

type TicketMode = 'sale' | 'test'
type SaleSource = 'sample' | 'last_sale'

export const ThermalTicketPreviewModal: React.FC<ThermalTicketPreviewModalProps> = ({
  isOpen,
  onClose,
  initialPaperWidth = '80mm',
  printerConfig
}) => {
  const { handleBackdropClick } = useModalStack({
    id: 'thermal-ticket-preview-modal',
    isOpen,
    onClose,
    closeOnBackdrop: true
  })

  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(initialPaperWidth)
  const [fontFamily, setFontFamily] = useState<ThermalFontFamily>(
    printerConfig?.thermalFontFamily || 'font_a'
  )
  const [bodySize, setBodySize] = useState<ThermalBodySize>(
    printerConfig?.thermalBodySize || 'normal'
  )
  const [headerEmphasis, setHeaderEmphasis] = useState<ThermalHeaderEmphasis>(
    printerConfig?.thermalHeaderEmphasis || 'double'
  )
  const [ticketMode, setTicketMode] = useState<TicketMode>('sale')
  const [saleSource, setSaleSource] = useState<SaleSource>('sample')

  const [businessInfo, setBusinessInfo] = useState({
    name: 'PUNTO DE VENTA',
    rut: '',
    activity: '',
    address: '',
    phone: '',
    email: '',
    footerMessage: '¡Gracias por su preferencia!'
  })

  const [lastSaleDetail, setLastSaleDetail] = useState<SaleDetail | null>(null)
  const [isLoadingLastSale, setIsLoadingLastSale] = useState(false)
  const [lastSaleError, setLastSaleError] = useState<string | null>(null)

  const [isPrinting, setIsPrinting] = useState(false)
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sincronizar configuración cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (printerConfig) {
        if (printerConfig.paperWidth) setPaperWidth(printerConfig.paperWidth)
        if (printerConfig.thermalFontFamily) setFontFamily(printerConfig.thermalFontFamily)
        if (printerConfig.thermalBodySize) setBodySize(printerConfig.thermalBodySize)
        if (printerConfig.thermalHeaderEmphasis) setHeaderEmphasis(printerConfig.thermalHeaderEmphasis)
      } else if (initialPaperWidth) {
        setPaperWidth(initialPaperWidth)
      }
      setPrintFeedback(null)
    }
  }, [isOpen, initialPaperWidth, printerConfig])

  // Cargar datos del negocio desde la tabla settings
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    window.api
      .getAllSettings()
      .then((all) => {
        if (!isMounted) return
        setBusinessInfo({
          name: all.business_name || 'PUNTO DE VENTA',
          rut: all.business_rut || '',
          activity: all.business_activity || '',
          address: all.business_address || '',
          phone: all.business_phone || '',
          email: all.business_email || '',
          footerMessage: all.ticket_footer_message || '¡Gracias por su preferencia!'
        })
      })
      .catch((err) => {
        console.error('Error cargando configuración del negocio para preview:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Cargar última venta real cuando se solicita
  const loadLastSale = useCallback(async (): Promise<void> => {
    setIsLoadingLastSale(true)
    setLastSaleError(null)
    try {
      const sales = await window.api.getSalesHistory()
      if (sales && sales.length > 0) {
        const latest = sales.find((s) => s.status === 'completed') || sales[0]
        const detail = await window.api.getSaleDetail(latest.id)
        if (detail) {
          setLastSaleDetail(detail)
        } else {
          setLastSaleError('No se pudo obtener el detalle de la última venta.')
        }
      } else {
        setLastSaleDetail(null)
        setLastSaleError('Aún no hay ventas registradas en el historial.')
      }
    } catch (err: any) {
      console.error('Error cargando última venta para preview:', err)
      setLastSaleError(err.message || 'Error consultando última venta.')
    } finally {
      setIsLoadingLastSale(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && saleSource === 'last_sale' && !lastSaleDetail) {
      loadLastSale()
    }
  }, [isOpen, saleSource, lastSaleDetail, loadLastSale])

  // Venta modelo representativa
  const sampleSale: SaleDetail = {
    id: 999,
    folio: 124,
    ticket_number: 3,
    status: 'completed',
    cash_session_id: 1,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    total: 12990,
    total_items: 3,
    returned_items_count: 0,
    items: [
      {
        id: 1,
        sale_id: 999,
        product_code: 'LAN-MER-100',
        name: 'Ovillo Lana Merino 100g',
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
  const sampleChange = 2010

  const activeSale = saleSource === 'last_sale' && lastSaleDetail ? lastSaleDetail : sampleSale
  const activeChange = saleSource === 'last_sale' ? 0 : sampleChange

  const widthChars =
    paperWidth === '58mm' ? (fontFamily === 'font_b' ? 42 : 32) : (fontFamily === 'font_b' ? 56 : 48)

  const showFeedback = (type: 'success' | 'error', text: string): void => {
    setPrintFeedback({ type, text })
    if (type === 'success') {
      setTimeout(() => {
        setPrintFeedback((curr) => (curr?.text === text ? null : curr))
      }, 4000)
    }
  }

  const handlePrintPhysicalTicket = async (): Promise<void> => {
    setIsPrinting(true)
    setPrintFeedback(null)
    const effectiveConfig: Partial<PrinterConfig> = {
      ...(printerConfig || {}),
      paperWidth,
      thermalFontFamily: fontFamily,
      thermalBodySize: bodySize,
      thermalHeaderEmphasis: headerEmphasis
    }

    try {
      if (ticketMode === 'test') {
        const res = await window.api.testThermalPrinter(effectiveConfig)
        if (res.success) {
          showFeedback('success', '¡Ticket de prueba enviado exitosamente a la impresora térmica!')
        } else {
          showFeedback('error', res.error || 'No se pudo comunicar con la impresora térmica.')
        }
      } else {
        const res = await window.api.printThermalReceipt(activeSale, activeChange, effectiveConfig)
        if (res.success) {
          showFeedback('success', '¡Ticket térmico enviado exitosamente a la impresora!')
        } else {
          showFeedback('error', res.error || 'No se pudo comunicar con la impresora térmica.')
        }
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Error durante el envío de impresión.')
    } finally {
      setIsPrinting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                Previsualización de Ticket Térmico
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simulación visual exacta de caracteres ESC/POS sobre papel térmico
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar Previsualización (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar de Controles */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Tipo de Ticket: Venta vs Prueba */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTicketMode('sale')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                ticketMode === 'sale'
                  ? 'bg-lilac-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Ticket de Venta</span>
            </button>

            <button
              type="button"
              onClick={() => setTicketMode('test')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                ticketMode === 'test'
                  ? 'bg-lilac-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Ticket de Prueba</span>
            </button>
          </div>

          {/* Si está en modo Venta: Alternar entre Muestra y Última Venta */}
          {ticketMode === 'sale' && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSaleSource('sample')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  saleSource === 'sample'
                    ? 'bg-lilac-100 text-lilac-900 dark:bg-lilac-950/60 dark:text-lilac-200 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Venta de Muestra
              </button>

              <button
                type="button"
                onClick={() => {
                  setSaleSource('last_sale')
                  if (!lastSaleDetail && !isLoadingLastSale) {
                    loadLastSale()
                  }
                }}
                disabled={isLoadingLastSale}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  saleSource === 'last_sale'
                    ? 'bg-lilac-100 text-lilac-900 dark:bg-lilac-950/60 dark:text-lilac-200 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {isLoadingLastSale && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Última Venta Real</span>
              </button>
            </div>
          )}

          {/* Selectores de Configuración y Formato en Tiempo Real */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ancho: 80mm vs 58mm */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Papel de 80 mm"
              >
                80 mm
              </button>

              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Papel de 58 mm"
              >
                58 mm
              </button>
            </div>

            {/* Fuente: Fuente A vs Fuente B */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFontFamily('font_a')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  fontFamily === 'font_a'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Fuente A (Estándar nítida)"
              >
                Fuente A
              </button>

              <button
                type="button"
                onClick={() => setFontFamily('font_b')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  fontFamily === 'font_b'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Fuente B (Condensada / compacta)"
              >
                Fuente B
              </button>
            </div>

            {/* Tamaño Cuerpo: Normal vs Compacto */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setBodySize('normal')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  bodySize === 'normal'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Interlineado estándar"
              >
                Espaciado Normal
              </button>

              <button
                type="button"
                onClick={() => setBodySize('compact')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  bodySize === 'compact'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Interlineado compacto / ahorro de papel"
              >
                Compacto
              </button>
            </div>

            {/* Énfasis: Doble Alto vs Normal */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setHeaderEmphasis('double')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  headerEmphasis === 'double'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Doble alto en nombre de negocio y total"
              >
                Doble Alto
              </button>

              <button
                type="button"
                onClick={() => setHeaderEmphasis('normal')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  headerEmphasis === 'normal'
                    ? 'bg-lilac-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Tamaño uniforme sin doble alto"
              >
                Uniforme
              </button>
            </div>
          </div>
        </div>

        {/* Zona de Visualización del Rollo de Papel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start bg-slate-200/60 dark:bg-slate-950/80">
          {ticketMode === 'sale' && saleSource === 'last_sale' && lastSaleError && (
            <div className="mb-4 max-w-md w-full p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{lastSaleError} Se muestra la venta de muestra como referencia.</span>
            </div>
          )}

          {/* Papel Térmico Físico (Clase protegida .thermal-ticket-paper) */}
          <div
            className={`thermal-ticket-paper bg-white text-slate-900 font-mono shadow-2xl rounded-sm p-5 border border-slate-300 select-text transition-all duration-200 relative ${
              paperWidth === '80mm'
                ? fontFamily === 'font_b'
                  ? 'w-[370px] text-[11px] tracking-tight'
                  : 'w-[370px] text-[12px] tracking-normal'
                : fontFamily === 'font_b'
                  ? 'w-[270px] text-[10px] tracking-tight'
                  : 'w-[270px] text-[11px] tracking-normal'
            }`}
          >
            {/* Efecto dentado guillotina superior */}
            <div className="flex items-center justify-center gap-1 text-slate-300 border-b border-dashed border-slate-300 pb-2 mb-3">
              <Scissors className="w-3.5 h-3.5 text-slate-400 rotate-90" />
              <span className="text-[10px] tracking-widest text-slate-400 uppercase">Corte de Papel</span>
            </div>

            {ticketMode === 'test' ? (
              /* ================== TICKET DE PRUEBA (DIAGNÓSTICO) ================== */
              <div
                className={`flex flex-col ${
                  bodySize === 'compact' ? 'gap-0.5 leading-tight' : 'gap-1 leading-snug'
                }`}
              >
                <div
                  className={`text-center font-black uppercase ${
                    headerEmphasis === 'double' ? 'text-sm sm:text-base tracking-wide' : 'text-xs'
                  }`}
                >
                  *** TICKET DE PRUEBA ***
                </div>
                <div className="text-center font-bold text-xs">
                  {businessInfo.name || 'MAVE POS'}
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                <div>Impresora térmica: CONECTADA</div>
                <div>Ancho configurado: {paperWidth} ({widthChars} columnas)</div>
                <div>Fuente: {fontFamily === 'font_b' ? 'Fuente B (Condensada)' : 'Fuente A (Estándar)'}</div>
                <div>Cuerpo: {bodySize === 'compact' ? 'Compacto' : 'Estándar'}</div>
                <div>Énfasis: {headerEmphasis === 'normal' ? 'Normal' : 'Doble Alto'}</div>
                <div className="flex items-center gap-1 text-[11px] text-slate-600">
                  <Clock className="w-3 h-3 text-slate-400 inline" />
                  <span>{new Date().toLocaleString('es-CL')}</span>
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                <div className="flex justify-between font-bold">
                  <span>Prueba de alineación:</span>
                  <span>OK $ 10.000</span>
                </div>

                <div className="text-center font-bold text-emerald-700 mt-2">
                  ¡Test de impresión completado exitosamente!
                </div>
              </div>
            ) : (
              /* ================== TICKET DE VENTA ================== */
              <div
                className={`flex flex-col ${
                  bodySize === 'compact' ? 'gap-0.5 leading-tight' : 'gap-1 leading-snug'
                }`}
              >
                {/* 1. Encabezado Datos Comerciales */}
                <div className="text-center">
                  <div
                    className={`font-black uppercase ${
                      headerEmphasis === 'double'
                        ? 'text-sm sm:text-base tracking-wide'
                        : 'text-xs tracking-normal font-bold'
                    }`}
                  >
                    {businessInfo.name || 'PUNTO DE VENTA'}
                  </div>
                  {businessInfo.rut && <div>RUT: {businessInfo.rut}</div>}
                  {businessInfo.activity && <div className="text-[11px]">{businessInfo.activity}</div>}
                  {businessInfo.address && <div className="text-[11px]">{businessInfo.address}</div>}
                  {businessInfo.phone && <div className="text-[11px]">Tel: {businessInfo.phone}</div>}
                  {businessInfo.email && <div className="text-[11px]">{businessInfo.email}</div>}
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                {/* 2. Folio y Fecha */}
                <div className="font-bold">
                  FOLIO DE VENTA: #{activeSale.folio ?? activeSale.id}
                </div>
                <div>
                  Ticket de Turno: #{activeSale.ticket_number ?? 0}
                </div>
                <div className="text-[11px] text-slate-600">
                  Fecha: {new Date(activeSale.completed_at || activeSale.created_at).toLocaleString('es-CL')}
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                {/* 3. Encabezado de Productos */}
                <div className="flex justify-between font-bold">
                  <span>CANT / DESCRIPCION</span>
                  <span>TOTAL</span>
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                {/* 4. Lista de Ítems */}
                <div
                  className={`flex flex-col ${
                    bodySize === 'compact' ? 'gap-0.5' : 'gap-1.5'
                  }`}
                >
                  {(activeSale.items || []).map((it, idx) => {
                    const qty = it.quantity - (it.returned_qty || 0)
                    if (qty <= 0) return null
                    const itemTotal = qty * it.unit_price

                    return (
                      <div key={idx} className="flex flex-col">
                        <div className="flex justify-between font-medium">
                          <span className="truncate pr-1">
                            {qty}x {it.name}
                          </span>
                          <span className="font-bold shrink-0">{formatCLP(itemTotal)}</span>
                        </div>
                        {it.unit_price && (
                          <div className="text-[10px] text-slate-500 pl-4">
                            ({formatCLP(it.unit_price)} c/u)
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                {/* 5. Totales y Formas de Pago */}
                <div className="flex justify-between items-baseline my-0.5">
                  <span className="font-bold">TOTAL:</span>
                  <span
                    className={`font-black ${
                      headerEmphasis === 'double'
                        ? 'text-sm sm:text-base'
                        : 'text-xs sm:text-sm'
                    }`}
                  >
                    {formatCLP(activeSale.total)}
                  </span>
                </div>

                <div className="mt-1">
                  <div className="font-bold text-[11px]">FORMAS DE PAGO:</div>
                  {activeSale.payments && activeSale.payments.length > 0 ? (
                    activeSale.payments.map((p, idx) => {
                      const mLabel =
                        p.method === 'cash'
                          ? 'Efectivo'
                          : p.method === 'card'
                          ? 'Tarjeta'
                          : 'Transferencia'
                      return (
                        <div key={idx} className="flex justify-between pl-2 text-[11px]">
                          <span>{mLabel}:</span>
                          <span>{formatCLP(p.amount)}</span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex justify-between pl-2 text-[11px]">
                      <span>Efectivo:</span>
                      <span>{formatCLP(activeSale.total)}</span>
                    </div>
                  )}

                  {activeChange > 0 && (
                    <div className="flex justify-between pl-2 font-bold text-[11px] mt-0.5">
                      <span>Vuelto:</span>
                      <span>{formatCLP(activeChange)}</span>
                    </div>
                  )}
                </div>

                <div className="text-slate-400 select-none overflow-hidden my-1">
                  {'-'.repeat(widthChars)}
                </div>

                {/* 6. Pie de Ticket */}
                <div className="text-center text-[11px] italic text-slate-700 mt-1">
                  {businessInfo.footerMessage || '¡Gracias por su preferencia!'}
                </div>
              </div>
            )}

            {/* Efecto dentado guillotina inferior */}
            <div className="border-t border-dashed border-slate-300 mt-4 pt-2 text-center text-slate-400 text-[10px]">
              - - - Fin del Ticket - - -
            </div>
          </div>
        </div>

        {/* Footer & Acciones */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Formato: <span className="font-bold text-slate-800 dark:text-slate-200">{paperWidth}</span> ({widthChars} cols) •{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {fontFamily === 'font_b' ? 'Fuente B' : 'Fuente A'}
            </span>{' '}
            • {bodySize === 'compact' ? 'Compacto' : 'Espaciado Normal'} •{' '}
            {headerEmphasis === 'normal' ? 'Uniforme' : 'Doble Alto'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPhysicalTicket}
              disabled={isPrinting}
              className="px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shadow-lilac-600/20"
              title="Enviar este ticket a la impresora térmica configurada"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{isPrinting ? 'Imprimiendo...' : 'Imprimir a Impresora Térmica'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Toast Flotante Fijo para Feedback de Impresión */}
      {printFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-60 p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none max-w-md ${
            printFeedback.type === 'success'
              ? 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
              : 'bg-white dark:bg-slate-800 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
          }`}
        >
          {printFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{printFeedback.text}</span>
          <button
            onClick={() => setPrintFeedback(null)}
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
