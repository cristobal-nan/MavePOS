import { SaleDetail } from '../../../shared/types'
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
}

export interface BuildTestTicketOptions {
  printer: any
  widthChars: number
  paperWidth: string
  businessName: string
}

/**
 * Builds ESC/POS receipt layout for 58mm or 80mm thermal receipt printers.
 */
export function buildThermalReceipt(options: BuildThermalReceiptOptions): void {
  const { printer, widthChars, saleDetail, change = 0, openDrawerOnPrint, business } = options

  const businessName = business.name || 'PUNTO DE VENTA'
  const businessRut = business.rut || ''
  const businessActivity = business.activity || ''
  const businessAddress = business.address || ''
  const businessPhone = business.phone || ''
  const businessEmail = business.email || ''
  const footerMsg = business.footerMessage || '¡Gracias por su preferencia!'

  // 1. Header: Business info
  printer.alignCenter()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println(businessName)
  printer.setTextNormal()
  printer.bold(false)

  if (businessRut) printer.println(`RUT: ${businessRut}`)
  if (businessActivity) printer.println(businessActivity)
  if (businessAddress) printer.println(businessAddress)
  if (businessPhone) printer.println(`Tel: ${businessPhone}`)
  if (businessEmail) printer.println(businessEmail)

  printer.println('-'.repeat(widthChars))

  // 2. Transaction details
  printer.alignLeft()
  printer.bold(true)
  printer.println(`FOLIO DE VENTA: #${saleDetail.folio ?? saleDetail.id}`)
  printer.bold(false)
  printer.println(`Ticket de Turno: #${saleDetail.ticket_number ?? 0}`)

  const saleDate = saleDetail.completed_at || saleDetail.created_at || new Date().toISOString()
  const formattedDate = new Date(saleDate).toLocaleString('es-CL')
  printer.println(`Fecha: ${formattedDate}`)
  printer.println('-'.repeat(widthChars))

  // 3. Items list
  printer.bold(true)
  printer.leftRight('CANT / DESCRIPCION', 'TOTAL')
  printer.bold(false)
  printer.println('-'.repeat(widthChars))

  for (const item of saleDetail.items) {
    const itemQty = item.quantity - (item.returned_qty || 0)
    if (itemQty <= 0) continue

    const itemTotal = itemQty * item.unit_price
    const totalStr = formatCLP(itemTotal)
    const nameStr = `${itemQty}x ${item.name}`

    printer.leftRight(nameStr, totalStr)
    if (item.unit_price) {
      printer.println(`  (${formatCLP(item.unit_price)} c/u)`)
    }
  }

  printer.println('-'.repeat(widthChars))

  // 4. Totals and Payments
  printer.alignRight()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println(`TOTAL: ${formatCLP(saleDetail.total)}`)
  printer.setTextNormal()
  printer.bold(false)

  printer.alignLeft()
  const isExchangeSale = Boolean(saleDetail.exchange_parent_id)
  const paymentsSum = saleDetail.payments?.reduce((acc, p) => acc + p.amount, 0) ?? 0
  const devolutionAmount = isExchangeSale ? saleDetail.total - paymentsSum : 0

  if ((saleDetail.payments && saleDetail.payments.length > 0) || devolutionAmount > 0) {
    printer.println('FORMAS DE PAGO:')
    if (devolutionAmount > 0) {
      printer.leftRight('  Devolución:', formatCLP(devolutionAmount))
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
  printer.println(footerMsg)
  printer.newLine()

  // 6. Cash drawer pulse (if enabled)
  if (openDrawerOnPrint) {
    printer.openCashDrawer()
  }

  // 7. Paper cut
  printer.cut()
}

/**
 * Builds ESC/POS layout for printer diagnostic testing.
 */
export function buildThermalTestTicket(options: BuildTestTicketOptions): void {
  const { printer, widthChars, paperWidth, businessName } = options

  printer.alignCenter()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println('*** TICKET DE PRUEBA ***')
  printer.setTextNormal()
  printer.println(businessName || 'MAVE POS')
  printer.bold(false)
  printer.println('-'.repeat(widthChars))

  printer.alignLeft()
  printer.println('Impresora térmica: CONECTADA')
  printer.println(`Ancho configurado: ${paperWidth} (${widthChars} columnas)`)
  printer.println(`Fecha y Hora: ${new Date().toLocaleString('es-CL')}`)
  printer.println('-'.repeat(widthChars))

  printer.leftRight('Prueba de alineación:', 'OK $ 10.000')
  printer.alignCenter()
  printer.println('¡Test de impresión completado exitosamente!')
  printer.newLine()

  printer.cut()
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
