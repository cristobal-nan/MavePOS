import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CheckoutModal } from '../renderer/src/components/CheckoutModal'

// Mock stores
vi.mock('../renderer/src/store/cashStore', () => ({
  useCashStore: () => ({
    currentSession: { id: 1, initial_amount: 50000, current_amount: 50000, status: 'open' }
  })
}))

vi.mock('../renderer/src/store/salesStore', () => ({
  useSalesStore: () => ({
    finalizeSale: vi.fn()
  })
}))

describe('Auditoría UI Pantalla 1: CheckoutModal (Ventas y Cobro)', () => {
  it('renderiza modal accesible con role="dialog", aria-modal="true" y título vinculado', () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutModal, {
        isOpen: true,
        totalAmount: 15990,
        onClose: () => {},
        onSuccess: () => {}
      })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="checkout-modal-title"')
    expect(html).toContain('id="checkout-modal-title"')
    expect(html).toContain('Cobro de Venta')
  })

  it('incluye selector de métodos de pago con role="tablist" y tabs accesibles', () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutModal, {
        isOpen: true,
        totalAmount: 12000,
        onClose: () => {},
        onSuccess: () => {}
      })
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('Efectivo')
    expect(html).toContain('Tarjeta')
    expect(html).toContain('Transf.')
    expect(html).toContain('Mixto')
  })

  it('aplica tabular-nums a importes monetarios y banner de total', () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutModal, {
        isOpen: true,
        totalAmount: 18500,
        onClose: () => {},
        onSuccess: () => {}
      })
    )

    expect(html).toContain('tabular-nums')
    expect(html).toContain('$ 18.500')
  })

  it('incluye focus-visible accesible con anillo temático en botones y controles', () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutModal, {
        isOpen: true,
        totalAmount: 9990,
        onClose: () => {},
        onSuccess: () => {}
      })
    )

    expect(html).toContain('focus-visible:ring-2')
    expect(html).toContain('focus-visible:ring-lilac-500')
    expect(html).toContain('focus-visible:outline-none')
  })

  it('no renderiza nada cuando isOpen es false', () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutModal, {
        isOpen: false,
        totalAmount: 5000,
        onClose: () => {},
        onSuccess: () => {}
      })
    )

    expect(html).toBe('')
  })
})
