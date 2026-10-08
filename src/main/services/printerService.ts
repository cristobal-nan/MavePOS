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
  generateNormalReceiptHtml
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
   * Instantiates a configured ThermalPrinter instance in memory.
   */
  createPrinterInstance(customConfig?: Partial<PrinterConfig>): any {
    const config = { ...this.getPrinterConfig(), ...customConfig }
    const printerType = config.thermalType === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON
    const widthChars = config.paperWidth === '58mm' ? 32 : 48

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
      business: this.getBusinessInfo()
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
   * Prints a thermal receipt for a sale.
   */
  async printThermalReceipt(
    saleDetail: SaleDetail,
    change = 0,
    customConfig?: Partial<PrinterConfig>
  ): Promise<PrintResult> {
    const printerObj = this.createPrinterInstance(customConfig)

    if (!printerObj.config.thermalInterface) {
      return {
        success: false,
        error: 'No se ha configurado ninguna impresora térmica de destino en Configuración.'
      }
    }

    try {
      this.buildReceiptCommands(printerObj, saleDetail, change)
      const buffer = printerObj.printer.getBuffer()
      return await this.dispatchThermalBuffer(
        buffer,
        printerObj.config,
        `Venta #${saleDetail.folio ?? saleDetail.id}`
      )
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
    const printerObj = this.createPrinterInstance(customConfig)

    if (!printerObj.config.thermalInterface) {
      return {
        success: false,
        error: 'Por favor selecciona una impresora térmica antes de realizar la prueba.'
      }
    }

    try {
      const { printer, widthChars } = printerObj
      const businessName = this.settingsService.get('business_name', 'MAVE POS') || 'MAVE POS'

      buildThermalTestTicket({
        printer,
        widthChars,
        paperWidth: printerObj.config.paperWidth,
        businessName
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
}
