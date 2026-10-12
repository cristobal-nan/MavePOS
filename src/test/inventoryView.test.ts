import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InventoryView } from '../renderer/src/views/InventoryView'
import { CancelAdjustmentModal } from '../renderer/src/components/CancelAdjustmentModal'
import { AdjustmentRulesHelpModal } from '../renderer/src/components/AdjustmentRulesHelpModal'
import { AdjustmentCancellationPreview } from '@shared/types'

// Mock de window.api para el entorno Node/Vitest
beforeEach(() => {
  // @ts-ignore
  global.window = global.window || {}
  // @ts-ignore
  global.window.api = {
    getAllSettings: vi.fn().mockResolvedValue({}),
    getProductByCode: vi.fn().mockResolvedValue(null),
    searchProducts: vi.fn().mockResolvedValue([])
  }
})

// Mock de store
vi.mock('../renderer/src/store/inventoryStore', () => ({
  useInventoryStore: Object.assign(
    () => ({
      activeTab: 'adjust',
      setActiveTab: vi.fn(),
      selectedProduct: {
        id: 1,
        code: 'HIL-BLA',
        name: 'Hilo Blanco 100m',
        sale_price: 1500,
        stock: 10,
        min_stock: 5,
        product_type: 'simple',
        category_name: 'Hilos'
      },
      setSelectedProduct: vi.fn(),
      lowStockProducts: [
        {
          id: 2,
          code: 'CRO-30',
          name: 'Crochet 3.0mm',
          sale_price: 2500,
          stock: 2,
          min_stock: 5,
          product_type: 'simple',
          category_name: 'Accesorios'
        }
      ],
      fetchLowStock: vi.fn(),
      movements: [
        {
          id: 1,
          type: 'ajuste',
          product_code: 'HIL-BLA',
          product_name: 'Hilo Blanco 100m',
          delta: 5,
          stock_before: 5,
          stock_after: 10,
          reason: 'Conteo físico',
          created_at: '2026-10-12T10:00:00.000Z'
        }
      ],
      fetchMovements: vi.fn(),
      selectedDate: '2026-10-12',
      setSelectedDate: vi.fn(),
      selectedMovementType: 'all',
      setSelectedMovementType: vi.fn(),
      kardexProduct: null,
      setKardexProduct: vi.fn(),
      kardexMovements: [],
      recentAdjustments: [],
      fetchRecentAdjustments: vi.fn(),
      updateMovementReason: vi.fn(),
      getAdjustmentCancellationPreview: vi.fn(),
      cancelAdjustment: vi.fn(),
      adjustStock: vi.fn(),
      isLoading: false
    }),
    {
      getState: () => ({
        activeTab: 'adjust',
        setActiveTab: vi.fn(),
        selectedProduct: null,
        lowStockProducts: [],
        movements: [],
        kardexMovements: [],
        kardexProduct: null,
        recentAdjustments: [],
        selectedDate: '2026-10-12',
        selectedMovementType: 'all',
        isLoading: false
      }),
      setState: vi.fn()
    }
  )
}))

describe('Auditoría UI Pantalla 3: Control de Inventario y Kardex (InventoryView y modales asociados)', () => {
  it('renderiza InventoryView con ViewHeader canónico y botón de acción de reglas', () => {
    const html = renderToStaticMarkup(React.createElement(InventoryView))

    // Cabecera canónica
    expect(html).toContain('Control de Inventario')
    expect(html).toContain('Reglas de Ajuste')
  })

  it('renderiza SubTabs canónicas con roles ARIA y badge tabular-nums en Stock Bajo', () => {
    const html = renderToStaticMarkup(React.createElement(InventoryView))

    // SubTabs con role tablist y tab
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('Ajustar Existencia')
    expect(html).toContain('Stock Bajo')
    expect(html).toContain('Movimientos por Día')
    expect(html).toContain('Kardex de Producto')

    // Badge de stock bajo con tabular-nums
    expect(html).toContain('tabular-nums')
    expect(html).toContain('1 alerta')
  })

  it('renderiza formulario de ajuste con tabular-nums y EmptyState canónico en ajustes recientes vacíos', () => {
    const html = renderToStaticMarkup(React.createElement(InventoryView))

    // Formulario de ajuste
    expect(html).toContain('Código del Producto')
    expect(html).toContain('Precio Venta')
    expect(html).toContain('Cantidad Actual')
    expect(html).toContain('Nueva Cantidad')
    expect(html).toContain('Motivo del ajuste')

    // EmptyState canónico en tarjeta lateral de últimos 5 ajustes
    expect(html).toContain('Sin ajustes recientes')
    expect(html).toContain('Los ajustes que realices aparecerán aquí al instante.')
  })

  it('CancelAdjustmentModal cumple con semántica ARIA dialog, tabular-nums y botón de confirmación', () => {
    const mockPreview: AdjustmentCancellationPreview = {
      movement_id: 1,
      product_code: 'HIL-BLA',
      product_name: 'Hilo Blanco 100m',
      current_stock: 10,
      total_delta: 5,
      projected_stock: 5,
      can_cancel: true,
      movements_to_revert: [
        {
          id: 1,
          created_at: '2026-10-12T10:00:00.000Z',
          delta: 5,
          reason: 'Conteo físico anual'
        }
      ]
    }

    const html = renderToStaticMarkup(
      React.createElement(CancelAdjustmentModal, {
        isOpen: true,
        preview: mockPreview,
        onClose: vi.fn(),
        onConfirm: vi.fn().mockResolvedValue(undefined)
      })
    )

    // Dialog ARIA y título
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="cancel-adj-title"')
    expect(html).toContain('Confirmar Cancelación de Ajuste')

    // Resumen de impacto de stock con tabular-nums
    expect(html).toContain('Stock Actual')
    expect(html).toContain('10 un.')
    expect(html).toContain('Reversión Total')
    expect(html).toContain('-5 un.')
    expect(html).toContain('Stock Resultante')
    expect(html).toContain('5 un.')
    expect(html).toContain('tabular-nums')
    expect(html).toContain('Confirmar Cancelación')
  })

  it('AdjustmentRulesHelpModal cumple con semántica ARIA dialog y diseño sin clichés de IA', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdjustmentRulesHelpModal, {
        isOpen: true,
        onClose: vi.fn()
      })
    )

    // Dialog ARIA y título
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="adj-rules-title"')
    expect(html).toContain('Cancelación de Ajustes y Edición de Motivos')
    expect(html).toContain('Guía Operativa')
    expect(html).toContain('1. Edición de Motivos de Ajuste')
    expect(html).toContain('2. Cancelación de Ajustes en Cascada')
    expect(html).toContain('Entendido')
  })
})
