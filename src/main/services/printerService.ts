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
   * Prints a thermal receipt silently via Windows Spooler graphics pipeline.
   * Disables background printing to prevent thermal printhead burn-out / solid black output.
   */
  async printThermalGraphicSilent(
    html: string,
    printerName: string,
    paperWidth: ThermalPaperWidth = '80mm'
  ): Promise<PrintResult> {
    return new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        backgroundColor: '#ffffff',
        webPreferences: { nodeIntegration: false }
      })

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      printWin.webContents.on('did-finish-load', () => {
        // 58mm = 58000 microns, 80mm = 80000 microns
        const widthMicrons = paperWidth === '58mm' ? 58000 : 80000

        printWin.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            color: false,
            printBackground: false,
            margins: { marginType: 'none' },
            pageSize: {
              width: widthMicrons,
              height: 300000 // Largo continuo para rollo térmico
            }
          },
          (success, failureReason) => {
            printWin.close()
            if (!success) {
              resolve({
                success: false,
                error: failureReason || 'Error al enviar a la impresora térmica de Windows.'
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
   * Prints a thermal receipt for a sale.
   * If thermalPrintMode is 'graphic' (default) and interface is a Windows printer,
   * prints silently via graphic renderer and dispatches hybrid cash drawer pulse if needed.
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

    const isWindowsPrinter = config.thermalInterfaceType === 'windows_printer'
    const printerName = config.thermalInterface.replace(/^printer:/i, '').trim()
    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic' && isWindowsPrinter

    if (isGraphicMode) {
      try {
        const html = this.generateThermalGraphicHtml(saleDetail, change, config)
        const printResult = await this.printThermalGraphicSilent(html, printerName, config.paperWidth)

        if (!printResult.success) {
          return printResult
        }

        // Modo Híbrido: Enviar pulso de cajón si está activado
        if (config.openDrawerOnPrint) {
          try {
            await this.openCashDrawer(config)
          } catch (drawerErr) {
            console.warn('Aviso: Ticket impreso pero falló pulso de cajón:', drawerErr)
          }
        }

        return { success: true }
      } catch (err: any) {
        console.error('Error imprimiendo ticket gráfico:', err)
        return {
          success: false,
          error: err.message || 'Error al imprimir ticket térmico.'
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

    const isWindowsPrinter = config.thermalInterfaceType === 'windows_printer'
    const printerName = config.thermalInterface.replace(/^printer:/i, '').trim()
    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic' && isWindowsPrinter

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
        return await this.printThermalGraphicSilent(html, printerName, config.paperWidth)
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

    const isWindowsPrinter = config.thermalInterfaceType === 'windows_printer'
    const printerName = config.thermalInterface.replace(/^printer:/i, '').trim()
    const isGraphicMode = (config.thermalPrintMode ?? 'graphic') === 'graphic' && isWindowsPrinter

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

        const printResult = await this.printThermalGraphicSilent(html, printerName, config.paperWidth)
        return printResult
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

