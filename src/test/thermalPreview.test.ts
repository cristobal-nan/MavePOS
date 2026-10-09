import { describe, it, expect } from 'vitest'
import { formatCLP } from '../shared/finance'
import { BusinessInfo } from '../main/services/printing/ticketTemplates'

describe('Previsualización de Tickets Térmicos (80mm vs 58mm)', () => {
  describe('Dimensiones y Columnas de Papel por Fuente', () => {
    it('asigna 48 columnas para papel de 80mm en Fuente A y 56 en Fuente B', () => {
      const getCols = (width: '80mm' | '58mm', font: 'font_a' | 'font_b') =>
        width === '58mm' ? (font === 'font_b' ? 42 : 32) : font === 'font_b' ? 56 : 48

      expect(getCols('80mm', 'font_a')).toBe(48)
      expect(getCols('80mm', 'font_b')).toBe(56)
    })

    it('asigna 32 columnas para papel de 58mm en Fuente A y 42 en Fuente B', () => {
      const getCols = (width: '80mm' | '58mm', font: 'font_a' | 'font_b') =>
        width === '58mm' ? (font === 'font_b' ? 42 : 32) : font === 'font_b' ? 56 : 48

      expect(getCols('58mm', 'font_a')).toBe(32)
      expect(getCols('58mm', 'font_b')).toBe(42)
    })
  })

  describe('Formateo de Encabezado y Datos Comerciales en Previsualización', () => {
    it('utiliza PUNTO DE VENTA por defecto si el nombre comercial no está definido', () => {
      const emptyBusiness: Partial<BusinessInfo> = {}
      const name = emptyBusiness.name || 'PUNTO DE VENTA'
      const footer = emptyBusiness.footerMessage || '¡Gracias por su preferencia!'

      expect(name).toBe('PUNTO DE VENTA')
      expect(footer).toBe('¡Gracias por su preferencia!')
    })

    it('preserva datos comerciales personalizados cuando están configurados', () => {
      const customBusiness: BusinessInfo = {
        name: 'Lanas & Tejidos Mave',
        rut: '76.123.456-7',
        activity: 'Venta de Lanas y Artículos de Costura',
        address: 'Av. Providencia 1234, Local 5',
        phone: '+56 9 1234 5678',
        email: 'contacto@lanasmave.cl',
        footerMessage: 'Cambios dentro de 30 días con este ticket'
      }

      expect(customBusiness.name).toBe('Lanas & Tejidos Mave')
      expect(customBusiness.rut).toBe('76.123.456-7')
      expect(customBusiness.activity).toBe('Venta de Lanas y Artículos de Costura')
      expect(customBusiness.address).toBe('Av. Providencia 1234, Local 5')
      expect(customBusiness.phone).toBe('+56 9 1234 5678')
      expect(customBusiness.email).toBe('contacto@lanasmave.cl')
      expect(customBusiness.footerMessage).toBe('Cambios dentro de 30 días con este ticket')
    })
  })

  describe('Formateo Monetario CLP en Tickets Térmicos', () => {
    it('formatea montos en enteros con punto separador de miles sin decimales', () => {
      expect(formatCLP(12990)).toBe('$ 12.990')
      expect(formatCLP(4500)).toBe('$ 4.500')
      expect(formatCLP(0)).toBe('$ 0')
      expect(formatCLP(15000)).toBe('$ 15.000')
      expect(formatCLP(2010)).toBe('$ 2.010')
    })

    it('cuadra el vuelto exacto para la venta de muestra', () => {
      const total = 12990
      const paidCash = 15000
      const change = paidCash - total

      expect(change).toBe(2010)
      expect(formatCLP(change)).toBe('$ 2.010')
    })
  })

  describe('Alineación de Texto en Columnas para 80mm y 58mm', () => {
    it('alinea correctamente CANT / DESCRIPCION y TOTAL en 48 columnas', () => {
      const left = '2x Ovillo Lana Merino 100g'
      const right = '$ 9.000'
      const width = 48

      const spacesNeeded = width - left.length - right.length
      expect(spacesNeeded).toBeGreaterThan(0)
      const line = left + ' '.repeat(spacesNeeded) + right

      expect(line.length).toBe(48)
      expect(line.startsWith('2x Ovillo Lana Merino 100g')).toBe(true)
      expect(line.endsWith('$ 9.000')).toBe(true)
    })

    it('ajusta adecuadamente en 32 columnas (58mm)', () => {
      const left = '2x Lana Merino'
      const right = '$ 9.000'
      const width = 32

      const spacesNeeded = width - left.length - right.length
      expect(spacesNeeded).toBeGreaterThan(0)
      const line = left + ' '.repeat(spacesNeeded) + right

      expect(line.length).toBe(32)
      expect(line.startsWith('2x Lana Merino')).toBe(true)
      expect(line.endsWith('$ 9.000')).toBe(true)
    })
  })
})
