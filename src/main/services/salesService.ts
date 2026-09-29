import Database from 'better-sqlite3'
import {
  CartItem,
  CompleteSaleInput,
  CompletedSaleResult,
  PendingTicket,
  Sale,
  SaleItem,
  SalePayment,
  SaleDetail,
  SalesHistoryFilter
} from '../../shared/types'
import { calculateCartTotal } from '../../shared/finance'

export class SalesService {
  constructor(private db: Database.Database) {}

  getNextFolio(): number {
    const row = this.db
      .prepare('SELECT MAX(folio) as maxFolio FROM sales WHERE folio IS NOT NULL')
      .get() as { maxFolio: number | null } | undefined
    return row && typeof row.maxFolio === 'number' ? row.maxFolio + 1 : 1
  }

  getNextTicketNumber(openTickets: number[] = [], cashSessionId?: number | null): number {
    let sessionId = cashSessionId
    if (sessionId === undefined || sessionId === null) {
      const openSession = this.db
        .prepare('SELECT id FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')
        .get() as { id: number } | undefined
      sessionId = openSession ? openSession.id : null
    }

    const rows =
      sessionId !== null
        ? (this.db.prepare('SELECT ticket_number FROM sales WHERE cash_session_id = ?').all(sessionId) as { ticket_number: number }[])
        : (this.db.prepare('SELECT ticket_number FROM sales WHERE cash_session_id IS NULL').all() as { ticket_number: number }[])

    const usedSet = new Set<number>()
    for (const r of rows) {
      if (typeof r.ticket_number === 'number') {
        usedSet.add(r.ticket_number)
      }
    }
    for (const t of openTickets) {
      if (typeof t === 'number') {
        usedSet.add(t)
      }
    }

    let candidate = 1
    while (usedSet.has(candidate)) {
      candidate++
    }
    return candidate
  }

  getPendingSales(cashSessionId?: number): PendingTicket[] {
    const where = cashSessionId ? 'WHERE status = ? AND cash_session_id = ?' : 'WHERE status = ?'
    const params = cashSessionId ? ['pending', cashSessionId] : ['pending']

    const sales = this.db
      .prepare(`SELECT * FROM sales ${where} ORDER BY id ASC`)
      .all(...params) as (Sale & { ticket_number: number })[]

    const getItems = this.db.prepare(`
      SELECT
        si.product_code,
        si.name,
        si.unit_price,
        si.quantity,
        COALESCE(p.stock, 0) as stock,
        p.attribute_value as variant_label
      FROM sale_items si
      LEFT JOIN products p ON si.product_code = p.code
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `)

    return sales.map((sale) => {
      const items = getItems.all(sale.id) as CartItem[]
      return {
        id: sale.id,
        folio: sale.folio,
        ticket_number: typeof sale.ticket_number === 'number' ? sale.ticket_number : 0,
        total: sale.total,
        created_at: sale.created_at,
        items
      }
    })
  }

