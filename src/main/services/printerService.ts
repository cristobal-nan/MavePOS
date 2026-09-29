import { BrowserWindow } from 'electron'
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer'
import Database from 'better-sqlite3'
import {
  PrinterConfig,
  PrinterInfo,
  PrintResult,
  SaleDetail,
  ThermalPaperWidth
} from '../../shared/types'
import { SettingsService } from './settingsService'

export class PrinterService {
  constructor(
    private db: Database.Database,
    private settingsService: SettingsService
  ) {}

  /**
   * Retrieves user printer configuration from settings table with sensible defaults.
   */
  getPrinterConfig(): PrinterConfig {
    const thermalType = (this.settingsService.get('printer_thermal_type', 'epson') as any) || 'epson'
    const thermalInterfaceType =
      (this.settingsService.get('printer_thermal_interface_type', 'windows_printer') as any) || 'windows_printer'
    const thermalInterface = this.settingsService.get('printer_thermal_interface', '') || ''
    const paperWidth = (this.settingsService.get('printer_thermal_paper_width', '80mm') as ThermalPaperWidth) || '80mm'
    const openDrawerOnPrint = this.settingsService.get('printer_cash_drawer_enabled', 'true') === 'true'
    const autoPrintOnSale = this.settingsService.get('printer_auto_print_ticket', 'false') === 'true'
    const normalPrinterName = this.settingsService.get('printer_normal_name', '') || undefined

    return {
      thermalType,
      thermalInterfaceType,
      thermalInterface,
      paperWidth,
      openDrawerOnPrint,
      autoPrintOnSale,
      normalPrinterName
    }
  }

  /**
   * Saves updated printer configuration to the settings table.
   */
  savePrinterConfig(config: Partial<PrinterConfig>): void {
    if (config.thermalType !== undefined) {
      this.settingsService.set('printer_thermal_type', config.thermalType)
    }
    if (config.thermalInterfaceType !== undefined) {
      this.settingsService.set('printer_thermal_interface_type', config.thermalInterfaceType)
    }
    if (config.thermalInterface !== undefined) {
      this.settingsService.set('printer_thermal_interface', config.thermalInterface)
    }
    if (config.paperWidth !== undefined) {
      this.settingsService.set('printer_thermal_paper_width', config.paperWidth)
    }
    if (config.openDrawerOnPrint !== undefined) {
      this.settingsService.set('printer_cash_drawer_enabled', config.openDrawerOnPrint ? 'true' : 'false')
    }
    if (config.autoPrintOnSale !== undefined) {
      this.settingsService.set('printer_auto_print_ticket', config.autoPrintOnSale ? 'true' : 'false')
    }
    if (config.normalPrinterName !== undefined) {
      this.settingsService.set('printer_normal_name', config.normalPrinterName)
    }
  }

