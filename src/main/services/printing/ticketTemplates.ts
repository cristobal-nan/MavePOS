import {
  SaleDetail,
  ThermalFontFamily,
  ThermalBodySize,
  ThermalHeaderEmphasis,
  ThermalItemsLayout,
  ThermalTotalSize,
  ThermalPaperWidth
} from '../../../shared/types'
import { formatCLP } from '../../../shared/finance'

export interface BusinessInfo {
  name: string
  rut?: string
  activity?: string
  address?: string
  phone?: string
  email?: string
  footerMessage?: string
}

export interface BuildThermalReceiptOptions {
  printer: any
  widthChars: number
  saleDetail: SaleDetail
  change?: number
  openDrawerOnPrint?: boolean
  business: BusinessInfo
  fontFamily?: ThermalFontFamily
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
  itemsLayout?: ThermalItemsLayout
  totalSize?: ThermalTotalSize
}

export interface BuildTestTicketOptions {
  printer: any
  widthChars: number
  paperWidth: string
  businessName: string
  fontFamily?: ThermalFontFamily
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
  itemsLayout?: ThermalItemsLayout
  totalSize?: ThermalTotalSize
}

/**
 * Sanitiza texto para impresoras térmicas ESC/POS, reemplazando tildes, signos de apertura
 * y caracteres Unicode especiales por sus equivalentes ASCII legibles para evitar que
 * impresoras con páginas de códigos distintas impriman caracteres chinos o símbolos corruptos.
 */
export function sanitizeForThermalEscPos(text: string): string {
  if (!text) return ''
  return text
    .replace(/[áàäâã]/g, 'a')
    .replace(/[ÁÀÄÂÃ]/g, 'A')
    .replace(/[éèëê]/g, 'e')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[íìïî]/g, 'i')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[ÓÒÖÔÕ]/g, 'O')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ÚÙÜÛ]/g, 'U')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/[¡¿]/g, '')
    .replace(/°/g, '')
    .replace(/…/g, '...')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\r\n\t]/g, '')
}

/**
 * Builds ESC/POS receipt layout for 58mm or 80mm thermal receipt printers.
 */
