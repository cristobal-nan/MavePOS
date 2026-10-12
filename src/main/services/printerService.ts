import { BrowserWindow, app, shell } from 'electron'
import path from 'path'
import fs from 'fs'
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
import {
  BusinessInfo,
  buildThermalReceipt,
  buildThermalTestTicket,
  buildThermalCashCutReceipt,
  generateNormalReceiptHtml,
  generateThermalReceiptHtml,
  generateThermalCashCutHtml
} from './printing/ticketTemplates'
import {
  sendRawBufferToPrinter,
  sendRawBufferToTcp,
  sendImageToPrinterViaGdi,
  CASH_DRAWER_PULSE_BUFFER
} from './printing/rawPrinterHelper'

export class PrinterService {
  constructor(
    private db: Database.Database,
    private settingsService: SettingsService
  ) {}

  /**
   * Retrieves business fiscal and header data from the settings table.
   */
  getBusinessInfo(): BusinessInfo {
    return {
      name: this.settingsService.get('business_name', 'PUNTO DE VENTA') || 'PUNTO DE VENTA',
      rut: this.settingsService.get('business_rut', '') || '',
      activity: this.settingsService.get('business_activity', '') || '',
      address: this.settingsService.get('business_address', '') || '',
      phone: this.settingsService.get('business_phone', '') || '',
      email: this.settingsService.get('business_email', '') || '',
      footerMessage:
        this.settingsService.get('ticket_footer_message', '¡Gracias por su preferencia!') ||
        '¡Gracias por su preferencia!'
    }
  }

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
    const thermalFontFamily =
      (this.settingsService.get('printer_thermal_font_family', 'font_a') as any) || 'font_a'
    const thermalBodySize =
      (this.settingsService.get('printer_thermal_body_size', 'normal') as any) || 'normal'
    const thermalHeaderEmphasis =
      (this.settingsService.get('printer_thermal_header_emphasis', 'double') as any) || 'double'
    const thermalPrintMode =
      (this.settingsService.get('printer_thermal_print_mode', 'graphic') as any) || 'graphic'
    const thermalItemsLayout =
      (this.settingsService.get('printer_thermal_items_layout', '2_cols') as any) || '2_cols'
    const thermalTotalSize =
      (this.settingsService.get('printer_thermal_total_size', 'double') as any) || 'double'
    const thermalSystemFont =
      this.settingsService.get('printer_thermal_system_font', 'Segoe UI, sans-serif') || 'Segoe UI, sans-serif'