  /**
   * Retrieves list of printers installed in the operating system.
   */
  async getInstalledPrinters(window?: BrowserWindow): Promise<PrinterInfo[]> {
    if (window && window.webContents && window.webContents.getPrintersAsync) {
      try {
        const printers = await window.webContents.getPrintersAsync()
        return printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          description: p.description || '',
          isDefault: p.isDefault,
          status: p.status
        }))
      } catch (err) {
        console.error('Error fetching OS printers:', err)
      }
    }
    return []
  }

  /**
   * Instantiates a configured ThermalPrinter instance.
   */
  createPrinterInstance(customConfig?: Partial<PrinterConfig>): any {
    const config = { ...this.getPrinterConfig(), ...customConfig }
    const printerType = config.thermalType === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON

    const widthChars = config.paperWidth === '58mm' ? 32 : 48

    // Resolve interface target
    let iface = config.thermalInterface || ''
    if (config.thermalInterfaceType === 'windows_printer' && iface && !iface.startsWith('printer:')) {
      iface = `printer:${iface}`
    }

    const printer = new (ThermalPrinter as any)({
      type: printerType,
      interface: iface,
      width: widthChars,
      characterSet: 'PC850_MULTILINGUAL',
      removeSpecialCharacters: false
    })

    return { printer, widthChars, config }
  }

  /**
   * Builds the formatted ESC/POS receipt for a sale.
   */
  buildReceiptCommands(printerObj: any, saleDetail: SaleDetail, change = 0): void {
    const { printer, widthChars, config } = printerObj

    // Business Data from settings
    const businessName = this.settingsService.get('business_name', 'PUNTO DE VENTA') || 'PUNTO DE VENTA'
    const businessRut = this.settingsService.get('business_rut', '') || ''
    const businessActivity = this.settingsService.get('business_activity', '') || ''
    const businessAddress = this.settingsService.get('business_address', '') || ''
    const businessPhone = this.settingsService.get('business_phone', '') || ''
    const businessEmail = this.settingsService.get('business_email', '') || ''
    const footerMsg =
      this.settingsService.get('ticket_footer_message', '¡Gracias por su preferencia!') || '¡Gracias por su preferencia!'

    // 1. Header
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
      const totalStr = `$ ${itemTotal.toLocaleString('es-CL')}`
      const nameStr = `${itemQty}x ${item.name}`

      printer.leftRight(nameStr, totalStr)
      if (item.unit_price) {
        printer.println(`  ($ ${item.unit_price.toLocaleString('es-CL')} c/u)`)
      }
    }

    printer.println('-'.repeat(widthChars))

    // 4. Totals and Payments
    printer.alignRight()
    printer.bold(true)
    printer.setTextDoubleHeight()
    printer.println(`TOTAL: $ ${saleDetail.total.toLocaleString('es-CL')}`)
    printer.setTextNormal()
    printer.bold(false)

    printer.alignLeft()
    if (saleDetail.payments && saleDetail.payments.length > 0) {
      printer.println('FORMAS DE PAGO:')
      const methodLabels: Record<string, string> = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia'
      }
      for (const p of saleDetail.payments) {
        const mLabel = methodLabels[p.method] || p.method
        printer.leftRight(`  ${mLabel}:`, `$ ${p.amount.toLocaleString('es-CL')}`)
      }
    }

    if (change > 0) {
      printer.leftRight('  Vuelto:', `$ ${change.toLocaleString('es-CL')}`)
    }

    // 5. Footer & Courtesy Message
    printer.println('-'.repeat(widthChars))
    printer.alignCenter()
    printer.println(footerMsg)
    printer.newLine()

    // 6. Cash drawer pulse (if enabled)
    if (config.openDrawerOnPrint) {
      printer.openCashDrawer()
    }

    // 7. Paper cut
    printer.cut()
  }

  /**
   * Prints a thermal receipt for a sale.
   */
  async printThermalReceipt(
    saleDetail: SaleDetail,
    change = 0,
    customConfig?: Partial<PrinterConfig>
  ): Promise<PrintResult> {
    const printerObj = this.createPrinterInstance(customConfig)
    this.buildReceiptCommands(printerObj, saleDetail, change)

    try {
      if (!printerObj.config.thermalInterface) {
        return {
          success: false,
          error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
        }
      }

      await printerObj.printer.execute()
      return { success: true }
    } catch (err: any) {
      console.error('Error imprimiendo ticket térmico:', err)
      return {
        success: false,
        error: err.message || 'Error de comunicación con la impresora térmica.'
      }
    }
  }

  /**
   * Sends an ESC/POS pulse to open the cash drawer.
   */
  async openCashDrawer(customConfig?: Partial<PrinterConfig>): Promise<PrintResult> {
    const printerObj = this.createPrinterInstance(customConfig)
    printerObj.printer.openCashDrawer()

    try {
      if (!printerObj.config.thermalInterface) {
        return {
          success: false,
          error: 'No se ha configurado la interfaz de la impresora para el pulso de cajón.'
        }
      }

      await printerObj.printer.execute()
      return { success: true }
    } catch (err: any) {
      console.error('Error abriendo cajón monetario:', err)
      return {
        success: false,
        error: err.message || 'Error al emitir pulso de apertura al cajón.'
      }
    }
  }

  /**
   * Prints a diagnostic test ticket to verify thermal printer connectivity and formatting.
   */
  async printTestTicket(customConfig?: Partial<PrinterConfig>): Promise<PrintResult> {
    const printerObj = this.createPrinterInstance(customConfig)
    const { printer, widthChars } = printerObj

    const businessName = this.settingsService.get('business_name', 'MAVE POS') || 'MAVE POS'

    printer.alignCenter()
    printer.bold(true)
    printer.setTextDoubleHeight()
    printer.println('*** TICKET DE PRUEBA ***')
    printer.setTextNormal()
    printer.println(businessName)
    printer.bold(false)
    printer.println('-'.repeat(widthChars))

    printer.alignLeft()
    printer.println('Impresora térmica: CONECTADA')
    printer.println(`Ancho configurado: ${printerObj.config.paperWidth} (${widthChars} columnas)`)
    printer.println(`Fecha y Hora: ${new Date().toLocaleString('es-CL')}`)
    printer.println('-'.repeat(widthChars))

    printer.leftRight('Prueba de alineación:', 'OK $ 10.000')
    printer.alignCenter()
    printer.println('¡Test de impresión completado exitosamente!')
    printer.newLine()

    printer.cut()

    try {
      if (!printerObj.config.thermalInterface) {
        return {
          success: false,
          error: 'Por favor selecciona una impresora térmica antes de realizar la prueba.'
        }
      }

      await printer.execute()
      return { success: true }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'No se pudo comunicar con la impresora térmica.'
      }
    }
  }

  /**
   * Generates a printable HTML string for regular document printers (A4/Carta).
   */
  generateNormalReceiptHtml(saleDetail: SaleDetail): string {
    const businessName = this.settingsService.get('business_name', 'Lanas & Tejidos Mave') || 'Lanas & Tejidos Mave'
    const businessRut = this.settingsService.get('business_rut', '') || ''
    const businessActivity = this.settingsService.get('business_activity', '') || ''
    const businessAddress = this.settingsService.get('business_address', '') || ''
    const businessPhone = this.settingsService.get('business_phone', '') || ''
    const footerMsg =
      this.settingsService.get('ticket_footer_message', '¡Gracias por su compra!') || '¡Gracias por su compra!'

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
            <td style="padding: 8px; text-align: right;">$ ${item.unit_price.toLocaleString('es-CL')}</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">$ ${total.toLocaleString('es-CL')}</td>
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
          <p>Total a Pagar: <span class="total-amount">$ ${saleDetail.total.toLocaleString('es-CL')}</span></p>
        </div>
        <div class="footer">
          <p>${footerMsg}</p>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Prints normal receipt via standard Windows spooler.
   */
  async printNormalReceipt(saleDetail: SaleDetail, printerName?: string): Promise<PrintResult> {
    const html = this.generateNormalReceiptHtml(saleDetail)

    return new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false }
      })

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print(
          {
            silent: !!printerName,
            deviceName: printerName || ''
          },
          (success, failureReason) => {
            printWin.close()
            if (!success) {
              resolve({
                success: false,
                error: failureReason || 'Error al enviar a la impresora de Windows.'
              })
            } else {
              resolve({ success: true })
            }
          }
        )
      })
    })
  }
}
