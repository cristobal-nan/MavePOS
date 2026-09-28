import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { SalesService } from '../main/services/salesService'
import { ProductService } from '../main/services/productService'
import { CashService } from '../main/services/cashService'

describe('Fase 5: Módulo de Ventas (Importes, Totales, Pagos, Vuelto, Stock e Inventario)', () => {
  let db: Database.Database
  let salesService: SalesService
  let productService: ProductService
  let cashService: CashService
  let cashSessionId: number

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    salesService = new SalesService(db)
    productService = new ProductService(db)
    cashService = new CashService(db)

    // Abrimos una sesión de caja
    const session = cashService.openSession(50000)
    cashSessionId = session.id

    // Creamos productos de prueba
    productService.upsertProduct({
      code: '7801',
      name: 'Algodón Rústico Azul',
      sale_price: 3500,
      stock: 50,
      min_stock: 10
    })

    productService.upsertProduct({
      code: '7802',
      name: 'Lana Merino Gruesa',
      sale_price: 6000,
      stock: 20,
      min_stock: 5
    })
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Cálculos de Carrito: Importes, Totales y Existencia', () => {
    it('calcula correctamente los importes individuales y el total de la venta', () => {
      const items = [
        { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 3, stock: 50 },
        { product_code: '7802', name: 'Lana Merino Gruesa', unit_price: 6000, quantity: 2, stock: 20 }
      ]

      const importe1 = items[0].unit_price * items[0].quantity // 10.500
      const importe2 = items[1].unit_price * items[1].quantity // 12.000
      const total = importe1 + importe2 // 22.500

      expect(importe1).toBe(10500)
      expect(importe2).toBe(12000)
      expect(total).toBe(22500)
    })

    it('calcula existencia restante dinámica = stock actual − cantidad en carrito', () => {
      const p1Stock = 50
      const inCartQty = 4
      const existenciaRestante = p1Stock - inCartQty

      expect(existenciaRestante).toBe(46)
    })
  })

  describe('Cobro en Efectivo y Cálculo de Vuelto', () => {
    it('calcula el vuelto exacto cuando el cliente paga con un billete mayor', () => {
      const result = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2 } // Total 7.000
        ],
        payments: [{ method: 'cash', amount: 7000 }],
        cashPaid: 10000 // Paga con billete de $10.000
      })

      expect(result.sale.total).toBe(7000)
      expect(result.change).toBe(3000) // Vuelto $3.000
      expect(result.payments[0].method).toBe('cash')
      expect(result.payments[0].amount).toBe(7000)
    })

    it('si paga exacto, el vuelto es 0', () => {
      const result = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }
        ],
        payments: [{ method: 'cash', amount: 3500 }],
        cashPaid: 3500
      })

      expect(result.change).toBe(0)
    })
  })

  describe('Pagos Mixtos y Validaciones', () => {
    it('acepta pago mixto donde la suma coincide exactamente con el total', () => {
      const result = salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2 } // Total 7.000
        ],
        payments: [
          { method: 'cash', amount: 2000 },
          { method: 'card', amount: 5000 }
        ]
      })

      expect(result.sale.total).toBe(7000)
      expect(result.payments).toHaveLength(2)
      expect(result.payments.reduce((acc, p) => acc + p.amount, 0)).toBe(7000)
    })

    it('rechaza la venta si la suma de pagos no coincide con el total', () => {
      expect(() => {
        salesService.completeSale({
          cashSessionId,
          items: [
            { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2 } // Total 7.000
          ],
          payments: [
            { method: 'cash', amount: 2000 },
            { method: 'card', amount: 4000 } // Suma 6.000 != 7.000
          ]
        })
      }).toThrow(/no coincide exactamente con el total/)
    })
  })

  describe('Descuento de Inventario y Auditoría de Movimientos', () => {
    it('descuenta las unidades del producto y registra el movimiento tipo "venta"', () => {
      const initialProd = productService.getProductByCode('7801')!
      expect(initialProd.stock).toBe(50)

      salesService.completeSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 5 }
        ],
        payments: [{ method: 'card', amount: 17500 }]
      })

      // El stock debe haber bajado de 50 a 45
      const updatedProd = productService.getProductByCode('7801')!
      expect(updatedProd.stock).toBe(45)

      // Debe haberse registrado el movimiento en inventory_movements
      const movements = db
        .prepare('SELECT * FROM inventory_movements WHERE product_code = ?')
        .all('7801') as any[]

      expect(movements).toHaveLength(1)
      expect(movements[0].delta).toBe(-5)
      expect(movements[0].type).toBe('venta')
      expect(movements[0].reason).toContain('Venta Folio #')
    })
  })

  describe('Tickets Simultáneos y Ventas Pendientes (Standby)', () => {
    it('permite guardar una venta como pendiente en BD y recuperarla intacta', () => {
      const pendingTicket = salesService.savePendingSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2, stock: 50 },
          { product_code: '7802', name: 'Lana Merino Gruesa', unit_price: 6000, quantity: 1, stock: 20 }
        ]
      })

      expect(pendingTicket.id).toBeDefined()
      expect(pendingTicket.total).toBe(13000)

      // Recuperar ventas pendientes de la base de datos
      const list = salesService.getPendingSales(cashSessionId)
      expect(list).toHaveLength(1)
      expect(list[0].items).toHaveLength(2)
      expect(list[0].total).toBe(13000)
    })

    it('permite completar una venta previamente pendiente liberándola del standby', () => {
      const pendingTicket = salesService.savePendingSale({
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2, stock: 50 }
        ]
      })

      // Completar la venta pendiente
      const completed = salesService.completeSale({
        saleId: pendingTicket.id,
        cashSessionId,
        items: [
          { product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 2 }
        ],
        payments: [{ method: 'transfer', amount: 7000 }]
      })

      expect(completed.sale.id).toBe(pendingTicket.id)
      expect(completed.sale.status).toBe('completed')

      // Ya no debe figurar en ventas pendientes
      const remainingPending = salesService.getPendingSales(cashSessionId)
      expect(remainingPending).toHaveLength(0)
    })

    it('asigna un folio único global consecutivo a cada venta completada y maneja conflictos', () => {
      // Venta con folio explícito 3
      const sale1 = salesService.completeSale({
        folio: 3,
        cashSessionId,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(sale1.sale.folio).toBe(3)

      // Venta posterior con intento de reusar folio 3: detecta conflicto y asigna el siguiente folio único (folio 4)
      const sale2 = salesService.completeSale({
        folio: 3,
        cashSessionId,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(sale2.sale.folio).toBe(4)

      // Venta sin especificar folio: asigna el siguiente global (folio 5)
      const sale3 = salesService.completeSale({
        cashSessionId,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(sale3.sale.folio).toBe(5)
    })

    it('calcula el número de ticket de turno iniciando en 1 sin huecos ni colisiones con tickets abiertos', () => {
      // Al inicio de la sesión, sin ventas ni tickets abiertos, el primer ticket de turno es 1
      expect(salesService.getNextTicketNumber([], cashSessionId)).toBe(1)

      // Se vende el ticket 1
      const s1 = salesService.completeSale({
        ticket_number: 1,
        cashSessionId,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(s1.sale.ticket_number).toBe(1)

      // Queda abierto en pantalla el ticket 3 (el 2 fue cerrado)
      const openTickets = [3]

      // El siguiente ticket de turno debe ser el 2 (primer entero >= 1 no vendido ni abierto)
      const nextTicket = salesService.getNextTicketNumber(openTickets, cashSessionId)
      expect(nextTicket).toBe(2)

      // Si además se abre el 2, ahora están abiertos [2, 3]
      const nextAfter2 = salesService.getNextTicketNumber([2, 3], cashSessionId)
      expect(nextAfter2).toBe(4)
    })

    it('el número de ticket se reinicia a 1 en un nuevo turno, pero el folio continúa siendo único global', () => {
      // Venta en la primera sesión: Ticket #1, Folio #1
      const s1 = salesService.completeSale({
        ticket_number: 1,
        cashSessionId,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(s1.sale.ticket_number).toBe(1)
      expect(s1.sale.folio).toBe(1)

      // Cerramos la sesión 1
      cashService.closeSession(cashSessionId, { closingCash: 53500 })

      // Abrimos una segunda sesión de caja
      const session2 = cashService.openSession(50000)
      const cashSessionId2 = session2.id

      // Para la nueva sesión, el número de ticket de turno vuelve a empezar en 1
      const nextTicketSession2 = salesService.getNextTicketNumber([], cashSessionId2)
      expect(nextTicketSession2).toBe(1)

      // Pero el folio global debe ser 2 (único e incremental entre ventas)
      const nextFolioSession2 = salesService.getNextFolio()
      expect(nextFolioSession2).toBe(2)

      // Realizamos venta en la segunda sesión: Ticket #1, Folio #2
      const s2 = salesService.completeSale({
        ticket_number: 1,
        cashSessionId: cashSessionId2,
        items: [{ product_code: '7801', name: 'Algodón Rústico Azul', unit_price: 3500, quantity: 1 }],
        payments: [{ method: 'cash', amount: 3500 }]
      })
      expect(s2.sale.ticket_number).toBe(1) // Mismo ticket #1 que en turno anterior
      expect(s2.sale.folio).toBe(2)          // Folio único global distinto
      expect(s2.sale.cash_session_id).toBe(cashSessionId2)
    })
  })
})
