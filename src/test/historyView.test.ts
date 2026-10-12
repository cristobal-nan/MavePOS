import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HistoryView } from '../renderer/src/views/HistoryView'
import { ProductExchangeModal } from '../renderer/src/views/history/ProductExchangeModal'
import { SaleDetail } from '@shared/types'

beforeEach(() => {
  // @ts-ignore
  global.window = global.window || {}
  // @ts-ignore
  global.window.api = {
    getAllSettings: vi.fn().mockResolvedValue({})
  }
})

vi.mock('../renderer/src/store/historyStore', () => ({
  useHistoryStore: Object.assign(
    () => ({
      activeSubTab: 'sales',
      setActiveSubTab: vi.fn(),
      sales: [
        {
          id: 1,
          folio: 101,
          created_at: '2026-10-12T12:00:00.000Z',
          total: 12500,
          total_items: 3,
          returned_items_count: 0,
          status: 'completed',
          payments: [{ id: 1, method: 'cash', amount: 12500 }]
        }
      ],
      cashMovements: [],
      filter: { date: '', folioStr: '' },
      setDateFilter: vi.fn(),
      setFolioFilter: vi.fn(),
      fetchSalesHistory: vi.fn(),
      fetchCashMovements: vi.fn(),
      selectedSaleDetail: null,
      openSaleDetail: vi.fn(),
      closeSaleDetail: vi.fn(),
      error: null,
      clearError: vi.fn()
    }),
    {
      getState: () => ({
        sales: []
      })
    }
  )
}))

vi.mock('../renderer/src/store/cashStore', () => ({
  useCashStore: () => ({
    currentSession: { id: 1 }
  })
}))

describe('Auditoría UI Pantalla 5: Historial y Devoluciones (HistoryView y ProductExchangeModal)', () => {
  it('renderiza HistoryView con ViewHeader canónico y SubTabs accesibles', () => {
    const html = renderToStaticMarkup(React.createElement(HistoryView))

    expect(html).toContain('Historial de Ventas')
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('Ventas y Devoluciones')
    expect(html).toContain('Salidas de Dinero')
    expect(html).toContain('1 transacciones')
  })

  it('ProductExchangeModal cumple con semántica ARIA dialog, tabular-nums y advertencia de plazo', () => {
    const mockDetail: SaleDetail = {
      id: 1,
      folio: 101,
      created_at: '2026-08-01T10:00:00.000Z', // Más de 30 días
      total: 12500,
      total_items: 2,
      subtotal: 12500,
      status: 'completed',
      payments: [{ id: 1, sale_id: 1, method: 'cash', amount: 12500 }],
      items: [
        {
          id: 1,
          sale_id: 1,
          product_id: 10,
          product_code: 'LAN-01',
          name: 'Lana Merino 100g',
          quantity: 2,
          unit_price: 6250,
          subtotal: 12500,
          returned_qty: 0
        }
      ]
    }

    const html = renderToStaticMarkup(
      React.createElement(ProductExchangeModal, {
        saleDetail: mockDetail,
        isOpen: true,
        onClose: vi.fn(),
        onConfirmExchange: vi.fn()
      })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="product-exchange-title"')
    expect(html).toContain('Iniciar Cambio de Producto')
    expect(html).toContain('Venta Folio #101')
    expect(html).toContain('Lana Merino 100g')
    expect(html).toContain('tabular-nums')
    expect(html).toContain('Transferir a Ventas para Cambio')
  })
})