export function buildThermalReceipt(options: BuildThermalReceiptOptions): void {
  const {
    printer,
    widthChars,
    saleDetail,
    change = 0,
    openDrawerOnPrint,
    business,
    fontFamily = 'font_a',
    bodySize = 'normal',
    headerEmphasis = 'double',
    itemsLayout = '2_cols',
    totalSize = 'double'
  } = options

  const businessName = business.name || 'PUNTO DE VENTA'
  const businessRut = business.rut || ''
  const businessActivity = business.activity || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''
  const businessEmail = business.email || ''
  const footerMsg = business.footerMessage || '¡Gracias por su preferencia!'

  // Aplicar tipo de fuente
  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  } else {
    printer.setTypeFontA()
  }

  // Aplicar interlineado según tamaño de cuerpo
  if (bodySize === 'compact') {
    try {
      printer.setLineSpacing(24)
    } catch {
      // Ignorar si el tipo de driver no soporta setLineSpacing
    }
  } else {
    try {
      printer.resetLineSpacing()
    } catch {
      // Ignorar
    }
  }

  // 1. Header: Business info
  printer.alignCenter()
  printer.bold(true)
  if (headerEmphasis === 'double') {
    printer.setTextDoubleHeight()
  }
  printer.println(sanitizeForThermalEscPos(businessName))
  printer.setTextNormal()
  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  }
  printer.bold(false)

  if (businessRut) printer.println(sanitizeForThermalEscPos(`RUT: ${businessRut}`))
  if (businessActivity) printer.println(sanitizeForThermalEscPos(businessActivity))
  if (businessAddress) printer.println(sanitizeForThermalEscPos(businessAddress))
  if (businessPhone) printer.println(sanitizeForThermalEscPos(`Tel: ${businessPhone}`))
  if (businessEmail) printer.println(sanitizeForThermalEscPos(businessEmail))

  printer.println('-'.repeat(widthChars))

  // 2. Transaction details
  printer.alignLeft()
  printer.bold(true)
  printer.println(`FOLIO DE VENTA: #${saleDetail.folio ?? saleDetail.id}`)
  printer.bold(false)
  printer.println(`Ticket de Turno: #${saleDetail.ticket_number ?? 0}`)

  const saleDate = saleDetail.completed_at || saleDetail.created_at || new Date().toISOString()
  const formattedDate = sanitizeForThermalEscPos(new Date(saleDate).toLocaleString('es-CL'))
  printer.println(`Fecha: ${formattedDate}`)
  printer.println('-'.repeat(widthChars))

  // 3. Items list
  printer.bold(true)
  if (itemsLayout === '4_cols') {
    printer.println('CANT DESCRIPCION        P.UNIT     TOTAL'.slice(0, widthChars))
  } else if (itemsLayout === '3_cols') {
    printer.println('CANT DESCRIPCION               TOTAL'.slice(0, widthChars))
  } else {
    printer.leftRight('CANT / DESCRIPCION', 'TOTAL')
  }
  printer.bold(false)
  printer.println('-'.repeat(widthChars))

  for (const item of saleDetail.items) {
    const itemQty = item.quantity - (item.returned_qty || 0)
    if (itemQty <= 0) continue

    const itemTotal = itemQty * item.unit_price
    const totalStr = formatCLP(itemTotal)
    const unitPriceStr = formatCLP(item.unit_price)
    const safeItemName = sanitizeForThermalEscPos(item.name)

    if (itemsLayout === '4_cols') {
      // 4 columns: [Cant 4] [Name flexible] [UnitPrice 9] [Total 9]
      const qtyCol = String(itemQty).padEnd(4, ' ')
      const uPriceCol = unitPriceStr.padStart(9, ' ')
      const totCol = totalStr.padStart(9, ' ')
      const availNameLen = Math.max(8, widthChars - (4 + 10 + 10))
      const cleanName = safeItemName.length > availNameLen ? safeItemName.substring(0, availNameLen - 3) + '...' : safeItemName.padEnd(availNameLen, ' ')
      printer.println(`${qtyCol}${cleanName} ${uPriceCol} ${totCol}`)
    } else if (itemsLayout === '3_cols') {
      // 3 columns: [Cant 4] [Name flexible] [Total 10]
      const qtyCol = String(itemQty).padEnd(4, ' ')
      const totCol = totalStr.padStart(10, ' ')
      const availNameLen = Math.max(10, widthChars - (4 + 11))
      const cleanName = safeItemName.length > availNameLen ? safeItemName.substring(0, availNameLen - 3) + '...' : safeItemName.padEnd(availNameLen, ' ')
      printer.println(`${qtyCol}${cleanName} ${totCol}`)
    } else {
      // 2 columns (Compact): Name on top with total, unit price below
      const nameStr = `${itemQty}x ${safeItemName}`
      printer.leftRight(nameStr, totalStr)
      if (item.unit_price) {
        printer.println(`  (${unitPriceStr} c/u)`)
      }
    }
  }

  printer.println('-'.repeat(widthChars))

  // 4. Totals and Payments
  printer.alignRight()
  printer.bold(true)
  if (totalSize === 'double') {
    printer.setTextDoubleHeight()
  }
  printer.println(`TOTAL: ${formatCLP(saleDetail.total)}`)
  printer.setTextNormal()
  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  }
  printer.bold(false)

  printer.alignLeft()
  const isExchangeSale = Boolean(saleDetail.exchange_parent_id)
  const paymentsSum = saleDetail.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0
  const devolutionAmount = isExchangeSale ? saleDetail.total - paymentsSum : 0

  if ((saleDetail.payments && saleDetail.payments.length > 0) || devolutionAmount > 0) {
    printer.println('FORMAS DE PAGO:')
    if (devolutionAmount > 0) {
      printer.leftRight('  Devolucion:', formatCLP(devolutionAmount))
    }
    const methodLabels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia'
    }
    if (saleDetail.payments) {
      for (const p of saleDetail.payments) {
        const mLabel = methodLabels[p.method] || p.method
        printer.leftRight(`  ${mLabel}:`, formatCLP(p.amount))
      }
    }
  }

  if (change > 0) {
    printer.leftRight('  Vuelto:', formatCLP(change))
  }

  // 5. Footer & Courtesy Message
  printer.println('-'.repeat(widthChars))
  printer.alignCenter()
  printer.println(sanitizeForThermalEscPos(footerMsg))
  printer.newLine()

  // 6. Cash drawer pulse (if enabled)
  if (openDrawerOnPrint) {
    if (typeof printer.append === 'function') {
      // Pin 2 + Pin 5 with 50ms ON / 500ms OFF + Star BEL
      printer.append(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa, 0x1b, 0x70, 0x01, 0x19, 0xfa, 0x07]))
    } else if (typeof printer.openCashDrawer === 'function') {
      printer.openCashDrawer()
    }
  }

  // 7. Paper cut
  printer.cut()
}

