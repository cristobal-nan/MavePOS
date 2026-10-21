import Database from 'better-sqlite3'
import {
  Customer,
  CustomerInput,
  CustomerCreditMovement,
  CustomerStatement,
  CreditMovementInput,
  CustomerSearchOptions
} from '../../shared/types'
import { normalizeSearchName } from '../db/utils'
import { cleanRut, validateRut } from '../../shared/rut'

export class CustomerService {
  constructor(private db: Database.Database) {}

  /**
   * Obtiene la lista de clientes con soporte para búsqueda insensible a acentos por nombre o RUT.
   */
  getCustomers(options: CustomerSearchOptions = {}): Customer[] {
    const { query, onlyActive = true } = options
    const conditions: string[] = []
    const params: any[] = []

    if (onlyActive) {
      conditions.push('active = 1')
    }

    if (query && query.trim().length > 0) {
      const trimmed = query.trim()
      const searchNormalized = `%${normalizeSearchName(trimmed)}%`
      const rawDigitsAndK = trimmed.replace(/[^0-9kK]/g, '').toUpperCase()

      if (rawDigitsAndK.length > 0) {
        conditions.push('(search_name LIKE ? OR rut LIKE ?)')
        params.push(searchNormalized, `%${rawDigitsAndK}%`)
      } else {
        conditions.push('search_name LIKE ?')
        params.push(searchNormalized)
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM customers ${whereClause} ORDER BY name ASC`
    return this.db.prepare(sql).all(...params) as Customer[]
  }

  /**
   * Obtiene un cliente por su ID.
   */
  getCustomerById(id: number): Customer | null {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined
    return row || null
  }

  /**
   * Obtiene un cliente por su RUT normalizado.
   */
  getCustomerByRut(rut: string): Customer | null {
    const cleaned = cleanRut(rut)
    if (!cleaned) return null
    const row = this.db.prepare('SELECT * FROM customers WHERE rut = ?').get(cleaned) as Customer | undefined
    return row || null
  }

  /**
   * Guarda o actualiza un cliente.
   * Valida nombre obligatorio, RUT chileno válido (Módulo 11) y unicidad de RUT.
   */
  saveCustomer(input: CustomerInput): Customer {
    const trimmedName = (input.name || '').trim()
    if (!trimmedName) {
      throw new Error('El nombre del cliente no puede estar vacío.')
    }

    let cleanedRut: string | null = null
    if (input.rut && input.rut.trim().length > 0) {
      if (!validateRut(input.rut)) {
        throw new Error('El RUT ingresado no es válido (dígito verificador incorrecto).')
      }
      cleanedRut = cleanRut(input.rut)

      // Verificar unicidad de RUT
      const existing = this.getCustomerByRut(cleanedRut)
      if (existing && (!input.id || existing.id !== input.id)) {
        throw new Error(`Ya existe un cliente registrado con el RUT ${cleanedRut}.`)
      }
    }

    const searchName = normalizeSearchName(trimmedName)
    const phone = input.phone?.trim() || null
    const email = input.email?.trim() || null
    const address = input.address?.trim() || null
    const creditLimit = Math.max(0, Math.floor(Number(input.credit_limit) || 0))
    const now = new Date().toISOString()

    if (input.id) {
      const existing = this.getCustomerById(input.id)
      if (!existing) {
        throw new Error(`Cliente con ID ${input.id} no encontrado.`)
      }

      this.db
        .prepare(`
          UPDATE customers
          SET rut = ?, name = ?, search_name = ?, phone = ?, email = ?, address = ?, credit_limit = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(cleanedRut, trimmedName, searchName, phone, email, address, creditLimit, now, input.id)

      return {
        ...existing,
        rut: cleanedRut,
        name: trimmedName,
        search_name: searchName,
        phone,
        email,
        address,
        credit_limit: creditLimit,
        updated_at: now
      }
    } else {
      const result = this.db
        .prepare(`
          INSERT INTO customers (rut, name, search_name, phone, email, address, credit_limit, current_balance, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
        `)
        .run(cleanedRut, trimmedName, searchName, phone, email, address, creditLimit, now, now)

      const newId = Number(result.lastInsertRowid)
      return {
        id: newId,
        rut: cleanedRut,
        name: trimmedName,
        search_name: searchName,
        phone,
        email,
        address,
        credit_limit: creditLimit,
        current_balance: 0,
        active: 1,
        created_at: now,
        updated_at: now
      }
    }
  }

  /**
   * Desactiva lógicamente un cliente (active = 0) preservando la integridad de movimientos históricos.
   */
  deleteCustomer(id: number): boolean {
    const existing = this.getCustomerById(id)
    if (!existing) return false

    const now = new Date().toISOString()
    this.db.prepare('UPDATE customers SET active = 0, updated_at = ? WHERE id = ?').run(now, id)
    return true
  }

  /**
   * Registra un movimiento de crédito de forma atómica en SQLite.
   * Actualiza sincronizadamente current_balance en customers y añade el registro en customer_credit_movements.
   */
  addCreditMovement(input: CreditMovementInput): CustomerCreditMovement {
    const { customerId, movementType, amount, saleFolio, cashSessionId, paymentMethod, notes } = input

    if (!['cargo_venta', 'abono', 'ajuste'].includes(movementType)) {
      throw new Error(`Tipo de movimiento de crédito inválido: "${movementType}".`)
    }

    const cleanAmount = Math.floor(Number(amount) || 0)
    if (cleanAmount <= 0) {
      throw new Error('El monto del movimiento de crédito debe ser un entero positivo mayor a 0.')
    }

    const executeTx = this.db.transaction(() => {
      const customer = this.getCustomerById(customerId)
      if (!customer) {
        throw new Error(`Cliente con ID ${customerId} no existe.`)
      }

      const previousBalance = customer.current_balance
      let newBalance = previousBalance

      if (movementType === 'cargo_venta') {
        newBalance = previousBalance + cleanAmount
      } else if (movementType === 'abono') {
        newBalance = previousBalance - cleanAmount
      } else if (movementType === 'ajuste') {
        newBalance = previousBalance + cleanAmount
      }

      const now = new Date().toISOString()

      // Actualizar saldo del cliente
      this.db
        .prepare('UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?')
        .run(newBalance, now, customerId)

      // Registrar movimiento inmutable
      const insertStmt = this.db.prepare(`
        INSERT INTO customer_credit_movements (
          customer_id, movement_type, amount, previous_balance, new_balance,
          sale_folio, cash_session_id, payment_method, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = insertStmt.run(
        customerId,
        movementType,
        cleanAmount,
        previousBalance,
        newBalance,
        saleFolio || null,
        cashSessionId || null,
        paymentMethod || null,
        notes || null,
        now
      )

      return {
        id: Number(result.lastInsertRowid),
        customer_id: customerId,
        movement_type: movementType,
        amount: cleanAmount,
        previous_balance: previousBalance,
        new_balance: newBalance,
        sale_folio: saleFolio || null,
        cash_session_id: cashSessionId || null,
        payment_method: paymentMethod || null,
        notes: notes || null,
        created_at: now
      } as CustomerCreditMovement
    })

    return executeTx()
  }

  /**
   * Obtiene la cartola histórica / estado de cuenta del cliente con totales calculados.
   */
  getCustomerStatement(customerId: number): CustomerStatement {
    const customer = this.getCustomerById(customerId)
    if (!customer) {
      throw new Error(`Cliente con ID ${customerId} no existe.`)
    }

    const movements = this.db
      .prepare('SELECT * FROM customer_credit_movements WHERE customer_id = ? ORDER BY created_at ASC, id ASC')
      .all(customerId) as CustomerCreditMovement[]

    let totalCharged = 0
    let totalPaid = 0

    for (const m of movements) {
      if (m.movement_type === 'cargo_venta') {
        totalCharged += m.amount
      } else if (m.movement_type === 'abono') {
        totalPaid += m.amount
      }
    }

    return {
      customer,
      movements,
      totalCharged,
      totalPaid
    }
  }
}
