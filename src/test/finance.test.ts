import { describe, it, expect } from 'vitest'
import {
  formatCLP,
  parseCLP,
  CHILEAN_DENOMINATIONS,
  calculateCountedCash,
  calculateDenominationBreakdown,
  calculateCartTotal,
  calculatePaymentChange,
  calculateExpectedCash,
  calculateCashDifference,
  calculateNetSales
} from '../shared/finance'

describe('Domain Financial Logic (CLP)', () => {
  describe('formatCLP', () => {
    it('formatea montos enteros con separador de miles por punto', () => {
      expect(formatCLP(0)).toBe('$ 0')
      expect(formatCLP(100)).toBe('$ 100')
      expect(formatCLP(1000)).toBe('$ 1.000')
      expect(formatCLP(19990)).toBe('$ 19.990')
      expect(formatCLP(50000)).toBe('$ 50.000')
      expect(formatCLP(1250000)).toBe('$ 1.250.000')
    })

    it('redondea decimales al entero más cercano', () => {
      expect(formatCLP(19990.4)).toBe('$ 19.990')
      expect(formatCLP(19990.6)).toBe('$ 19.991')
    })

    it('formatea montos negativos con signo previo al número', () => {
      expect(formatCLP(-5000)).toBe('$ -5.000')
      expect(formatCLP(-100)).toBe('$ -100')
    })

    it('maneja valores inválidos de manera segura devolviendo $ 0', () => {
      expect(formatCLP(NaN)).toBe('$ 0')
      expect(formatCLP(null as any)).toBe('$ 0')
      expect(formatCLP(undefined as any)).toBe('$ 0')
    })
  })

  describe('parseCLP', () => {
    it('extrae el número entero desde strings con formato de moneda chilena', () => {
      expect(parseCLP('$ 19.990')).toBe(19990)
      expect(parseCLP('$50.000')).toBe(50000)
      expect(parseCLP('1.250.000')).toBe(1250000)
      expect(parseCLP('Precio: $ 4.500 CLP')).toBe(4500)
    })

    it('soporta montos numéricos directos redondeándolos a enteros', () => {
      expect(parseCLP(19990)).toBe(19990)
      expect(parseCLP(19990.7)).toBe(19991)
    })

    it('devuelve 0 para entradas vacías o nulas', () => {
      expect(parseCLP('')).toBe(0)
      expect(parseCLP(null)).toBe(0)
      expect(parseCLP(undefined)).toBe(0)
      expect(parseCLP('abc')).toBe(0)
    })
  })

  describe('Denominaciones Chilenas y Arqueo Físico', () => {
    it('define las 9 denominaciones oficiales chilenas en orden descendente', () => {
      expect(CHILEAN_DENOMINATIONS).toHaveLength(9)
      expect(CHILEAN_DENOMINATIONS[0].value).toBe(20000)
      expect(CHILEAN_DENOMINATIONS[0].type).toBe('bill')
      expect(CHILEAN_DENOMINATIONS[4].value).toBe(1000)
      expect(CHILEAN_DENOMINATIONS[4].type).toBe('bill')
      expect(CHILEAN_DENOMINATIONS[5].value).toBe(500)
      expect(CHILEAN_DENOMINATIONS[5].type).toBe('coin')
      expect(CHILEAN_DENOMINATIONS[8].value).toBe(10)
      expect(CHILEAN_DENOMINATIONS[8].type).toBe('coin')
    })

    it('calcula correctamente el efectivo contado total desde el conteo de billetes y monedas', () => {
      const counts = {
        20000: 2, // 40.000
        10000: 1, // 10.000
        5000: 3,  // 15.000
        1000: 5,  // 5.000
        500: 4,   // 2.000
        100: 10   // 1.000
      }
      // 40.000 + 10.000 + 15.000 + 5.000 + 2.000 + 1.000 = 73.000
      expect(calculateCountedCash(counts)).toBe(73000)
    })

    it('devuelve 0 si no se ingresaron billetes o monedas', () => {
      expect(calculateCountedCash({})).toBe(0)
      expect(calculateCountedCash(null as any)).toBe(0)
    })

    it('genera un desglose detallado con subtotales por denominación', () => {
      const counts = {
        20000: 2,
        500: 4
      }
      const breakdown = calculateDenominationBreakdown(counts)
      expect(breakdown).toHaveLength(9)

      const b20k = breakdown.find((b) => b.value === 20000)
      expect(b20k).toBeDefined()
      expect(b20k?.count).toBe(2)
      expect(b20k?.subtotal).toBe(40000)

      const c500 = breakdown.find((b) => b.value === 500)
      expect(c500).toBeDefined()
      expect(c500?.count).toBe(4)
      expect(c500?.subtotal).toBe(2000)

      const b10k = breakdown.find((b) => b.value === 10000)
      expect(b10k?.count).toBe(0)
      expect(b10k?.subtotal).toBe(0)
    })
  })

  describe('Ventas y Cobro', () => {
    it('calcula el total monetario y unidades de un carrito', () => {
      const items = [
        { unit_price: 3500, quantity: 2 }, // 7.000
        { unit_price: 1200, quantity: 5 }, // 6.000
        { unit_price: 990, quantity: 1 }   // 990
      ]
      const result = calculateCartTotal(items)
      expect(result.totalAmount).toBe(13990)
      expect(result.totalItems).toBe(8)
    })

    it('maneja carrito vacío de forma segura', () => {
      expect(calculateCartTotal([])).toEqual({ totalAmount: 0, totalItems: 0 })
    })

    it('calcula vuelto y suficiencia de pago correctamente', () => {
      // Pago exacto
      const exact = calculatePaymentChange(15000, 15000)
      expect(exact.change).toBe(0)
      expect(exact.isSufficient).toBe(true)
      expect(exact.difference).toBe(0)

      // Pago con vuelto
      const withChange = calculatePaymentChange(15000, 20000)
      expect(withChange.change).toBe(5000)
      expect(withChange.isSufficient).toBe(true)
      expect(withChange.difference).toBe(5000)

      // Pago insuficiente
      const insufficient = calculatePaymentChange(15000, 10000)
      expect(insufficient.change).toBe(0)
      expect(insufficient.isSufficient).toBe(false)
      expect(insufficient.difference).toBe(-5000)
    })
  })

  describe('Arqueo de Caja y Diferencias', () => {
    it('calcula el efectivo esperado sumando fondo y ventas en efectivo y restando devoluciones y salidas', () => {
      // Apertura: 50.000, Ventas Efectivo: 120.000, Devoluciones Efectivo: 10.000, Salidas: 15.000
      // Esperado: 50.000 + 120.000 - 10.000 - 15.000 = 145.000
      const expected = calculateExpectedCash(50000, 120000, 10000, 15000)
      expect(expected).toBe(145000)
    })

    it('determina si la caja está cuadrada (balanced), con sobrante (surplus) o con faltante (shortage)', () => {
      // Cuadrada
      const balanced = calculateCashDifference(100000, 100000)
      expect(balanced.difference).toBe(0)
      expect(balanced.status).toBe('balanced')

      // Sobrante
      const surplus = calculateCashDifference(105000, 100000)
      expect(surplus.difference).toBe(5000)
      expect(surplus.status).toBe('surplus')

      // Faltante
      const shortage = calculateCashDifference(95000, 100000)
      expect(shortage.difference).toBe(-5000)
      expect(shortage.status).toBe('shortage')
    })

    it('calcula ventas netas descontando devoluciones brutas', () => {
      expect(calculateNetSales(250000, 25000)).toBe(225000)
      expect(calculateNetSales(100000, 0)).toBe(100000)
    })
  })
})