  savePendingSale(data: { id?: number; ticket_number?: number; cashSessionId: number | null; items: CartItem[] }): PendingTicket {
    const { totalAmount: total } = calculateCartTotal(data.items)
    const now = new Date().toISOString()

    const tx = this.db.transaction(() => {
      let saleId: number
      let ticketNumber: number

      if (data.id) {
        saleId = data.id
        const existing = this.db.prepare('SELECT ticket_number FROM sales WHERE id = ?').get(saleId) as { ticket_number: number } | undefined
        ticketNumber =
          existing && typeof existing.ticket_number === 'number'
            ? existing.ticket_number
            : (typeof data.ticket_number === 'number' ? data.ticket_number : this.getNextTicketNumber([], data.cashSessionId))

        this.db
          .prepare('UPDATE sales SET total = ?, ticket_number = ?, cash_session_id = ? WHERE id = ?')
          .run(total, ticketNumber, data.cashSessionId, saleId)

        // Delete old items
        this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
      } else {
        ticketNumber =
          typeof data.ticket_number === 'number'
            ? data.ticket_number
            : this.getNextTicketNumber([], data.cashSessionId)

        const res = this.db
          .prepare('INSERT INTO sales (folio, ticket_number, status, total, cash_session_id, created_at, completed_at) VALUES (NULL, ?, ?, ?, ?, ?, NULL)')
          .run(ticketNumber, 'pending', total, data.cashSessionId, now)
        saleId = Number(res.lastInsertRowid)
      }

      // Insert new items
      const insertItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, product_code, name, unit_price, quantity, returned_qty)
        VALUES (?, ?, ?, ?, ?, 0)
      `)

      for (const item of data.items) {
        insertItem.run(saleId, item.product_code, item.name, item.unit_price, item.quantity)
      }

      return {
        id: saleId,
        ticket_number: ticketNumber,
        total,
        created_at: now,
        items: data.items
      }
    })

    return tx()
  }

  deletePendingSale(saleId: number): boolean {
    const tx = this.db.transaction(() => {
      const sale = this.db.prepare('SELECT status FROM sales WHERE id = ?').get(saleId) as { status: string } | undefined
      if (!sale) return false
      if (sale.status !== 'pending') {
        throw new Error('Solo se pueden eliminar tickets con estado pendiente')
      }

      this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
      this.db.prepare('DELETE FROM sales WHERE id = ?').run(saleId)
      return true
    })

    return tx()
  }

  completeSale(input: CompleteSaleInput): CompletedSaleResult {
    if (!input.items || input.items.length === 0) {
      throw new Error('La venta debe contener al menos un producto')
    }

    const { totalAmount: total } = calculateCartTotal(input.items)
    const totalPayments = input.payments.reduce((acc, p) => acc + Math.round(p.amount), 0)

    const isExchange = !!input.exchangeInfo
    const exchangeCredit = isExchange ? Math.round(input.exchangeInfo!.exchangeCredit) : 0
    const differenceToPay = isExchange ? Math.max(0, total - exchangeCredit) : total

    if (isExchange && total < exchangeCredit) {
      throw new Error(`El valor de los nuevos productos ($ ${total}) debe ser igual o superior al crédito por cambio ($ ${exchangeCredit})`)
    }

    if (totalPayments !== differenceToPay) {
      throw new Error(`El monto pagado ($ ${totalPayments}) no coincide exactamente con el total requerido ($ ${differenceToPay})`)
    }

    const now = new Date().toISOString()

    const tx = this.db.transaction(() => {
      let saleId: number
      let folio: number
      let ticketNumber: number

      // 1. Resolve Folio (Global, Unique)
      if (typeof input.folio === 'number') {
        const conflict = this.db
          .prepare('SELECT 1 FROM sales WHERE folio = ? AND id != ?')
          .get(input.folio, input.saleId || 0)
        folio = conflict ? this.getNextFolio() : input.folio
      } else {
        folio = this.getNextFolio()
      }

      // 2. Resolve Ticket Number (Shift-based, 0-indexed)
      if (typeof input.ticket_number === 'number') {
        ticketNumber = input.ticket_number
      } else if (input.saleId) {
        const existing = this.db.prepare('SELECT ticket_number FROM sales WHERE id = ?').get(input.saleId) as { ticket_number: number } | undefined
        ticketNumber =
          existing && typeof existing.ticket_number === 'number'
            ? existing.ticket_number
            : this.getNextTicketNumber([], input.cashSessionId)
      } else {
        ticketNumber = this.getNextTicketNumber([], input.cashSessionId)
      }

      // 3. Process returned exchange items if this is an exchange
      if (input.exchangeInfo && input.exchangeInfo.returnedItems.length > 0) {
        const updateOriginalItem = this.db.prepare(`
          UPDATE sale_items
          SET returned_qty = returned_qty + ?
          WHERE sale_id = ? AND product_code = ?
        `)
        const restoreStock = this.db.prepare(`
          UPDATE products SET stock = stock + ?, updated_at = ? WHERE code = ?
        `)
        const insertReturnMovement = this.db.prepare(`
          INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
          VALUES (?, ?, 'devolucion', ?, ?, ?)
        `)

        for (const ret of input.exchangeInfo.returnedItems) {
          updateOriginalItem.run(ret.quantity, input.exchangeInfo.originalSaleId, ret.product_code)
          restoreStock.run(ret.quantity, now, ret.product_code)
          insertReturnMovement.run(
            ret.product_code,
            ret.quantity,
            `Cambio por venta Folio #${folio} (Venta original Folio #${input.exchangeInfo.originalFolio})`,
            input.exchangeInfo.originalSaleId,
            now
          )
        }
      }

      const exchangeParentId = input.exchangeInfo ? input.exchangeInfo.originalSaleId : null

      if (input.saleId) {
        saleId = input.saleId
        this.db.prepare(`
          UPDATE sales SET
            folio = ?,
            ticket_number = ?,
            status = 'completed',
            total = ?,
            cash_session_id = ?,
            exchange_parent_id = ?,
            completed_at = ?
          WHERE id = ?
        `).run(folio, ticketNumber, total, input.cashSessionId, exchangeParentId, now, saleId)

        // Clear any temporary pending items
        this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
      } else {
        const res = this.db.prepare(`
          INSERT INTO sales (folio, ticket_number, status, total, cash_session_id, exchange_parent_id, created_at, completed_at)
          VALUES (?, ?, 'completed', ?, ?, ?, ?, ?)
        `).run(folio, ticketNumber, total, input.cashSessionId, exchangeParentId, now, now)
        saleId = Number(res.lastInsertRowid)
      }

      // 4. Insert sale items, decrement stock, and record inventory movements
      const insertItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, product_code, name, unit_price, quantity, returned_qty)
        VALUES (?, ?, ?, ?, ?, 0)
      `)
      const updateStock = this.db.prepare(`
        UPDATE products SET stock = stock - ?, updated_at = ? WHERE code = ?
      `)
      const insertInvMovement = this.db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
        VALUES (?, ?, 'venta', ?, ?, ?)
      `)

      const savedItems: SaleItem[] = []
      const saleReason = isExchange
        ? `Cambio por venta Folio #${folio} (Venta original Folio #${input.exchangeInfo!.originalFolio})`
        : `Venta Folio #${folio}`

      for (const it of input.items) {
        const itemRes = insertItem.run(saleId, it.product_code, it.name, it.unit_price, it.quantity)
        savedItems.push({
          id: Number(itemRes.lastInsertRowid),
          sale_id: saleId,
          product_code: it.product_code,
          name: it.name,
          unit_price: it.unit_price,
          quantity: it.quantity,
          returned_qty: 0
        })

        // Decrement stock
        updateStock.run(it.quantity, now, it.product_code)

        // Register inventory movement
        insertInvMovement.run(
          it.product_code,
          -it.quantity,
          saleReason,
          saleId,
          now
        )
      }

      // 2. Insert payments
      const insertPayment = this.db.prepare(`
        INSERT INTO sale_payments (sale_id, method, amount)
        VALUES (?, ?, ?)
      `)

      const savedPayments: SalePayment[] = []
      for (const p of input.payments) {
        const payRes = insertPayment.run(saleId, p.method, p.amount)
        savedPayments.push({
          id: Number(payRes.lastInsertRowid),
          sale_id: saleId,
          method: p.method,
          amount: p.amount
        })
      }

      // 3. Calculate change for cash
      const cashPayment = input.payments.find((p) => p.method === 'cash')
      let change = 0
      if (cashPayment && input.cashPaid && input.cashPaid > cashPayment.amount) {
        change = input.cashPaid - cashPayment.amount
      }

      const completedSale: Sale = {
        id: saleId,
        folio,
        ticket_number: ticketNumber,
        status: 'completed',
        total,
        cash_session_id: input.cashSessionId,
        exchange_parent_id: exchangeParentId,
        exchange_parent_folio: input.exchangeInfo ? input.exchangeInfo.originalFolio : null,
        created_at: now,
        completed_at: now
      }

      return {
        sale: completedSale,
        items: savedItems,
        payments: savedPayments,
        change
      }
    })

    return tx()
  }

  // ----------------------------------------------------
  // Fase 7: Historial de Ventas, Cancelaciones y Devoluciones
  // ----------------------------------------------------

  getSalesHistory(filter: SalesHistoryFilter = {}): (Sale & { payments: SalePayment[]; total_items: number; returned_items_count: number })[] {
    const conditions: string[] = []
    const params: any[] = []

    if (filter.date) {
      conditions.push("date(s.created_at, 'localtime') = ?")
      params.push(filter.date)
    }

    if (filter.folio !== undefined && filter.folio !== null && !isNaN(filter.folio)) {
      conditions.push('s.folio = ?')
      params.push(filter.folio)
    }

    if (filter.cashSessionId) {
      conditions.push('s.cash_session_id = ?')
      params.push(filter.cashSessionId)
    }

    if (filter.status && filter.status !== 'all') {
      conditions.push('s.status = ?')
      params.push(filter.status)
    } else if (!filter.status) {
      // Por defecto el historial lista ventas completadas o canceladas (no pendientes en standby)
      conditions.push("s.status IN ('completed', 'cancelled')")
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filter.limit || 100
    const offset = filter.offset || 0

    const query = `
      SELECT
        s.*,
        parent.folio AS exchange_parent_folio,
        COALESCE((SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id), 0) AS total_items,
        COALESCE((SELECT SUM(returned_qty) FROM sale_items WHERE sale_id = s.id), 0) AS returned_items_count
      FROM sales s
      LEFT JOIN sales parent ON s.exchange_parent_id = parent.id
      ${where}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `

    const sales = this.db.prepare(query).all(...params, limit, offset) as (Sale & { total_items: number; returned_items_count: number })[]

    const getPayments = this.db.prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id ASC')

    return sales.map((s) => ({
      ...s,
      payments: getPayments.all(s.id) as SalePayment[]
    }))
  }

  getSaleDetail(saleId: number): SaleDetail | null {
    const sale = this.db.prepare(`
      SELECT
        s.*,
        parent.folio AS exchange_parent_folio
      FROM sales s
      LEFT JOIN sales parent ON s.exchange_parent_id = parent.id
      WHERE s.id = ?
    `).get(saleId) as (Sale & { exchange_parent_folio?: number | null }) | undefined
    if (!sale) return null

    const items = this.db
      .prepare(`
        SELECT
          si.id,
          si.sale_id,
          si.product_code,
          si.name,
          si.unit_price,
          si.quantity,
          si.returned_qty,
          COALESCE(p.stock, 0) AS current_stock
        FROM sale_items si
        LEFT JOIN products p ON si.product_code = p.code
        WHERE si.sale_id = ?
        ORDER BY si.id ASC
      `)
      .all(saleId) as (SaleItem & { current_stock?: number })[]

    const payments = this.db
      .prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id ASC')
      .all(saleId) as SalePayment[]

    const child_exchanges = this.db
      .prepare(`
        SELECT id, folio, created_at
        FROM sales
        WHERE exchange_parent_id = ? AND status = 'completed'
        ORDER BY id ASC
      `)
      .all(saleId) as { id: number; folio: number; created_at: string }[]

    const total_items = items.reduce((acc, it) => acc + it.quantity, 0)
    const returned_items_count = items.reduce((acc, it) => acc + it.returned_qty, 0)

    return {
      ...sale,
      items,
      payments,
      total_items,
      returned_items_count,
      child_exchanges
    }
  }

  cancelSale(saleId: number, reason?: string): SaleDetail {
    const tx = this.db.transaction(() => {
      const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as Sale | undefined
      if (!sale) {
        throw new Error('Venta no encontrada')
      }
      if (sale.status === 'cancelled') {
        throw new Error('Esta venta ya se encuentra cancelada')
      }
      if (sale.status === 'pending') {
        throw new Error('No se puede cancelar una venta pendiente desde el historial')
      }

      const items = this.db
        .prepare('SELECT * FROM sale_items WHERE sale_id = ?')
        .all(saleId) as SaleItem[]

      const now = new Date().toISOString()
      const effectiveReason = reason && reason.trim() ? reason.trim() : `Cancelación de Venta Folio #${sale.folio}`

      // 1. Reponer stock de cada producto y registrar movimiento tipo "devolucion"
      const updateStock = this.db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE code = ?')
      const updateItem = this.db.prepare('UPDATE sale_items SET returned_qty = quantity WHERE id = ?')
      const insertMovement = this.db.prepare(`
        INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
        VALUES (?, ?, 'devolucion', ?, ?, ?)
      `)

      for (const item of items) {
        const toReturn = item.quantity - item.returned_qty
        if (toReturn > 0) {
          updateStock.run(toReturn, now, item.product_code)
          insertMovement.run(item.product_code, toReturn, effectiveReason, sale.id, now)
          updateItem.run(item.id)
        }
      }

      // 2. Marcar venta como cancelled
      this.db
        .prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?")
        .run(saleId)

      return this.getSaleDetail(saleId)!
    })

    return tx()
  }

  returnSaleItem(saleId: number, productCode: string, quantityToReturn: number, reason?: string): SaleDetail {
    if (!Number.isInteger(quantityToReturn) || quantityToReturn <= 0) {
      throw new Error('La cantidad a devolver debe ser un número entero mayor a cero')
    }

    const tx = this.db.transaction(() => {
      const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as Sale | undefined
      if (!sale) {
        throw new Error('Venta no encontrada')
      }
      if (sale.status === 'cancelled') {
        throw new Error('La venta ya se encuentra cancelada en su totalidad')
      }
      if (sale.status === 'pending') {
        throw new Error('No se pueden hacer devoluciones sobre una venta en estado pendiente')
      }

      const item = this.db
        .prepare('SELECT * FROM sale_items WHERE sale_id = ? AND product_code = ?')
        .get(saleId, productCode) as SaleItem | undefined

      if (!item) {
        throw new Error(`El producto con código ${productCode} no pertenece a esta venta`)
      }

      const availableToReturn = item.quantity - item.returned_qty
      if (quantityToReturn > availableToReturn) {
        throw new Error(
          `No se pueden devolver ${quantityToReturn} unidades. Solo hay ${availableToReturn} disponibles para devolución.`
        )
      }

      const now = new Date().toISOString()
      const effectiveReason = reason && reason.trim()
        ? reason.trim()
        : `Devolución de ${quantityToReturn} un. de ${item.name} (Venta Folio #${sale.folio})`

      // 1. Actualizar returned_qty del item
      this.db
        .prepare('UPDATE sale_items SET returned_qty = returned_qty + ? WHERE id = ?')
        .run(quantityToReturn, item.id)

      // 2. Reponer stock del producto
      this.db
        .prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE code = ?')
        .run(quantityToReturn, now, item.product_code)

      // 3. Registrar movimiento en inventory_movements
      this.db
        .prepare(`
          INSERT INTO inventory_movements (product_code, delta, type, reason, ref_sale_id, created_at)
          VALUES (?, ?, 'devolucion', ?, ?, ?)
        `)
        .run(item.product_code, quantityToReturn, effectiveReason, sale.id, now)

      // 4. Si todos los items de la venta quedaron 100% devueltos, marcar venta como cancelled
      const allItems = this.db
        .prepare('SELECT quantity, returned_qty FROM sale_items WHERE sale_id = ?')
        .all(saleId) as { quantity: number; returned_qty: number }[]

      const allReturned = allItems.every((it) => it.quantity === it.returned_qty)
      if (allReturned) {
        this.db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(saleId)
      }

      return this.getSaleDetail(saleId)!
    })

    return tx()
  }
}

