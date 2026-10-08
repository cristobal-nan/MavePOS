import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SettingsService } from '../main/services/settingsService'
import { PrinterService } from '../main/services/printerService'
import { generateNormalReceiptHtml as generateHtmlPure } from '../main/services/printing/ticketTemplates'
import { CASH_DRAWER_PULSE_BUFFER, getRawPrintExePath } from '../main/services/printing/rawPrinterHelper'
import { SaleDetail } from '../shared/types'

describe('Fase 9: Impresión y Tickets Térmicos (ESC/POS y Periféricos)', () => {
  let db: Database.Database
  let settingsService: SettingsService
  let printerService: PrinterService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    settingsService = new SettingsService(db)
    printerService = new PrinterService(db, settingsService)
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Configuración de Impresoras (getPrinterConfig & savePrinterConfig)', () => {
    it('retorna la configuración predeterminada cuando no se ha guardado nada', () => {
      const config = printerService.getPrinterConfig()

      expect(config.thermalType).toBe('epson')
      expect(config.thermalInterfaceType).toBe('windows_printer')
      expect(config.thermalInterface).toBe('')
      expect(config.paperWidth).toBe('80mm')
      expect(config.openDrawerOnPrint).toBe(true)
      expect(config.autoPrintOnSale).toBe(false)
      expect(config.normalPrinterName).toBeUndefined()
    })

    it('guarda y recupera parámetros de configuración de impresora térmica y cajón', () => {
      printerService.savePrinterConfig({
        thermalType: 'star',
        thermalInterfaceType: 'tcp',
        thermalInterface: 'tcp://192.168.1.150:9100',
        paperWidth: '58mm',
        openDrawerOnPrint: false,
        autoPrintOnSale: true,
        normalPrinterName: 'HP LaserJet Pro'
      })

      const config = printerService.getPrinterConfig()

      expect(config.thermalType).toBe('star')
      expect(config.thermalInterfaceType).toBe('tcp')
      expect(config.thermalInterface).toBe('tcp://192.168.1.150:9100')
      expect(config.paperWidth).toBe('58mm')
      expect(config.openDrawerOnPrint).toBe(false)
      expect(config.autoPrintOnSale).toBe(true)
      expect(config.normalPrinterName).toBe('HP LaserJet Pro')
    })
  })

  describe('Instanciación y Ancho de Columnas (createPrinterInstance)', () => {
    it('configura 48 columnas para papel térmico de 80mm', () => {
      const { widthChars, config } = printerService.createPrinterInstance({ paperWidth: '80mm' })
      expect(widthChars).toBe(48)
      expect(config.paperWidth).toBe('80mm')
    })

    it('configura 32 columnas para papel térmico de 58mm', () => {
      const { widthChars, config } = printerService.createPrinterInstance({ paperWidth: '58mm' })
      expect(widthChars).toBe(32)
      expect(config.paperWidth).toBe('58mm')
    })
  })

  describe('Construcción de Comandos ESC/POS de Ticket (buildReceiptCommands)', () => {
    it('genera los comandos de cabecera, productos, totales, vuelto y corte de papel', () => {
      // Datos del negocio en settings
      settingsService.set('business_name', 'Lanas & Tejidos Mave')
      settingsService.set('business_rut', '76.999.888-K')
      settingsService.set('ticket_footer_message', '¡Gracias por su compra!')

      const printerObj = printerService.createPrinterInstance({
        paperWidth: '80mm',
        openDrawerOnPrint: true
      })

      const mockSaleDetail: SaleDetail = {
        id: 1,
        folio: 105,
        ticket_number: 3,
        status: 'completed',
        total: 12500,
        cash_session_id: 1,
        created_at: '2026-09-28T14:30:00.000Z',
        completed_at: '2026-09-28T14:30:00.000Z',
        items: [
          {
            id: 1,
            sale_id: 1,
            product_code: 'LANA-01',
            name: 'Lana Merino Extrafina',
            unit_price: 5000,
            quantity: 2,
            returned_qty: 0
          },
          {
            id: 2,
            sale_id: 1,
            product_code: 'ACC-01',
            name: 'Crochet Aluminio 4mm',
            unit_price: 2500,
            quantity: 1,
            returned_qty: 0
          }
        ],
        payments: [{ id: 1, sale_id: 1, method: 'cash', amount: 12500 }],
        total_items: 3,
        returned_items_count: 0
      }

      // No debe lanzar errores durante la construcción del buffer
      expect(() => {
        printerService.buildReceiptCommands(printerObj, mockSaleDetail, 7500)
      }).not.toThrow()

      const buffer = printerObj.printer.getBuffer()
      expect(buffer).toBeDefined()
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  describe('Generación de HTML para Impresión Normal de Windows (generateNormalReceiptHtml)', () => {
    it('produce un documento HTML completo con tabla de ítems y datos fiscales', () => {
      settingsService.set('business_name', 'Mave POS Store')
      settingsService.set('business_rut', '12.345.678-9')

      const mockSaleDetail: SaleDetail = {
        id: 2,
        folio: 200,
        ticket_number: 1,
        status: 'completed',
        total: 8000,
        cash_session_id: 1,
        created_at: '2026-09-28T16:00:00.000Z',
        completed_at: '2026-09-28T16:00:00.000Z',
        items: [
          {
            id: 1,
            sale_id: 2,
            product_code: 'HILO-01',
            name: 'Hilo Mercerizado Azul',
            unit_price: 4000,
            quantity: 2,
            returned_qty: 0
          }
        ],
        payments: [{ id: 1, sale_id: 2, method: 'card', amount: 8000 }],
        total_items: 2,
        returned_items_count: 0
      }

      const html = printerService.generateNormalReceiptHtml(mockSaleDetail)

      expect(html).toContain('Mave POS Store')
      expect(html).toContain('12.345.678-9')
      expect(html).toContain('FOLIO: #200')
      expect(html).toContain('HILO-01')
      expect(html).toContain('Hilo Mercerizado Azul')
      expect(html).toContain('$ 8.000')
    })
  })

  describe('Control de Errores y Diagnóstico de Conexión', () => {
    it('retorna error explicativo si no se ha configurado interfaz al imprimir ticket', async () => {
      const mockSaleDetail: SaleDetail = {
        id: 1,
        folio: 1,
        status: 'completed',
        total: 1000,
        cash_session_id: 1,
        created_at: '2026-09-28T12:00:00.000Z',
        completed_at: '2026-09-28T12:00:00.000Z',
        items: [],
        payments: [],
        total_items: 0,
        returned_items_count: 0
      }

      const res = await printerService.printThermalReceipt(mockSaleDetail, 0, { thermalInterface: '' })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/No se ha configurado ninguna impresora térmica/)
    })

    it('retorna error explicativo si se intenta abrir cajón sin interfaz configurada', async () => {
      const res = await printerService.openCashDrawer({ thermalInterface: '' })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/No se ha configurado la interfaz de la impresora/)
    })

    it('retorna error explicativo en test de ticket sin impresora seleccionada', async () => {
      const res = await printerService.printTestTicket({ thermalInterface: '' })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Por favor selecciona una impresora térmica/)
    })
  })

  describe('Módulo Puro de Plantillas de Comprobantes (ticketTemplates.ts)', () => {
    it('genera HTML con los datos de negocio proporcionados independientemente del hardware', () => {
      const mockSaleDetail: SaleDetail = {
        id: 99,
        folio: 501,
        ticket_number: 12,
        status: 'completed',
        total: 15990,
        cash_session_id: 2,
        created_at: '2026-09-29T10:00:00.000Z',
        completed_at: '2026-09-29T10:00:00.000Z',
        items: [
          {
            id: 10,
            sale_id: 99,
            product_code: 'LANA-ROJA',
            name: 'Lana Merino Roja',
            unit_price: 7995,
            quantity: 2,
            returned_qty: 0
          }
        ],
        payments: [{ id: 5, sale_id: 99, method: 'cash', amount: 15990 }],
        total_items: 2,
        returned_items_count: 0
      }

      const businessInfo = {
        name: 'Tienda Creativa Mave',
        rut: '77.111.222-3',
        address: 'Av. Providencia 1234',
        phone: '+56 9 8765 4321',
        footerMessage: 'Gracias por preferir nuestro trabajo hecho a mano'
      }

      const html = generateHtmlPure(mockSaleDetail, businessInfo)
      expect(html).toContain('Tienda Creativa Mave')
      expect(html).toContain('77.111.222-3')
      expect(html).toContain('Av. Providencia 1234')
      expect(html).toContain('Gracias por preferir nuestro trabajo hecho a mano')
      expect(html).toContain('$ 15.990')
      expect(html).toContain('Lana Merino Roja')
    })
  })

  describe('Control de Spooler RAW y Pulso Universal de Cajón (rawPrinterHelper)', () => {
    it('el buffer universal de pulso contiene las secuencias estándar ESC/POS y Star', () => {
      expect(CASH_DRAWER_PULSE_BUFFER).toBeDefined()
      const hex = CASH_DRAWER_PULSE_BUFFER.toString('hex')
      // Pin 2 (1b 70 00 19 fa)
      expect(hex).toContain('1b700019fa')
      // Pin 5 (1b 70 01 19 fa)
      expect(hex).toContain('1b700119fa')
      // Star BEL (07)
      expect(hex).toContain('07')
    })

    it('localiza el binario nativo winrawprint.exe en la estructura del proyecto', () => {
      const exePath = getRawPrintExePath()
      expect(exePath).not.toBeNull()
      expect(exePath).toContain('winrawprint.exe')
    })

    it('la emisión de ticket incluye el pulso de cajón y corte de papel en el buffer binario', () => {
      const printerObj = printerService.createPrinterInstance({
        paperWidth: '80mm',
        openDrawerOnPrint: true
      })

      const mockSaleDetail: SaleDetail = {
        id: 10,
        folio: 10,
        status: 'completed',
        total: 5000,
        cash_session_id: 1,
        created_at: new Date().toISOString(),
        items: [],
        payments: [],
        total_items: 0,
        returned_items_count: 0
      }

      printerService.buildReceiptCommands(printerObj, mockSaleDetail)
      const buffer = printerObj.printer.getBuffer()
      const hex = buffer.toString('hex')

      // Debe contener el pulso de apertura
      expect(hex).toContain('1b700019fa')
      // Debe contener el corte de papel (1d 56 00)
      expect(hex).toContain('1d5600')
    })
  })
})