/**
 * Builds ESC/POS layout for printer diagnostic testing.
 */
export function buildThermalTestTicket(options: BuildTestTicketOptions): void {
  const {
    printer,
    widthChars,
    paperWidth,
    businessName,
    fontFamily = 'font_a',
    bodySize = 'normal',
    headerEmphasis = 'double',
    itemsLayout = '2_cols',
    totalSize = 'double'
  } = options

  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  } else {
    printer.setTypeFontA()
  }

  if (bodySize === 'compact') {
    try {
      printer.setLineSpacing(24)
    } catch {
      // Safe fallback
    }
  } else {
    try {
      printer.resetLineSpacing()
    } catch {
      // Safe fallback
    }
  }

  printer.alignCenter()
  printer.bold(true)
  if (headerEmphasis === 'double') {
    printer.setTextDoubleHeight()
  }
  printer.println('*** TICKET DE PRUEBA ***')
  printer.setTextNormal()
  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  }
  printer.println(sanitizeForThermalEscPos(businessName || 'MAVE POS'))
  printer.bold(false)
  printer.println('-'.repeat(widthChars))

  printer.alignLeft()
  printer.println('Impresora termica: CONECTADA')
  printer.println(`Ancho configurado: ${paperWidth} (${widthChars} columnas)`)
  printer.println(`Fuente: ${fontFamily === 'font_b' ? 'Fuente B (Condensada)' : 'Fuente A (Estandar)'}`)
  printer.println(`Formato Columnas: ${itemsLayout}`)
  printer.println(`Tamano Total: ${totalSize === 'double' ? 'Doble Alto' : 'Normal'}`)
  const testDate = sanitizeForThermalEscPos(new Date().toLocaleString('es-CL'))
  printer.println(`Fecha y Hora: ${testDate}`)
  printer.println('-'.repeat(widthChars))

  printer.leftRight('Prueba de alineacion:', 'OK $ 10.000')
  printer.alignCenter()
  printer.println('Test de impresion completado exitosamente!')
  printer.newLine()

  printer.cut()
}

export interface GenerateThermalReceiptHtmlOptions {
  saleDetail: SaleDetail
  business: BusinessInfo
  change?: number
  paperWidth?: ThermalPaperWidth
  fontFamily?: string
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
  itemsLayout?: ThermalItemsLayout
  totalSize?: ThermalTotalSize
}

/**
 * Generates pixel-perfect HTML receipt styled for silent Windows spooler thermal printing.
 */
