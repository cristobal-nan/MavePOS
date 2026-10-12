import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SettingsService } from '../main/services/settingsService'
import { PrinterService } from '../main/services/printerService'
import { generateNormalReceiptHtml as generateHtmlPure, sanitizeForThermalEscPos } from '../main/services/printing/ticketTemplates'
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
      expect(config.thermalFontFamily).toBe('font_a')
      expect(config.thermalBodySize).toBe('normal')
      expect(config.thermalHeaderEmphasis).toBe('double')
      expect(config.thermalPrintMode).toBe('graphic')
      expect(config.thermalItemsLayout).toBe('2_cols')
      expect(config.thermalTotalSize).toBe('double')
      expect(config.thermalSystemFont).toBe('Segoe UI, sans-serif')
    })

    it('guarda y recupera parámetros de configuración de impresora térmica y cajón', () => {
      printerService.savePrinterConfig({
        thermalType: 'star',
        thermalInterfaceType: 'tcp',
        thermalInterface: 'tcp://192.168.1.150:9100',
        paperWidth: '58mm',
        openDrawerOnPrint: false,
        autoPrintOnSale: true,
        normalPrinterName: 'HP LaserJet Pro',
        thermalFontFamily: 'font_b',
        thermalBodySize: 'compact',
        thermalHeaderEmphasis: 'normal',
        thermalPrintMode: 'raw_escpos',
        thermalItemsLayout: '4_cols',
        thermalTotalSize: 'normal',
        thermalSystemFont: 'Consolas, monospace'
      })

      const config = printerService.getPrinterConfig()

      expect(config.thermalType).toBe('star')
      expect(config.thermalInterfaceType).toBe('tcp')
      expect(config.thermalInterface).toBe('tcp://192.168.1.150:9100')
      expect(config.paperWidth).toBe('58mm')
      expect(config.openDrawerOnPrint).toBe(false)
      expect(config.autoPrintOnSale).toBe(true)
      expect(config.normalPrinterName).toBe('HP LaserJet Pro')
      expect(config.thermalFontFamily).toBe('font_b')
      expect(config.thermalBodySize).toBe('compact')
      expect(config.thermalHeaderEmphasis).toBe('normal')
      expect(config.thermalPrintMode).toBe('raw_escpos')
      expect(config.thermalItemsLayout).toBe('4_cols')
      expect(config.thermalTotalSize).toBe('normal')
      expect(config.thermalSystemFont).toBe('Consolas, monospace')
    })
  })

  describe('Instanciación y Ancho de Columnas (createPrinterInstance)', () => {
    it('configura 48 columnas para papel térmico de 80mm en Fuente A', () => {
      const { widthChars, config } = printerService.createPrinterInstance({
        paperWidth: '80mm',
        thermalFontFamily: 'font_a'
      })
      expect(widthChars).toBe(48)
      expect(config.paperWidth).toBe('80mm')
      expect(config.thermalFontFamily).toBe('font_a')
    })

    it('configura 32 columnas para papel térmico de 58mm en Fuente A', () => {
      const { widthChars, config } = printerService.createPrinterInstance({
        paperWidth: '58mm',
        thermalFontFamily: 'font_a'
      })
      expect(widthChars).toBe(32)
      expect(config.paperWidth).toBe('58mm')
    })

    it('configura 56 columnas para papel térmico de 80mm en Fuente B (Condensada)', () => {
      const { widthChars, config } = printerService.createPrinterInstance({
        paperWidth: '80mm',
        thermalFontFamily: 'font_b'
      })
      expect(widthChars).toBe(56)
      expect(config.paperWidth).toBe('80mm')
      expect(config.thermalFontFamily).toBe('font_b')
    })

    it('configura 42 columnas para papel térmico de 58mm en Fuente B (Condensada)', () => {
      const { widthChars, config } = printerService.createPrinterInstance({
        paperWidth: '58mm',
        thermalFontFamily: 'font_b'
      })
      expect(widthChars).toBe(42)
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

  describe('Sanitización para Impresión Térmica ESC/POS (sanitizeForThermalEscPos)', () => {
    it('elimina signos de apertura ¡ y ¿ y reemplaza tildes por letras ASCII estándar', () => {
      const input = '¡Gracias por su compra! Café molido, té de jazmín y azúcar rubia.'
      const result = sanitizeForThermalEscPos(input)

      expect(result).toBe('Gracias por su compra! Cafe molido, te de jazmin y azucar rubia.')
      expect(result).not.toContain('¡')
      expect(result).not.toContain('á')
      expect(result).not.toContain('é')
      expect(result).not.toContain('í')
      expect(result).not.toContain('ú')
    })

    it('convierte eñes a enes y normaliza comillas, guiones y puntos suspensivos', () => {
      const input = '“Lana Española” — N° 5 … Niño & Niña'
      const result = sanitizeForThermalEscPos(input)

      expect(result).toBe('"Lana Espanola" - N 5 ... Nino & Nina')
      expect(result).not.toContain('ñ')
      expect(result).not.toContain('Ñ')
      expect(result).not.toContain('“')
      expect(result).not.toContain('”')
      expect(result).not.toContain('—')
      expect(result).not.toContain('…')
    })

    it('reemplaza espacios de no separación (U+00A0 de fechas es-CL) y garantiza caracteres estrictamente ASCII', () => {
      // Fecha con narrow no-break space común en toLocaleString('es-CL')
      const inputWithNBSP = '11-10-2026, 8:32:36 p.\u00A0m.'
      const result = sanitizeForThermalEscPos(inputWithNBSP)

      expect(result).toBe('11-10-2026, 8:32:36 p. m.')

      // Verificar que ningún carácter tiene código > 127
      for (let i = 0; i < result.length; i++) {
        expect(result.charCodeAt(i)).toBeLessThanOrEqual(127)
      }
    })

    it('limpia cualquier carácter diacrítico o Unicode no mapeado garantizando salida 100% segura para impresoras OEM', () => {
      const input = '¡Atención! 100% Calidad — Óptimo & Éxito ★★★'
      const result = sanitizeForThermalEscPos(input)

      for (let i = 0; i < result.length; i++) {
        const code = result.charCodeAt(i)
        expect(code).toBeGreaterThanOrEqual(32)
        expect(code).toBeLessThanOrEqual(126)
      }
      expect(result).toContain('Atencion! 100% Calidad - Optimo & Exito')
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

  describe('Renderizado Gráfico Silencioso de Ticket Térmico (generateThermalGraphicHtml)', () => {
    it('genera HTML con la tipografía del sistema, folio, totales y productos', () => {
      settingsService.set('business_name', 'Mave Punto de Venta')
      settingsService.set('business_rut', '77.111.222-3')

      const mockSaleDetail: SaleDetail = {
        id: 12,
        folio: 204,
        ticket_number: 5,
        status: 'completed',
        total: 10500,
        cash_session_id: 1,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        total_items: 2,
        returned_items_count: 0,
        items: [
          {
            id: 1,
            sale_id: 12,
            product_code: 'LANA-ROJA',
            name: 'Lana Roja 100g',
            quantity: 2,
            returned_qty: 0,
            unit_price: 5250
          }
        ],
        payments: [
          {
            id: 1,
            sale_id: 12,
            method: 'cash',
            amount: 15000
          }
        ]
      }

      const html = printerService.generateThermalGraphicHtml(mockSaleDetail, 4500, {
        thermalSystemFont: 'Consolas, monospace',
        thermalItemsLayout: '4_cols',
        thermalTotalSize: 'double',
        paperWidth: '80mm'
      })

      expect(html).toContain('Mave Punto de Venta')
      expect(html).toContain('77.111.222-3')
      expect(html).toContain('FOLIO: #204')
      expect(html).toContain('Turno: #5')
      expect(html).toContain('Consolas, monospace')
      expect(html).toContain('Lana Roja 100g')
      expect(html).toContain('$ 10.500')
      expect(html).toContain('width: 80mm !important')
      expect(html).toContain('padding-left: 0 !important')
      expect(html).toContain('padding-right: 0 !important')
      expect(html).toContain('margin: 0 !important')
    })
  })

  describe('Comprobante Térmico de Corte de Caja (printCashCutReceipt)', () => {
    const mockCashCutData = {
      sessionId: 8,
      openedAt: '2026-10-11T09:00:00.000Z',
      closedAt: '2026-10-11T19:00:00.000Z',
      openingFund: 50000,
      salesCash: 120000,
      salesCard: 85000,
      salesTransfer: 35000,
      salesTotal: 240000,
      returnsTotal: 5000,
      withdrawalsTotal: 20000,
      closingCash: 145000,
      expectedCash: 145000,
      difference: 0,
      withdrawalAmount: 95000,
      nextOpeningFund: 50000,
      notes: 'Turno sin novedades'
    }

    it('retorna error explicativo si no se ha configurado interfaz térmica', async () => {
      const res = await printerService.printCashCutReceipt(mockCashCutData, { thermalInterface: '' })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/No se ha configurado ninguna impresora térmica/)
    })

    it('genera HTML con el desglose exacto de caja, fondos, diferencias y notas', async () => {
      settingsService.set('business_name', 'Mave Textiles')
      settingsService.set('business_rut', '76.543.210-K')

      const { generateThermalCashCutHtml } = await import('../main/services/printing/ticketTemplates')
      const html = generateThermalCashCutHtml({
        data: mockCashCutData,
        business: printerService.getBusinessInfo(),
        paperWidth: '80mm',
        fontFamily: 'Segoe UI, sans-serif'
      })

      expect(html).toContain('Mave Textiles')
      expect(html).toContain('76.543.210-K')
      expect(html).toContain('CORTE DE CAJA / CIERRE DE TURNO')
      expect(html).toContain('Sesión #8')
      expect(html).toContain('Fondo Inicial:')
      expect(html).toContain('$ 50.000')
      expect(html).toContain('Ventas Efectivo:')
      expect(html).toContain('+$ 120.000')
      expect(html).toContain('TOTAL VENTAS:')
      expect(html).toContain('$ 240.000')
      expect(html).toContain('EFECTIVO CONTADO:')
      expect(html).toContain('$ 145.000')
      expect(html).toContain('Efectivo Esperado:')
      expect(html).toContain('Diferencia:')
      expect(html).toContain('$ 0')
      expect(html).toContain('Monto Retirado:')
      expect(html).toContain('$ 95.000')
      expect(html).toContain('Fondo Sig. Turno:')
      expect(html).toContain('Turno sin novedades')
      expect(html).toContain('background-color: #ffffff !important')
      expect(html).not.toContain('background-color: transparent')
    })
  })

  describe('Enrutamiento y Renderizado de Modo Gráfico (printThermalGraphic)', () => {
    it('enruta a renderizado raster ESC/POS para impresoras térmicas físicas', async () => {
      let rasterCalled = false
      let dispatchCalled = false

      printerService.renderHtmlToThermalRasterBuffer = async () => {
        rasterCalled = true
        return Buffer.from([0x1d, 0x76, 0x30, 0x00])
      }

      printerService.dispatchThermalBuffer = async (_buf, _cfg, title) => {
        dispatchCalled = true
        expect(title).toBe('Venta #100')
        return { success: true }
      }

      const res = await printerService.printThermalGraphic(
        '<html><body>Test</body></html>',
        {
          thermalInterface: 'printer:POS-80',
          paperWidth: '80mm'
        } as any,
        'Venta #100'
      )

      expect(res.success).toBe(true)
      expect(rasterCalled).toBe(true)
      expect(dispatchCalled).toBe(true)
    })

    it('enruta a Chromium Spooler para impresoras virtuales como Microsoft Print to PDF', async () => {
      let spoolerCalled = false

      printerService.printThermalGraphicViaChromiumSpooler = async (_html, name, _pw) => {
        spoolerCalled = true
        expect(name).toContain('PDF')
        return { success: true }
      }

      const res = await printerService.printThermalGraphic(
        '<html><body>Test</body></html>',
        {
          thermalInterface: 'printer:Microsoft Print to PDF',
          paperWidth: '80mm'
        } as any,
        'Prueba Virtual'
      )

      expect(res.success).toBe(true)
      expect(spoolerCalled).toBe(true)
    })
  })
})

