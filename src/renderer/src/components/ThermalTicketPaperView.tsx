import React from 'react'
import { Scissors, Clock } from 'lucide-react'
import {
  SaleDetail,
  ThermalPaperWidth,
  ThermalFontFamily,
  ThermalBodySize,
  ThermalHeaderEmphasis,
  ThermalItemsLayout,
  ThermalTotalSize,
  ThermalPrintMode
} from '@shared/types'
import { formatCLP } from '../utils/formatters'

export interface ThermalTicketPaperViewProps {
  paperWidth?: ThermalPaperWidth
  fontFamily?: ThermalFontFamily
  systemFont?: string
  printMode?: ThermalPrintMode
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
  itemsLayout?: ThermalItemsLayout
  totalSize?: ThermalTotalSize
  activeSale: SaleDetail
  activeChange?: number
  businessInfo: {
    name: string
    rut?: string
    activity?: string
    address?: string
    phone?: string
    email?: string
    footerMessage?: string
  }
  isTestMode?: boolean
}

export const ThermalTicketPaperView: React.FC<ThermalTicketPaperViewProps> = ({
  paperWidth = '80mm',
  fontFamily = 'font_a',
  systemFont = 'Segoe UI, sans-serif',
  printMode = 'graphic',
  bodySize = 'normal',
  headerEmphasis = 'double',
  itemsLayout = '2_cols',
  totalSize = 'double',
  activeSale,
  activeChange = 0,
  businessInfo,
  isTestMode = false
}) => {
  const is58mm = paperWidth === '58mm'
  const isFontB = fontFamily === 'font_b'
  const widthChars = is58mm ? (isFontB ? 42 : 32) : isFontB ? 56 : 48

  // En modo gráfico aplicamos la fuente elegida por el usuario, en ESC/POS usamos monospace
  const effectiveFontFamily =
    printMode === 'graphic'
      ? systemFont || 'Segoe UI, -apple-system, sans-serif'
      : 'monospace'

  const dividerChars = is58mm ? 32 : 44

  return (
    <div
      style={{ fontFamily: effectiveFontFamily }}
      className={`thermal-ticket-paper bg-white text-black shadow-xl rounded-sm p-4 border border-slate-300 select-text transition-all duration-150 relative ${
        is58mm
          ? 'w-[270px] text-[11px] leading-snug'
          : 'w-[350px] text-[12px] leading-normal'
      }`}
    >
      {/* Efecto dentado guillotina superior */}
      <div className="flex items-center justify-center gap-1 text-slate-400 border-b border-dashed border-slate-300 pb-2 mb-3">
        <Scissors className="w-3.5 h-3.5 text-slate-400 rotate-90" />
        <span className="text-[10px] tracking-widest uppercase font-mono">Corte de Papel</span>
      </div>

      {isTestMode ? (
        /* ================== TICKET DE PRUEBA ================== */
        <div className={`flex flex-col ${bodySize === 'compact' ? 'gap-0.5 leading-tight' : 'gap-1 leading-snug'}`}>
          <div
            className={`text-center font-black uppercase ${
              headerEmphasis === 'double' ? 'text-sm sm:text-base tracking-wide' : 'text-xs'
            }`}
          >
            *** TICKET DE PRUEBA ***
          </div>
          <div className="text-center font-bold text-xs">{businessInfo.name || 'MAVE POS'}</div>

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          <div>Impresora térmica: CONECTADA</div>
          <div>Ancho configurado: {paperWidth} ({widthChars} cols)</div>
          <div>Modo: {printMode === 'graphic' ? 'Gráfico Silencioso' : 'ESC/POS RAW'}</div>
          <div>Tipografía: {printMode === 'graphic' ? systemFont : (isFontB ? 'Fuente B' : 'Fuente A')}</div>
          <div>Formato columnas: {itemsLayout}</div>
          <div>Tamaño Total: {totalSize === 'double' ? 'Doble Alto' : 'Normal'}</div>
          <div className="flex items-center gap-1 text-[11px] text-black">
            <Clock className="w-3 h-3 text-black inline" />
            <span>{new Date().toLocaleString('es-CL')}</span>
          </div>

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          <div className="flex justify-between font-bold">
            <span>Prueba de alineación:</span>
            <span>OK $ 10.000</span>
          </div>

          <div className="text-center font-bold text-black mt-2">
            ¡Test de impresión completado exitosamente!
          </div>
        </div>
      ) : (
        /* ================== TICKET DE VENTA ================== */
        <div className={`flex flex-col ${bodySize === 'compact' ? 'gap-0.5 leading-tight' : 'gap-1 leading-snug'}`}>
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

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          {/* 2. Folio y Fecha */}
          <div className="flex justify-between font-bold">
            <span>FOLIO: #{activeSale.folio ?? activeSale.id}</span>
            <span>Turno: #{activeSale.ticket_number ?? 0}</span>
          </div>
          <div className="text-[11px] text-black">
            Fecha: {new Date(activeSale.completed_at || activeSale.created_at).toLocaleString('es-CL')}
          </div>

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          {/* 3. Items list with selectable layouts */}
          {itemsLayout === '4_cols' ? (
            <div>
              <div className="grid grid-cols-12 font-bold text-[10px] uppercase border-b border-black pb-1 mb-1">
                <span className="col-span-2 text-left">Cant</span>
                <span className="col-span-5 text-left truncate">Detalle</span>
                <span className="col-span-2 text-right">P.Un</span>
                <span className="col-span-3 text-right">Total</span>
              </div>
              <div className={`flex flex-col ${bodySize === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
                {(activeSale.items || []).map((it, idx) => {
                  const qty = it.quantity - (it.returned_qty || 0)
                  if (qty <= 0) return null
                  const itemTotal = qty * it.unit_price
                  return (
                    <div key={idx} className="grid grid-cols-12 items-baseline text-[11px] border-b border-black pb-0.5">
                      <span className="col-span-2 font-semibold text-left">{qty}</span>
                      <span className="col-span-5 font-medium text-left truncate pr-1" title={it.name}>
                        {it.name}
                      </span>
                      <span className="col-span-2 text-right text-[10px] text-black">
                        {formatCLP(it.unit_price)}
                      </span>
                      <span className="col-span-3 text-right font-bold">
                        {formatCLP(itemTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : itemsLayout === '3_cols' ? (
            <div>
              <div className="grid grid-cols-12 font-bold text-[10px] uppercase border-b border-black pb-1 mb-1">
                <span className="col-span-2 text-left">Cant</span>
                <span className="col-span-7 text-left truncate">Detalle</span>
                <span className="col-span-3 text-right">Total</span>
              </div>
              <div className={`flex flex-col ${bodySize === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
                {(activeSale.items || []).map((it, idx) => {
                  const qty = it.quantity - (it.returned_qty || 0)
                  if (qty <= 0) return null
                  const itemTotal = qty * it.unit_price
                  return (
                    <div key={idx} className="grid grid-cols-12 items-baseline text-[11px] border-b border-black pb-0.5">
                      <span className="col-span-2 font-semibold text-left">{qty}</span>
                      <span className="col-span-7 font-medium text-left truncate pr-1" title={it.name}>
                        {it.name}
                      </span>
                      <span className="col-span-3 text-right font-bold">
                        {formatCLP(itemTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* 2 cols (Compacto) */
            <div>
              <div className="flex justify-between font-bold text-[10px] uppercase border-b border-black pb-1 mb-1">
                <span>CANT / DESCRIPCION</span>
                <span>TOTAL</span>
              </div>
              <div className={`flex flex-col ${bodySize === 'compact' ? 'gap-1' : 'gap-1.5'}`}>
                {(activeSale.items || []).map((it, idx) => {
                  const qty = it.quantity - (it.returned_qty || 0)
                  if (qty <= 0) return null
                  const itemTotal = qty * it.unit_price
                  return (
                    <div key={idx} className="flex flex-col border-b border-black pb-0.5">
                      <div className="flex justify-between font-medium">
                        <span className="truncate pr-1">
                          {qty}x {it.name}
                        </span>
                        <span className="font-bold shrink-0">{formatCLP(itemTotal)}</span>
                      </div>
                      {it.unit_price && (
                        <div className="text-[10px] text-black pl-3">
                          ({formatCLP(it.unit_price)} c/u)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          {/* 4. Totales */}
          <div className="flex justify-between items-baseline my-0.5">
            <span className="font-bold">TOTAL:</span>
            <span
              className={`font-black text-black ${
                totalSize === 'double'
                  ? 'text-base sm:text-lg'
                  : 'text-xs sm:text-sm'
              }`}
            >
              {formatCLP(activeSale.total)}
            </span>
          </div>

          {/* 5. Formas de Pago */}
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

          <div className="text-black font-bold select-none overflow-hidden my-1 font-mono text-[10px]">
            {'-'.repeat(dividerChars)}
          </div>

          {/* 6. Pie de Ticket */}
          <div className="text-center text-[11px] italic text-black mt-1">
            {businessInfo.footerMessage || '¡Gracias por su preferencia!'}
          </div>
        </div>
      )}

      {/* Efecto dentado guillotina inferior */}
      <div className="border-b border-dashed border-slate-300 mt-4 pt-1" />
    </div>
  )
}