export function generateThermalReceiptHtml(options: GenerateThermalReceiptHtmlOptions): string {
  const {
    saleDetail,
    business,
    change = 0,
    paperWidth = '80mm',
    fontFamily = 'Segoe UI, sans-serif',
    bodySize = 'normal',
    headerEmphasis = 'double',
    itemsLayout = '2_cols',
    totalSize = 'double'
  } = options

  const businessName = business.name || 'PUNTO DE VENTA'
  const businessRut = business.rut || ''
  const businessActivity = business.activity || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''
  const businessEmail = business.email || ''
  const footerMsg = business.footerMessage || '¡Gracias por su preferencia!'

  const dateStr = new Date(
    saleDetail.completed_at || saleDetail.created_at || Date.now()
  ).toLocaleString('es-CL')

  const widthMm = paperWidth === '58mm' ? 48 : 72
  const paddingMm = paperWidth === '58mm' ? 1 : 2
  const fontSizeBase = paperWidth === '58mm' ? '10.5px' : '12px'
  const lineHeight = bodySize === 'compact' ? '1.2' : '1.35'

  const renderedItems = saleDetail.items
    .map((item) => {
      const qty = item.quantity - (item.returned_qty || 0)
      if (qty <= 0) return ''
      const total = qty * item.unit_price
      const totalStr = formatCLP(total)
      const unitPriceStr = formatCLP(item.unit_price)

      if (itemsLayout === '4_cols') {
        return `
          <tr style="border-bottom: 1px dotted #cbd5e1;">
            <td style="padding: 2px 2px 2px 0; text-align: left; vertical-align: top; width: 18px;">${qty}</td>
            <td style="padding: 2px 3px; text-align: left; vertical-align: top; word-break: break-word;">${item.name}</td>
            <td style="padding: 2px 2px; text-align: right; vertical-align: top; white-space: nowrap; font-size: 0.9em;">${unitPriceStr}</td>
            <td style="padding: 2px 0 2px 2px; text-align: right; vertical-align: top; font-weight: bold; white-space: nowrap;">${totalStr}</td>
          </tr>
        `
      } else if (itemsLayout === '3_cols') {
        return `
          <tr style="border-bottom: 1px dotted #cbd5e1;">
            <td style="padding: 2px 2px 2px 0; text-align: left; vertical-align: top; width: 18px;">${qty}</td>
            <td style="padding: 2px 3px; text-align: left; vertical-align: top; word-break: break-word;">${item.name}</td>
            <td style="padding: 2px 0 2px 2px; text-align: right; vertical-align: top; font-weight: bold; white-space: nowrap;">${totalStr}</td>
          </tr>
        `
      } else {
        // 2 cols
        return `
          <div style="margin-bottom: 5px; border-bottom: 1px dotted #e2e8f0; padding-bottom: 3px;">
            <div style="display: flex; justify-content: space-between; gap: 4px; font-weight: 500;">
              <span style="word-break: break-word;">${qty}x ${item.name}</span>
              <span style="font-weight: bold; white-space: nowrap;">${totalStr}</span>
            </div>
            <div style="font-size: 0.9em; color: #475569; padding-left: 6px;">
              (${unitPriceStr} c/u)
            </div>
          </div>
        `
      }
    })
    .join('')

  const isExchangeSale = Boolean(saleDetail.exchange_parent_id)
  const paymentsSum = saleDetail.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0
  const devolutionAmount = isExchangeSale ? saleDetail.total - paymentsSum : 0

  const methodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia'
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Ticket Venta #${saleDetail.folio ?? saleDetail.id}</title>
      <style>
        @page {
          margin: 0;
          size: ${paperWidth === '58mm' ? '58mm' : '80mm'} auto;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          word-break: break-word;
        }
        html, body {
          font-family: ${fontFamily};
          font-size: ${fontSizeBase};
          line-height: ${lineHeight};
          color: #000000 !important;
          background-color: #ffffff !important;
          margin: 0;
          padding: ${paddingMm}mm;
          width: ${widthMm}mm;
          max-width: ${widthMm}mm;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .flex-between { display: flex; justify-content: space-between; gap: 4px; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: inherit; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div style="font-weight: bold; ${headerEmphasis === 'double' ? 'font-size: 1.3em;' : 'font-size: 1.1em;'} margin-bottom: 2px;">
          ${businessName}
        </div>
        ${businessRut ? `<div>RUT: ${businessRut}</div>` : ''}
        ${businessActivity ? `<div>${businessActivity}</div>` : ''}
        ${businessAddress ? `<div>${businessAddress}</div>` : ''}
        ${businessPhone ? `<div>Tel: ${businessPhone}</div>` : ''}
        ${businessEmail ? `<div>${businessEmail}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div>
        <div class="flex-between">
          <span class="font-bold">FOLIO: #${saleDetail.folio ?? saleDetail.id}</span>
          <span>Turno: #${saleDetail.ticket_number ?? 0}</span>
        </div>
        <div style="font-size: 0.9em; color: #333;">Fecha: ${dateStr}</div>
      </div>

      <div class="divider"></div>

      ${
        itemsLayout === '4_cols' || itemsLayout === '3_cols'
          ? `
            <table>
              <thead>
                <tr style="border-bottom: 1px solid #000; font-size: 0.9em;">
                  <th style="text-align: left; padding-bottom: 2px;">CANT</th>
                  <th style="text-align: left; padding-bottom: 2px;">DESCRIPCION</th>
                  ${itemsLayout === '4_cols' ? '<th style="text-align: right; padding-bottom: 2px;">P.UNIT</th>' : ''}
                  <th style="text-align: right; padding-bottom: 2px;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${renderedItems}
              </tbody>
            </table>
          `
          : `
            <div>
              <div class="flex-between font-bold" style="font-size: 0.9em; margin-bottom: 3px;">
                <span>CANT / DESCRIPCION</span>
                <span>TOTAL</span>
              </div>
              ${renderedItems}
            </div>
          `
      }

      <div class="divider"></div>

      <div class="text-right" style="margin: 6px 0;">
        <span class="font-bold" style="${totalSize === 'double' ? 'font-size: 1.4em;' : 'font-size: 1.1em;'}">
          TOTAL: ${formatCLP(saleDetail.total)}
        </span>
      </div>

      ${
        (saleDetail.payments && saleDetail.payments.length > 0) || devolutionAmount > 0
          ? `
            <div style="font-size: 0.95em; margin-top: 4px;">
              <div class="font-bold">FORMAS DE PAGO:</div>
              ${
                devolutionAmount > 0
                  ? `<div class="flex-between" style="padding-left: 6px;">
                      <span>Devolución:</span>
                      <span>${formatCLP(devolutionAmount)}</span>
                    </div>`
                  : ''
              }
              ${(saleDetail.payments || [])
                .map(
                  (p) => `
                    <div class="flex-between" style="padding-left: 6px;">
                      <span>${methodLabels[p.method] || p.method}:</span>
                      <span>${formatCLP(p.amount)}</span>
                    </div>
                  `
                )
                .join('')}
              ${
                change > 0
                  ? `<div class="flex-between font-bold" style="padding-left: 6px; margin-top: 2px;">
                      <span>Vuelto:</span>
                      <span>${formatCLP(change)}</span>
                    </div>`
                  : ''
              }
            </div>
          `
          : ''
      }

      <div class="divider" style="margin-top: 8px;"></div>

      <div class="text-center" style="font-size: 0.9em; margin-top: 6px; padding-bottom: 4mm;">
        ${footerMsg}
      </div>
    </body>
    </html>
  `
}

/**
 * Generates printable HTML string for regular document printers (A4/Carta).
 */
export function generateNormalReceiptHtml(saleDetail: SaleDetail, business: BusinessInfo): string {
  const businessName = business.name || 'Lanas & Tejidos Mave'
  const businessRut = business.rut || ''
  const businessActivity = business.activity || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''
  const footerMsg = business.footerMessage || '¡Gracias por su compra!'

  const dateStr = new Date(saleDetail.completed_at || saleDetail.created_at || Date.now()).toLocaleString('es-CL')

  const itemRows = saleDetail.items
    .map((item) => {
      const qty = item.quantity - (item.returned_qty || 0)
      if (qty <= 0) return ''
      const total = qty * item.unit_price
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-family: monospace;">${item.product_code}</td>
          <td style="padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="padding: 8px; text-align: center;">${qty}</td>
          <td style="padding: 8px; text-align: right;">${formatCLP(item.unit_price)}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${formatCLP(total)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Comprobante de Venta #${saleDetail.folio}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 24px; max-width: 650px; margin: auto; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #8b5cf6; padding-bottom: 12px; }
        .header h1 { margin: 0 0 6px 0; color: #6d28d9; font-size: 20px; }
        .header p { margin: 2px 0; font-size: 12px; color: #64748b; }
        .details { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
        .totals { text-align: right; font-size: 14px; margin-top: 12px; }
        .total-amount { font-size: 18px; font-weight: 900; color: #6d28d9; }
        .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${businessName}</h1>
        ${businessRut ? `<p>RUT: ${businessRut}</p>` : ''}
        ${businessActivity ? `<p>${businessActivity}</p>` : ''}
        ${businessAddress ? `<p>${businessAddress}</p>` : ''}
        ${businessPhone ? `<p>Tel: ${businessPhone}</p>` : ''}
      </div>
      <div class="details">
        <div>
          <strong>FOLIO: #${saleDetail.folio ?? saleDetail.id}</strong><br />
          <span>Ticket: #${saleDetail.ticket_number ?? 0}</span>
        </div>
        <div style="text-align: right;">
          <span>Fecha: ${dateStr}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th style="text-align: center;">Cant.</th>
            <th style="text-align: right;">Unitario</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      <div class="totals">
        <p>Total a Pagar: <span class="total-amount">${formatCLP(saleDetail.total)}</span></p>
      </div>
      <div class="footer">
        <p>${footerMsg}</p>
      </div>
    </body>
    </html>
  `
}

export interface BuildThermalCashCutOptions {
  printer: any
  widthChars: number
  data: any
  business: BusinessInfo
  fontFamily?: ThermalFontFamily
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
}

/**
 * Builds ESC/POS thermal layout for cash cut / session closing receipt.
 */
export function buildThermalCashCutReceipt(options: BuildThermalCashCutOptions): void {
  const {
    printer,
    widthChars,
    data,
    business,
    fontFamily = 'font_a',
    bodySize = 'normal',
    headerEmphasis = 'double'
  } = options

  const businessName = business.name || 'PUNTO DE VENTA'
  const businessRut = business.rut || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''

  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  } else {
    printer.setTypeFontA()
  }

  if (bodySize === 'compact') {
    try {
      printer.setLineSpacing(24)
    } catch {
      // Ignorar
    }
  } else {
    try {
      printer.resetLineSpacing()
    } catch {
      // Ignorar
    }
  }

  // 1. Cabecera
  printer.alignCenter()
  printer.bold(true)
  if (headerEmphasis === 'double') {
    printer.setTextDoubleHeight()
  }
  printer.println(sanitizeForThermalEscPos(businessName))
  printer.setTextNormal()
  if (fontFamily === 'font_b') {
    printer.setTypeFontB()
  }
  printer.bold(false)

  if (businessRut) printer.println(sanitizeForThermalEscPos(`RUT: ${businessRut}`))
  if (businessAddress) printer.println(sanitizeForThermalEscPos(businessAddress))
  if (businessPhone) printer.println(sanitizeForThermalEscPos(`Tel: ${businessPhone}`))

  printer.println('-'.repeat(widthChars))
  printer.bold(true)
  printer.println('COMPROBANTE DE CORTE DE CAJA')
  printer.bold(false)
  printer.println(`Sesion #${data.sessionId}`)
  if (data.openedAt) {
    const openedStr = sanitizeForThermalEscPos(new Date(data.openedAt).toLocaleString('es-CL'))
    printer.println(`Apertura: ${openedStr}`)
  }
  const closedStr = sanitizeForThermalEscPos(new Date(data.closedAt || Date.now()).toLocaleString('es-CL'))
  printer.println(`Cierre: ${closedStr}`)
  printer.println('-'.repeat(widthChars))

  // 2. Detalle financiero
  printer.alignLeft()
  printer.leftRight('Fondo Inicial:', formatCLP(data.openingFund ?? 0))
  printer.leftRight('Ventas Efectivo:', `+${formatCLP(data.salesCash ?? 0)}`)
  printer.leftRight('Ventas Tarjeta:', `+${formatCLP(data.salesCard ?? 0)}`)
  printer.leftRight('Ventas Transferencia:', `+${formatCLP(data.salesTransfer ?? 0)}`)
  printer.println('-'.repeat(widthChars))

  printer.bold(true)
  printer.leftRight('TOTAL VENTAS:', formatCLP(data.salesTotal ?? 0))
  printer.bold(false)

  if (data.returnsTotal) {
    printer.leftRight('Devoluciones:', `-${formatCLP(data.returnsTotal)}`)
  }
  if (data.withdrawalsTotal) {
    printer.leftRight('Salidas de Dinero:', `-${formatCLP(data.withdrawalsTotal)}`)
  }

  printer.println('-'.repeat(widthChars))
  printer.bold(true)
  printer.leftRight('EFECTIVO CONTADO:', formatCLP(data.closingCash ?? 0))
  printer.bold(false)
  printer.leftRight('Efectivo Esperado:', formatCLP(data.expectedCash ?? 0))

  if (data.difference !== null && data.difference !== undefined) {
    const diffSign = data.difference > 0 ? '+' : ''
    printer.bold(true)
    printer.leftRight('DIFERENCIA:', `${diffSign}${formatCLP(data.difference)}`)
    printer.bold(false)
  }

  if (data.withdrawalAmount !== null && data.withdrawalAmount !== undefined) {
    printer.println('-'.repeat(widthChars))
    printer.leftRight('Monto Retirado:', formatCLP(data.withdrawalAmount))
  }
  if (data.nextOpeningFund !== null && data.nextOpeningFund !== undefined) {
    printer.leftRight('Fondo Sig. Turno:', formatCLP(data.nextOpeningFund))
  }

  if (data.notes) {
    printer.println('-'.repeat(widthChars))
    printer.println(sanitizeForThermalEscPos(`Notas: ${data.notes}`))
  }

  printer.println('-'.repeat(widthChars))
  printer.alignCenter()
  printer.println('*** FIN DEL COMPROBANTE ***')
  printer.newLine()
  printer.cut()
}

export interface GenerateThermalCashCutHtmlOptions {
  data: any
  business: BusinessInfo
  paperWidth?: ThermalPaperWidth
  fontFamily?: string
  bodySize?: ThermalBodySize
  headerEmphasis?: ThermalHeaderEmphasis
}

/**
 * Generates pixel-perfect HTML receipt for silent graphical thermal printing of a cash cut.
 */
export function generateThermalCashCutHtml(options: GenerateThermalCashCutHtmlOptions): string {
  const {
    data,
    business,
    paperWidth = '80mm',
    fontFamily = 'Segoe UI, sans-serif',
    bodySize = 'normal',
    headerEmphasis = 'double'
  } = options

  const businessName = business.name || 'PUNTO DE VENTA'
  const businessRut = business.rut || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''

  const openedDateStr = data.openedAt ? new Date(data.openedAt).toLocaleString('es-CL') : null
  const closedDateStr = new Date(data.closedAt || Date.now()).toLocaleString('es-CL')

  const widthMm = paperWidth === '58mm' ? 48 : 72
  const paddingMm = paperWidth === '58mm' ? 1 : 2
  const fontSizeBase = paperWidth === '58mm' ? '10.5px' : '12px'
  const lineHeight = bodySize === 'compact' ? '1.2' : '1.35'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Corte de Caja #${data.sessionId}</title>
      <style>
        @page {
          margin: 0;
          size: ${paperWidth === '58mm' ? '58mm' : '80mm'} auto;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          word-break: break-word;
        }
        html, body {
          font-family: ${fontFamily};
          font-size: ${fontSizeBase};
          line-height: ${lineHeight};
          color: #000000 !important;
          background-color: #ffffff !important;
          margin: 0;
          padding: ${paddingMm}mm;
          width: ${widthMm}mm;
          max-width: ${widthMm}mm;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .flex-between { display: flex; justify-content: space-between; gap: 4px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div style="font-weight: bold; ${headerEmphasis === 'double' ? 'font-size: 1.3em;' : 'font-size: 1.1em;'} margin-bottom: 2px;">
          ${businessName}
        </div>
        ${businessRut ? `<div>RUT: ${businessRut}</div>` : ''}
        ${businessAddress ? `<div>${businessAddress}</div>` : ''}
        ${businessPhone ? `<div>Tel: ${businessPhone}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="text-center font-bold" style="font-size: 1.05em;">
        CORTE DE CAJA / CIERRE DE TURNO
      </div>
      <div class="text-center" style="font-size: 0.9em; margin-bottom: 3px;">
        Sesión #${data.sessionId}
      </div>
      ${openedDateStr ? `<div style="font-size: 0.85em; color: #333;">Apertura: ${openedDateStr}</div>` : ''}
      <div style="font-size: 0.85em; color: #333;">Cierre: ${closedDateStr}</div>

      <div class="divider"></div>

      <div class="flex-between">
        <span>Fondo Inicial:</span>
        <span class="font-bold">${formatCLP(data.openingFund ?? 0)}</span>
      </div>
      <div class="flex-between">
        <span>Ventas Efectivo:</span>
        <span class="font-bold">+${formatCLP(data.salesCash ?? 0)}</span>
      </div>
      <div class="flex-between">
        <span>Ventas Tarjeta:</span>
        <span class="font-bold">+${formatCLP(data.salesCard ?? 0)}</span>
      </div>
      <div class="flex-between">
        <span>Ventas Transferencia:</span>
        <span class="font-bold">+${formatCLP(data.salesTransfer ?? 0)}</span>
      </div>

      <div class="divider" style="border-top-style: solid;"></div>

      <div class="flex-between font-bold">
        <span>TOTAL VENTAS:</span>
        <span>${formatCLP(data.salesTotal ?? 0)}</span>
      </div>

      ${
        data.returnsTotal
          ? `<div class="flex-between">
              <span>Devoluciones:</span>
              <span>-${formatCLP(data.returnsTotal)}</span>
            </div>`
          : ''
      }
      ${
        data.withdrawalsTotal
          ? `<div class="flex-between">
              <span>Salidas de Dinero:</span>
              <span>-${formatCLP(data.withdrawalsTotal)}</span>
            </div>`
          : ''
      }

      <div class="divider"></div>

      <div class="flex-between font-bold" style="font-size: 1.1em;">
        <span>EFECTIVO CONTADO:</span>
        <span>${formatCLP(data.closingCash ?? 0)}</span>
      </div>
      <div class="flex-between">
        <span>Efectivo Esperado:</span>
        <span>${formatCLP(data.expectedCash ?? 0)}</span>
      </div>

      ${
        data.difference !== null && data.difference !== undefined
          ? `<div class="flex-between font-bold" style="margin-top: 2px;">
              <span>Diferencia:</span>
              <span>${data.difference > 0 ? `+${formatCLP(data.difference)}` : formatCLP(data.difference)}</span>
            </div>`
          : ''
      }

      ${
        data.withdrawalAmount !== null && data.withdrawalAmount !== undefined
          ? `<div class="divider"></div>
            <div class="flex-between font-bold">
              <span>Monto Retirado:</span>
              <span>${formatCLP(data.withdrawalAmount)}</span>
            </div>`
          : ''
      }

      ${
        data.nextOpeningFund !== null && data.nextOpeningFund !== undefined
          ? `<div class="flex-between font-bold">
              <span>Fondo Sig. Turno:</span>
              <span>${formatCLP(data.nextOpeningFund)}</span>
            </div>`
          : ''
      }

      ${
        data.notes
          ? `<div class="divider"></div>
            <div style="font-size: 0.85em; font-style: italic;">
              <strong>Notas:</strong> ${data.notes}
            </div>`
          : ''
      }

      <div class="divider" style="margin-top: 8px;"></div>
      <div class="text-center" style="font-size: 0.85em; margin-top: 4px; padding-bottom: 4mm;">
        *** FIN DEL COMPROBANTE ***
      </div>
    </body>
    </html>
  `
}