    return {
      thermalType,
      thermalInterfaceType,
      thermalInterface,
      paperWidth,
      openDrawerOnPrint,
      autoPrintOnSale,
      normalPrinterName,
      thermalFontFamily,
      thermalBodySize,
      thermalHeaderEmphasis,
      thermalPrintMode,
      thermalItemsLayout,
      thermalTotalSize,
      thermalSystemFont
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
    if (config.thermalFontFamily !== undefined) {
      this.settingsService.set('printer_thermal_font_family', config.thermalFontFamily)
    }
    if (config.thermalBodySize !== undefined) {
      this.settingsService.set('printer_thermal_body_size', config.thermalBodySize)
    }
    if (config.thermalHeaderEmphasis !== undefined) {
      this.settingsService.set('printer_thermal_header_emphasis', config.thermalHeaderEmphasis)
    }
    if (config.thermalPrintMode !== undefined) {
      this.settingsService.set('printer_thermal_print_mode', config.thermalPrintMode)
    }
    if (config.thermalItemsLayout !== undefined) {
      this.settingsService.set('printer_thermal_items_layout', config.thermalItemsLayout)
    }
    if (config.thermalTotalSize !== undefined) {
      this.settingsService.set('printer_thermal_total_size', config.thermalTotalSize)
    }
    if (config.thermalSystemFont !== undefined) {
      this.settingsService.set('printer_thermal_system_font', config.thermalSystemFont)
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
   * Instantiates a configured ThermalPrinter instance in memory.
   */
  createPrinterInstance(customConfig?: Partial<PrinterConfig>): any {
    const config = { ...this.getPrinterConfig(), ...customConfig }
    const printerType = config.thermalType === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON
    const isFontB = config.thermalFontFamily === 'font_b'
    const widthChars = config.paperWidth === '58mm' ? (isFontB ? 42 : 32) : (isFontB ? 56 : 48)

    const printer = new (ThermalPrinter as any)({
      type: printerType,
      width: widthChars,
      characterSet: 'PC850_MULTILINGUAL',
      removeSpecialCharacters: false
    })

    return { printer, widthChars, config }
  }

  /**
   * Builds the formatted ESC/POS receipt for a sale, delegating layout to ticketTemplates.
   */
  buildReceiptCommands(printerObj: any, saleDetail: SaleDetail, change = 0): void {
    buildThermalReceipt({
      printer: printerObj.printer,
      widthChars: printerObj.widthChars,
      saleDetail,
      change,
      openDrawerOnPrint: printerObj.config.openDrawerOnPrint,
      business: this.getBusinessInfo(),
      fontFamily: printerObj.config.thermalFontFamily,
      bodySize: printerObj.config.thermalBodySize,
      headerEmphasis: printerObj.config.thermalHeaderEmphasis,
      itemsLayout: printerObj.config.thermalItemsLayout,
      totalSize: printerObj.config.thermalTotalSize
    })
  }

  /**
   * Dispatches a raw binary buffer to the configured printer interface (Windows Spooler RAW or TCP Network).
   */
  async dispatchThermalBuffer(
    buffer: Buffer,
    config: PrinterConfig,
    docTitle = 'POS Ticket'
  ): Promise<PrintResult> {
    const iface = config.thermalInterface?.trim()
    if (!iface) {
      return {
        success: false,
        error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
      }
    }

    if (config.thermalInterfaceType === 'tcp' || iface.startsWith('tcp://')) {
      return await sendRawBufferToTcp(iface, buffer)
    }

    // Windows spooler RAW printing
    const printerName = iface.replace(/^printer:/i, '').trim()
    return await sendRawBufferToPrinter(printerName, buffer, docTitle)
  }

  /**
   * Generates HTML markup for silent graphical thermal printing.
   */
  generateThermalGraphicHtml(
    saleDetail: SaleDetail,
    change = 0,
    config?: Partial<PrinterConfig>
  ): string {
    const effective = { ...this.getPrinterConfig(), ...config }
    return generateThermalReceiptHtml({
      saleDetail,
      business: this.getBusinessInfo(),
      change,
      paperWidth: effective.paperWidth,
      fontFamily: effective.thermalSystemFont || 'Segoe UI, sans-serif',
      bodySize: effective.thermalBodySize,
      headerEmphasis: effective.thermalHeaderEmphasis,
      itemsLayout: effective.thermalItemsLayout,
      totalSize: effective.thermalTotalSize
    })
  }

  /**
   * Renders thermal ticket HTML with chosen Windows fonts into a crisp PNG image buffer.
   * This captures the pixel-perfect layout and TrueType typography rendered by Chromium
   * at exact paper dot dimensions (384 dots for 58mm / 576 dots for 80mm).
   */
  async renderHtmlToTicketPngBuffer(
    html: string,
    paperWidth: ThermalPaperWidth = '80mm'
  ): Promise<Buffer> {
    const is58mm = paperWidth === '58mm'
    // Puntos térmicos estándar a 203 DPI: 576 dots (80mm) / 384 dots (58mm)
    const targetWidthDots = is58mm ? 384 : 576
    // Ancho CSS estándar en mm a 96 DPI: 72mm (~272px) / 48mm (~181px)
    const cssWidthMm = is58mm ? 48 : 72
    const zoomFactor = targetWidthDots / (cssWidthMm * 3.7795)

    const win = new BrowserWindow({
      show: false,
      width: targetWidthDots,
      height: 1200,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        zoomFactor
      }
    })

    try {
      const readyPromise = new Promise((resolve) => win.once('ready-to-show' as any, resolve))
      const loadPromise = win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await Promise.all([loadPromise, readyPromise])

      // Esperar brevemente a que las fuentes de Windows y el layout terminen de dibujarse
      await new Promise((resolve) => setTimeout(resolve, 100))

      win.webContents.setZoomFactor(zoomFactor)
      const heightPx = await win.webContents.executeJavaScript(
        'Math.max(document.body.offsetHeight, document.documentElement.offsetHeight, 100)'
      )
      const targetHeightDots = Math.ceil(heightPx * zoomFactor)

      win.setContentSize(targetWidthDots, targetHeightDots)

      const image = await win.webContents.capturePage({
        x: 0,
        y: 0,
        width: targetWidthDots,
        height: targetHeightDots
      })

      const pngBuffer = image.toPNG()
      if (!pngBuffer || pngBuffer.length === 0) {
        throw new Error('No se pudo capturar la imagen gráfica del ticket.')
      }

      return pngBuffer
    } finally {
      if (!win.isDestroyed()) {
        win.close()
      }
    }
  }

  /**
   * Prints silently via Chromium print spooler with custom roll size (58mm / 80mm x dynamic height).
   * For virtual PDF printers, saves a continuous receipt PDF in Documents/Tickets POS.
   * For physical Windows printers, dispatches via Windows driver with zero margins.
   */
  async printThermalGraphicViaChromiumSpooler(
    html: string,
    printerName: string,
    paperWidth: ThermalPaperWidth = '80mm'
  ): Promise<PrintResult> {
    const is58mm = paperWidth === '58mm'
    const isPdfPrinter = /pdf/i.test(printerName)

    return new Promise((resolve) => {
      const widthPx = is58mm ? 219 : 302
      const printWin = new BrowserWindow({
        show: false,
        frame: false,
        useContentSize: true,
        width: widthPx,
        height: 1200,
        backgroundColor: '#ffffff',
        webPreferences: { nodeIntegration: false }
      })

      const readyPromise = new Promise((r) => printWin.once('ready-to-show' as any, r))
      const loadPromise = printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      Promise.all([loadPromise, readyPromise])
        .then(async () => {
          await new Promise((r) => setTimeout(r, 120))

          const heightPx = await printWin.webContents.executeJavaScript(
            'Math.max(document.body.offsetHeight, document.documentElement.offsetHeight, 100)'
          )
          const heightMicrons = Math.ceil(heightPx * 264.5833)
          const widthMicrons = is58mm ? 58000 : 80000

          if (isPdfPrinter) {
            try {
              const pdfBuffer = await printWin.webContents.printToPDF({
                printBackground: true,
                margins: { marginType: 'none' },
                pageSize: {
                  width: widthMicrons,
                  height: heightMicrons
                }
              })

              const docsDir = app ? app.getPath('documents') : process.cwd()
              const ticketsDir = path.join(docsDir, 'Tickets POS')
              if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true })
              }
              const filePath = path.join(ticketsDir, `Ticket_${Date.now()}.pdf`)
              fs.writeFileSync(filePath, pdfBuffer)

              if (shell && typeof shell.openPath === 'function') {
                shell.openPath(filePath)
              }

              if (!printWin.isDestroyed()) printWin.close()
              resolve({ success: true })
              return
            } catch (pdfErr: any) {
              if (!printWin.isDestroyed()) printWin.close()
              resolve({
                success: false,
                error: pdfErr.message || 'Error al generar PDF del ticket.'
              })
              return
            }
          }

          printWin.webContents.print(
            {
              silent: true,
              deviceName: printerName,
              color: false,
              printBackground: false,
              margins: { marginType: 'none' },
              pageSize: {
                width: widthMicrons,
                height: heightMicrons
              }
            },
            (success, failureReason) => {
              if (!printWin.isDestroyed()) printWin.close()
              if (success) {
                resolve({ success: true })
              } else {
                resolve({
                  success: false,
                  error: failureReason || 'Error al enviar a la impresora de Windows.'
                })
              }
            }
          )
        })
        .catch((err) => {
          if (!printWin.isDestroyed()) printWin.close()
          resolve({
            success: false,
            error: err.message || 'Error cargando vista para impresión gráfica.'
          })
        })
    })
  }

  /**
   * Alias compatible para impresión gráfica silenciosa vía Chromium Spooler.
   */
  async printThermalGraphicSilent(
    html: string,
    printerName: string,
    paperWidth: ThermalPaperWidth = '80mm'
  ): Promise<PrintResult> {
    return await this.printThermalGraphicViaChromiumSpooler(html, printerName, paperWidth)
  }

  /**
   * Dispatches a thermal receipt in graphical mode (TrueType Windows fonts).
   * - Para impresoras virtuales (PDF/XPS): genera un PDF continuo en Tickets POS.
   * - Para impresoras térmicas de Windows: renderiza a imagen PNG nítida y la despacha
   *   directamente vía GDI (PrintDocument con wingdiprint/print_gdi.ps1), exactamente igual que Paint/Word,
   *   eliminando de raíz los bloques negros producidos por Chromium en drivers térmicos.
   */
  async printThermalGraphic(
    html: string,
    config: PrinterConfig,
    docTitle = 'POS Ticket'
  ): Promise<PrintResult> {
    const rawInterface = (config.thermalInterface || '').replace(/^printer:/i, '').trim()
    if (!rawInterface) {
      return {
        success: false,
        error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
      }
    }

    const isPdfPrinter = /pdf|xps|onenote|writer|fax/i.test(rawInterface)
    if (isPdfPrinter) {
      return await this.printThermalGraphicViaChromiumSpooler(
        html,
        rawInterface,
        config.paperWidth
      )
    }

    try {
      const pngBuffer = await this.renderHtmlToTicketPngBuffer(html, config.paperWidth)
      const gdiResult = await sendImageToPrinterViaGdi(rawInterface, pngBuffer, docTitle)

      if (!gdiResult.success) {
        console.warn('Fallo despacho GDI directo, reintentando via Spooler Chromium:', gdiResult.error)
        return await this.printThermalGraphicViaChromiumSpooler(
          html,
          rawInterface,
          config.paperWidth
        )
      }

      if (config.openDrawerOnPrint) {
        try {
          await this.openCashDrawer(config)
        } catch (drawerErr) {
          console.warn('Aviso: Ticket impreso pero falló pulso de cajón:', drawerErr)
        }
      }

      return { success: true }
    } catch (err: any) {
      console.error('Error imprimiendo ticket gráfico via GDI:', err)
      return {
        success: false,
        error: err.message || 'Error al renderizar el ticket gráfico para la impresora.'
      }
    }
  }

  /**
   * Prints a thermal receipt for a sale.
   * If thermalPrintMode is 'graphic' (default), prints with TrueType fonts rendered to ESC/POS raster.
   */
  async printThermalReceipt(
    saleDetail: SaleDetail,
    change = 0,
    customConfig?: Partial<PrinterConfig>
  ): Promise<PrintResult> {
    const config = { ...this.getPrinterConfig(), ...customConfig }

    if (!config.thermalInterface) {
      return {
        success: false,
        error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
      }
    }

    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic'

    if (isGraphicMode) {
      try {
        const html = this.generateThermalGraphicHtml(saleDetail, change, config)
        return await this.printThermalGraphic(
          html,
          config,
          `Venta #${saleDetail.folio ?? saleDetail.id}`
        )
      } catch (err: any) {
        console.error('Error imprimiendo ticket gráfico:', err)
        return {
          success: false,
          error: err.message || 'Error al imprimir ticket térmico gráfico.'
        }
      }
    }

    // Fallback: Impresión nativa ESC/POS RAW
    const printerObj = this.createPrinterInstance(customConfig)
    try {
      this.buildReceiptCommands(printerObj, saleDetail, change)
      const buffer = printerObj.printer.getBuffer()
      return await this.dispatchThermalBuffer(
        buffer,
        printerObj.config,
        `Venta #${saleDetail.folio ?? saleDetail.id}`
      )
    } catch (err: any) {
      console.error('Error imprimiendo ticket térmico ESC/POS:', err)
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
    const config = { ...this.getPrinterConfig(), ...customConfig }

    if (!config.thermalInterface) {
      return {
        success: false,
        error: 'No se ha configurado la interfaz de la impresora para el pulso de cajón.'
      }
    }

    try {
      return await this.dispatchThermalBuffer(
        CASH_DRAWER_PULSE_BUFFER,
        config,
        'Apertura Cajon'
      )
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
    const config = { ...this.getPrinterConfig(), ...customConfig }

    if (!config.thermalInterface) {
      return {
        success: false,
        error: 'Por favor selecciona una impresora térmica antes de realizar la prueba.'
      }
    }

    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic'

    if (isGraphicMode) {
      try {
        const dummySale: SaleDetail = {
          id: 0,
          folio: 1,
          ticket_number: 1,
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
              sale_id: 0,
              product_code: 'TEST-01',
              name: 'Producto de Prueba 1',
              quantity: 2,
              returned_qty: 0,
              unit_price: 4500
            },
            {
              id: 2,
              sale_id: 0,
              product_code: 'TEST-02',
              name: 'Producto de Prueba 2',
              quantity: 1,
              returned_qty: 0,
              unit_price: 3990
            }
          ],
          payments: [
            {
              id: 1,
              sale_id: 0,
              method: 'cash',
              amount: 15000
            }
          ]
        }
        const html = this.generateThermalGraphicHtml(dummySale, 2010, config)
        return await this.printThermalGraphic(html, config, 'Ticket de Prueba')
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Error en prueba de impresión gráfica.'
        }
      }
    }

    const printerObj = this.createPrinterInstance(customConfig)
    try {
      const { printer, widthChars } = printerObj
      const businessName = this.settingsService.get('business_name', 'MAVE POS') || 'MAVE POS'

      buildThermalTestTicket({
        printer,
        widthChars,
        paperWidth: printerObj.config.paperWidth,
        businessName,
        fontFamily: printerObj.config.thermalFontFamily,
        bodySize: printerObj.config.thermalBodySize,
        headerEmphasis: printerObj.config.thermalHeaderEmphasis,
        itemsLayout: printerObj.config.thermalItemsLayout,
        totalSize: printerObj.config.thermalTotalSize
      })

      const buffer = printer.getBuffer()
      return await this.dispatchThermalBuffer(
        buffer,
        printerObj.config,
        'Ticket de Prueba'
      )
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
    return generateNormalReceiptHtml(saleDetail, this.getBusinessInfo())
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

  /**
   * Prints a cash cut / session closing receipt via thermal printer (graphic or ESC/POS).
   */
  async printCashCutReceipt(
    data: any,
    customConfig?: Partial<PrinterConfig>
  ): Promise<PrintResult> {
    const config = { ...this.getPrinterConfig(), ...customConfig }

    if (!config.thermalInterface) {
      return {
        success: false,
        error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
      }
    }

    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic'

    if (isGraphicMode) {
      try {
        const html = generateThermalCashCutHtml({
          data,
          business: this.getBusinessInfo(),
          paperWidth: config.paperWidth,
          fontFamily: config.thermalSystemFont || 'Segoe UI, sans-serif',
          bodySize: config.thermalBodySize,
          headerEmphasis: config.thermalHeaderEmphasis
        })

        return await this.printThermalGraphic(
          html,
          config,
          `Corte Caja #${data.sessionId}`
        )
      } catch (err: any) {
        console.error('Error imprimiendo comprobante de corte gráfico:', err)
        return {
          success: false,
          error: err.message || 'Error al imprimir comprobante de corte.'
        }
      }
    }

    // Fallback: Impresión nativa ESC/POS RAW
    const printerObj = this.createPrinterInstance(customConfig)
    try {
      buildThermalCashCutReceipt({
        printer: printerObj.printer,
        widthChars: printerObj.widthChars,
        data,
        business: this.getBusinessInfo(),
        fontFamily: printerObj.config.thermalFontFamily,
        bodySize: printerObj.config.thermalBodySize,
        headerEmphasis: printerObj.config.thermalHeaderEmphasis
      })

      const buffer = printerObj.printer.getBuffer()
      return await this.dispatchThermalBuffer(
        buffer,
        printerObj.config,
        `Corte Caja #${data.sessionId}`
      )
    } catch (err: any) {
      console.error('Error imprimiendo comprobante de corte ESC/POS:', err)
      return {
        success: false,
        error: err.message || 'Error de comunicación con la impresora térmica.'
      }
    }
  }
}

