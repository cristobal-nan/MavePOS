import { describe, it, expect } from 'vitest'
import { formatCLP, parseCLP, formatPaymentMethods, capitalizeWords } from '../renderer/src/utils/formatters'

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
})
