import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { INITIAL_SCHEMA } from '../main/db/schema'
import { runMigrations } from '../main/db/migrations'
import { CustomerService } from '../main/services/customerService'
import { calculateDv, cleanRut, formatRut, validateRut } from '../shared/rut'

describe('Módulo de Clientes y Cuentas Corrientes', () => {
  describe('Validador Universal de RUT Chileno (Algoritmo Módulo 11)', () => {
    it('calcula correctamente el dígito verificador para cuerpos de RUT', () => {
      expect(calculateDv('11111111')).toBe('1')
      expect(calculateDv('12345678')).toBe('5')
      expect(calculateDv('19876543')).toBe('0')
      expect(calculateDv('10000013')).toBe('K')
      expect(calculateDv(11111111)).toBe('1')
      expect(calculateDv('')).toBe('')
    })

    it('valida RUTs chilenos auténticos con diferentes formatos', () => {
      expect(validateRut('12.345.678-5')).toBe(true)
      expect(validateRut('12345678-5')).toBe(true)
      expect(validateRut('10.000.013-K')).toBe(true)
      expect(validateRut('10000013-k')).toBe(true) // insensible a mayúsculas
      expect(validateRut('11.111.111-1')).toBe(true)
      expect(validateRut('19.876.543-0')).toBe(true)
    })

    it('rechaza RUTs con dígito verificador incorrecto o formato inválido', () => {
      expect(validateRut('12.345.678-9')).toBe(false) // DV incorrecto
      expect(validateRut('11.111.111-K')).toBe(false) // DV incorrecto
      expect(validateRut('')).toBe(false)
      expect(validateRut('abc')).toBe(false)
      expect(validateRut('12345678')).toBe(false) // sin guion
      expect(validateRut('123456789012-5')).toBe(false) // longitud excesiva
    })

    it('limpia y formatea RUTs con y sin puntos separadores de miles', () => {
      expect(cleanRut(' 12.345.678-5 ')).toBe('12345678-5')
      expect(cleanRut('10000013k')).toBe('10000013-K')
      expect(formatRut('12345678-5', false)).toBe('12345678-5')
      expect(formatRut('12345678-5', true)).toBe('12.345.678-5')
      expect(formatRut('10000013-k', true)).toBe('10.000.013-K')
    })
  })

  describe('CustomerService y Base de Datos (Migración 15 y Esquema)', () => {
    let db: Database.Database
    let customerService: CustomerService

    beforeEach(() => {
      db = new Database(':memory:')
      db.exec(INITIAL_SCHEMA)
      runMigrations(db)
      customerService = new CustomerService(db)
    })

    it('las tablas customers y customer_credit_movements existen con sus columnas', () => {
      const customersCols = db.pragma('table_info(customers)') as { name: string }[]
      const colNames = customersCols.map((c) => c.name)

      expect(colNames).toContain('id')
      expect(colNames).toContain('rut')
      expect(colNames).toContain('name')
      expect(colNames).toContain('search_name')
      expect(colNames).toContain('credit_limit')
      expect(colNames).toContain('current_balance')
      expect(colNames).toContain('active')

      const ccmCols = db.pragma('table_info(customer_credit_movements)') as { name: string }[]
      const ccmNames = ccmCols.map((c) => c.name)
      expect(ccmNames).toContain('customer_id')
      expect(ccmNames).toContain('movement_type')
      expect(ccmNames).toContain('amount')
      expect(ccmNames).toContain('previous_balance')
      expect(ccmNames).toContain('new_balance')
      expect(ccmNames).toContain('sale_folio')
      expect(ccmNames).toContain('cash_session_id')

      const salesCols = db.pragma('table_info(sales)') as { name: string }[]
      expect(salesCols.map((c) => c.name)).toContain('customer_id')
    })

    it('permite método credito en sale_payments y tipo ingreso en cash_movements', () => {
      // Crear sesión y venta dummy
      db.prepare(
        "INSERT INTO cash_sessions (opening_fund, opened_at) VALUES (10000, datetime('now'))"
      ).run()
      const saleResult = db
        .prepare("INSERT INTO sales (ticket_number, status, total, created_at) VALUES (1, 'completed', 5000, datetime('now'))")
        .run()
      const saleId = Number(saleResult.lastInsertRowid)

      // sale_payments con credito
      expect(() => {
        db.prepare("INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, 'credito', 5000)").run(saleId)
      }).not.toThrow()

      // cash_movements con ingreso
      expect(() => {
        db.prepare("INSERT INTO cash_movements (cash_session_id, type, amount, reason, created_at) VALUES (1, 'ingreso', 2000, 'Abono cliente', datetime('now'))").run()
      }).not.toThrow()
    })

    it('crea un cliente con RUT válido y saldo inicial $0', () => {
      const created = customerService.saveCustomer({
        rut: '12.345.678-5',
        name: 'Juan Pérez Almacén',
        phone: '+56912345678',
        email: 'juan@almacen.cl',
        address: 'Calle Comercio 123',
        credit_limit: 50000
      })

      expect(created.id).toBeGreaterThan(0)
      expect(created.rut).toBe('12345678-5')
      expect(created.name).toBe('Juan Pérez Almacén')
      expect(created.credit_limit).toBe(50000)
      expect(created.current_balance).toBe(0)
      expect(created.active).toBe(1)
    })

    it('rechaza guardar un cliente sin nombre o con RUT inválido', () => {
      expect(() => {
        customerService.saveCustomer({
          name: '',
          rut: '12.345.678-5'
        })
      }).toThrow(/nombre del cliente no puede estar vacío/)

      expect(() => {
        customerService.saveCustomer({
          name: 'Cliente Invalido',
          rut: '12.345.678-9' // DV erróneo
        })
      }).toThrow(/RUT ingresado no es válido/)
    })

    it('impide registrar RUTs duplicados en diferentes clientes', () => {
      customerService.saveCustomer({
        name: 'Cliente Original',
        rut: '12.345.678-5'
      })

      expect(() => {
        customerService.saveCustomer({
          name: 'Cliente Clon',
          rut: '12345678-5'
        })
      }).toThrow(/Ya existe un cliente registrado con el RUT/)
    })

    it('actualiza datos y límite de crédito sin alterar el saldo deudor actual', () => {
      const created = customerService.saveCustomer({
        name: 'María González',
        rut: '10.000.013-K',
        credit_limit: 20000
      })

      // Simular deuda existente
      db.prepare('UPDATE customers SET current_balance = 15000 WHERE id = ?').run(created.id)

      const updated = customerService.saveCustomer({
        id: created.id,
        name: 'María González Silva',
        rut: '10000013-K',
        credit_limit: 40000
      })

      expect(updated.name).toBe('María González Silva')
      expect(updated.credit_limit).toBe(40000)
      // Debe preservar el saldo deudor
      const fresh = customerService.getCustomerById(created.id)
      expect(fresh?.current_balance).toBe(15000)
    })

    it('busca clientes por nombre (sin tildes) y por RUT', () => {
      customerService.saveCustomer({ name: 'Andrés Peña', rut: '11.111.111-1' })
      customerService.saveCustomer({ name: 'Carmen Rojas', rut: '12.345.678-5' })

      // Búsqueda sin acentos
      const results1 = customerService.getCustomers({ query: 'andres' })
      expect(results1).toHaveLength(1)
      expect(results1[0].name).toBe('Andrés Peña')

      // Búsqueda por RUT parcial o completo
      const results2 = customerService.getCustomers({ query: '12345678' })
      expect(results2).toHaveLength(1)
      expect(results2[0].name).toBe('Carmen Rojas')
    })

    it('desactiva lógicamente un cliente (active = 0) sin eliminar sus registros', () => {
      const customer = customerService.saveCustomer({ name: 'Cliente a Eliminar' })
      const deleted = customerService.deleteCustomer(customer.id)
      expect(deleted).toBe(true)

      // No debe aparecer en getCustomers() por defecto
      const activeList = customerService.getCustomers()
      expect(activeList.some((c) => c.id === customer.id)).toBe(false)

      // Debe permanecer en base de datos con active = 0
      const inDb = customerService.getCustomerById(customer.id)
      expect(inDb).not.toBeNull()
      expect(inDb?.active).toBe(0)
    })
  })

  describe('Integridad Atómica de Saldos y Movimientos de Crédito', () => {
    let db: Database.Database
    let customerService: CustomerService

    beforeEach(() => {
      db = new Database(':memory:')
      db.exec(INITIAL_SCHEMA)
      runMigrations(db)
      customerService = new CustomerService(db)
    })

    it('registra cargo_venta aumentando atómicamente el saldo y auditando saldos anterior/nuevo', () => {
      db.prepare(
        "INSERT INTO sales (folio, ticket_number, status, total, created_at) VALUES (101, 1, 'completed', 25000, datetime('now'))"
      ).run()

      const customer = customerService.saveCustomer({
        name: 'Comercial La Esquina',
        credit_limit: 100000
      })

      const movement = customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'cargo_venta',
        amount: 25000,
        saleFolio: 101,
        notes: 'Venta #101 a crédito'
      })

      expect(movement.id).toBeGreaterThan(0)
      expect(movement.previous_balance).toBe(0)
      expect(movement.new_balance).toBe(25000)
      expect(movement.sale_folio).toBe(101)

      const updatedCustomer = customerService.getCustomerById(customer.id)
      expect(updatedCustomer?.current_balance).toBe(25000)
    })

    it('registra abono reduciendo atómicamente el saldo deudor', () => {
      db.prepare(
        "INSERT INTO cash_sessions (opening_fund, opened_at) VALUES (10000, datetime('now'))"
      ).run()

      const customer = customerService.saveCustomer({ name: 'Teresa Vidal' })

      // Cargo inicial
      customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'cargo_venta',
        amount: 30000
      })

      // Abono parcial
      const abono = customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'abono',
        amount: 10000,
        paymentMethod: 'efectivo',
        cashSessionId: 1,
        notes: 'Abono en efectivo'
      })

      expect(abono.previous_balance).toBe(30000)
      expect(abono.new_balance).toBe(20000)

      const updatedCustomer = customerService.getCustomerById(customer.id)
      expect(updatedCustomer?.current_balance).toBe(20000)
    })

    it('rechaza registrar movimientos con montos no positivos o tipos inválidos', () => {
      const customer = customerService.saveCustomer({ name: 'Prueba Errores' })

      expect(() => {
        customerService.addCreditMovement({
          customerId: customer.id,
          movementType: 'cargo_venta',
          amount: 0
        })
      }).toThrow(/monto del movimiento de crédito debe ser un entero positivo/)

      expect(() => {
        customerService.addCreditMovement({
          customerId: customer.id,
          movementType: 'invalido' as any,
          amount: 5000
        })
      }).toThrow(/Tipo de movimiento de crédito inválido/)
    })

    it('genera la cartola histórica (statement) con totales acumulados exactos', () => {
      db.prepare(
        "INSERT INTO sales (folio, ticket_number, status, total, created_at) VALUES (10, 1, 'completed', 15000, datetime('now'))"
      ).run()
      db.prepare(
        "INSERT INTO sales (folio, ticket_number, status, total, created_at) VALUES (15, 2, 'completed', 20000, datetime('now'))"
      ).run()

      const customer = customerService.saveCustomer({ name: 'Negocio Central' })

      customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'cargo_venta',
        amount: 15000,
        saleFolio: 10
      })
      customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'cargo_venta',
        amount: 20000,
        saleFolio: 15
      })
      customerService.addCreditMovement({
        customerId: customer.id,
        movementType: 'abono',
        amount: 12000,
        paymentMethod: 'transferencia'
      })

      const statement = customerService.getCustomerStatement(customer.id)

      expect(statement.customer.id).toBe(customer.id)
      expect(statement.movements).toHaveLength(3)
      expect(statement.totalCharged).toBe(35000)
      expect(statement.totalPaid).toBe(12000)
      expect(statement.customer.current_balance).toBe(23000)
    })
  })
})
