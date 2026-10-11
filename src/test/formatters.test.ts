import { describe, it, expect } from 'vitest'
import {
  formatCLP,
  parseCLP,
  formatPaymentMethods,
  capitalizeWords,
  formatDate,
  groupSessionsByDay
} from '../renderer/src/utils/formatters'
import { CashSession } from '../shared/types'

describe('Fase 3: Formateo de Moneda CLP (Reglas de Dominio)', () => {
  it('formatea montos a CLP como enteros sin decimales con punto de miles', () => {
    expect(formatCLP(0)).toBe('$ 0')
    expect(formatCLP(100)).toBe('$ 100')
    expect(formatCLP(19990)).toBe('$ 19.990')
    expect(formatCLP(50000)).toBe('$ 50.000')
    expect(formatCLP(1500000)).toBe('$ 1.500.000')
  })

  it('redondea montos decimales al entero más cercano', () => {
    expect(formatCLP(19990.4)).toBe('$ 19.990')
    expect(formatCLP(19990.6)).toBe('$ 19.991')
  })

  it('parsea strings con formato CLP a enteros limpios', () => {
    expect(parseCLP('$ 19.990')).toBe(19990)
    expect(parseCLP('50.000')).toBe(50000)
    expect(parseCLP('$ 1.250.000')).toBe(1250000)
    expect(parseCLP('')).toBe(0)
    expect(parseCLP('abc')).toBe(0)
  })

  it('formatea métodos de pago para la información de venta anterior', () => {
    expect(formatPaymentMethods([{ method: 'cash', amount: 5000 }])).toBe('Efectivo')
    expect(formatPaymentMethods([{ method: 'card', amount: 8000 }])).toBe('Tarjeta')
    expect(formatPaymentMethods([{ method: 'transfer', amount: 10000 }])).toBe('Transferencia')
    expect(
      formatPaymentMethods([
        { method: 'cash', amount: 5000 },
        { method: 'card', amount: 5000 }
      ])
    ).toBe('Efectivo + Tarjeta')
    expect(formatPaymentMethods([])).toBe('Cambio')
  })

  it('fuerza la mayúscula en la primera letra de cada palabra (capitalizeWords)', () => {
    expect(capitalizeWords('')).toBe('')
    expect(capitalizeWords('lana merino')).toBe('Lana Merino')
    expect(capitalizeWords('algodón rústico grueso')).toBe('Algodón Rústico Grueso')
    expect(capitalizeWords('crochet 4.0mm (aluminio)')).toBe('Crochet 4.0mm (Aluminio)')
    expect(capitalizeWords('hilo/poliéster')).toBe('Hilo/Poliéster')
    expect(capitalizeWords('ñandú')).toBe('Ñandú')
    expect(capitalizeWords('polera talla xl')).toBe('Polera Talla Xl')
    expect(capitalizeWords('Talla XL')).toBe('Talla XL')
  })

  it('formatea fechas a estándar chileno DD/MM/AAAA con formatDate', () => {
    expect(formatDate('2026-10-11T14:30:00.000Z')).toMatch(/11\/10\/2026/)
    expect(formatDate('')).toBe('')
  })

  describe('groupSessionsByDay (Registros Diarios de Caja)', () => {
    it('retorna arreglo vacío si no hay sesiones', () => {
      expect(groupSessionsByDay([])).toEqual([])
    })

    it('agrupa correctamente un día con un único turno', () => {
      const session: CashSession = {
        id: 1,
        opened_at: '2026-10-10T09:00:00.000Z',
        closed_at: '2026-10-10T19:00:00.000Z',
        opening_fund: 50000,
        closing_cash: 120000,
        sales_cash: 70000,
        sales_card: 30000,
        sales_transfer: 15000,
        difference: 0,
        card_difference: 0,
        withdrawal_amount: 70000
      }

      const records = groupSessionsByDay([session])
      expect(records).toHaveLength(1)
      expect(records[0].turnCount).toBe(1)
      expect(records[0].initialOpeningFund).toBe(50000)
      expect(records[0].finalClosingCash).toBe(120000)
      expect(records[0].totalSalesCash).toBe(70000)
      expect(records[0].totalSalesCard).toBe(30000)
      expect(records[0].totalSalesTransfer).toBe(15000)
      expect(records[0].totalSales).toBe(115000)
      expect(records[0].totalDifferenceCash).toBe(0)
      expect(records[0].totalWithdrawal).toBe(70000)
      expect(records[0].sessions).toHaveLength(1)
    })

    it('consolida múltiples turnos del mismo día sumando ventas y retiros, con primer inicio y último cierre', () => {
      const turn1: CashSession = {
        id: 10,
        opened_at: '2026-10-11T09:00:00.000Z',
        closed_at: '2026-10-11T14:00:00.000Z',
        opening_fund: 50000,
        closing_cash: 85000,
        sales_cash: 35000,
        sales_card: 20000,
        sales_transfer: 5000,
        difference: 0,
        card_difference: 0,
        withdrawal_amount: 35000
      }

      const turn2: CashSession = {
        id: 11,
        opened_at: '2026-10-11T15:00:00.000Z',
        closed_at: '2026-10-11T21:00:00.000Z',
        opening_fund: 50000,
        closing_cash: 110000,
        sales_cash: 60000,
        sales_card: 45000,
        sales_transfer: 10000,
        difference: -1000,
        card_difference: 0,
        withdrawal_amount: 60000
      }

      // Pasados en orden inverso como entrega la BD (el más reciente primero)
      const records = groupSessionsByDay([turn2, turn1])
      expect(records).toHaveLength(1)
      expect(records[0].turnCount).toBe(2)
      // Primer inicio y último cierre
      expect(records[0].firstOpenedAt).toBe(turn1.opened_at)
      expect(records[0].lastClosedAt).toBe(turn2.closed_at)
      expect(records[0].initialOpeningFund).toBe(50000)
      expect(records[0].finalClosingCash).toBe(110000)
      // Sumatorias consolidadas
      expect(records[0].totalSalesCash).toBe(95000)
      expect(records[0].totalSalesCard).toBe(65000)
      expect(records[0].totalSalesTransfer).toBe(15000)
      expect(records[0].totalSales).toBe(175000)
      expect(records[0].totalDifferenceCash).toBe(-1000)
      expect(records[0].totalWithdrawal).toBe(95000)
      // Sesiones internas ordenadas cronológicamente
      expect(records[0].sessions[0].id).toBe(10)
      expect(records[0].sessions[1].id).toBe(11)
    })
  })
})
