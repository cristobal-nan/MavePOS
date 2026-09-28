import Database from 'better-sqlite3'
import {
  CartItem,
  CompleteSaleInput,
  CompletedSaleResult,
  PendingTicket,
  Sale,
  SaleItem,
  SalePayment
} from '../../shared/types'

export class SalesService {
  constructor(private db: Database.Database) {}

  getNextFolio(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(folio), 0) + 1 AS nextFolio FROM sales').get() as { nextFolio: number }
    return row.nextFolio
  }

  getPendingSales(cashSessionId?: number): PendingTicket[] {
    const where = cashSessionId ? 'WHERE status = ? AND cash_session_id = ?' : 'WHERE status = ?'
    const params = cashSessionId ? ['pending', cashSessionId] : ['pending']

    const sales = this.db
      .prepare(`SELECT * FROM sales ${where} ORDER BY id ASC`)
      .all(...params) as Sale[]

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
        total: sale.total,
        created_at: sale.created_at,
        items
      }
    })
  }

  savePendingSale(data: { id?: number; cashSessionId: number | null; items: CartItem[] }): PendingTicket {
    const total = data.items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0)
    const now = new Date().toISOString()

    const tx = this.db.transaction(() => {
      let saleId: number
      let folio: number

      if (data.id) {
        saleId = data.id
        const existing = this.db.prepare('SELECT folio FROM sales WHERE id = ?').get(saleId) as { folio: number } | undefined
        folio = existing ? existing.folio : this.getNextFolio()

        this.db
          .prepare('UPDATE sales SET total = ?, cash_session_id = ? WHERE id = ?')
          .run(total, data.cashSessionId, saleId)

        // Delete old items
        this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
      } else {
        folio = this.getNextFolio()
        const res = this.db
          .prepare('INSERT INTO sales (folio, status, total, cash_session_id, created_at, completed_at) VALUES (?, ?, ?, ?, ?, NULL)')
          .run(folio, 'pending', total, data.cashSessionId, now)
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
        folio,
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

    const total = input.items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0)
    const totalPayments = input.payments.reduce((acc, p) => acc + p.amount, 0)

    if (totalPayments !== total) {
      throw new Error(`El monto pagado ($ ${totalPayments}) no coincide exactamente con el total de la venta ($ ${total})`)
    }

    const now = new Date().toISOString()

    const tx = this.db.transaction(() => {
      let saleId: number
      let folio: number

      if (input.saleId) {
        saleId = input.saleId
        const existing = this.db.prepare('SELECT folio FROM sales WHERE id = ?').get(saleId) as { folio: number } | undefined
        folio = existing ? existing.folio : this.getNextFolio()

        this.db.prepare(`
          UPDATE sales SET
            status = 'completed',
            total = ?,
            cash_session_id = ?,
            completed_at = ?
          WHERE id = ?
        `).run(total, input.cashSessionId, now, saleId)

        // Clear any temporary pending items
        this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
      } else {
        folio = this.getNextFolio()
        const res = this.db.prepare(`
          INSERT INTO sales (folio, status, total, cash_session_id, created_at, completed_at)
          VALUES (?, 'completed', ?, ?, ?, ?)
        `).run(folio, total, input.cashSessionId, now, now)
        saleId = Number(res.lastInsertRowid)
      }

      // 1. Insert sale items, decrement stock, and record inventory movements
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
          `Venta Folio #${folio}`,
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
        status: 'completed',
        total,
        cash_session_id: input.cashSessionId,
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
}
