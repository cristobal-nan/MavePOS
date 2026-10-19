import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CashCutView } from '../renderer/src/views/CashCutView'
import { DenominationsCalculator } from '../renderer/src/views/cashCut/DenominationsCalculator'
import { ConfirmCashCutModal } from '../renderer/src/views/cashCut/ConfirmCashCutModal'
import { ReceiptCashCutModal } from '../renderer/src/views/cashCut/ReceiptCashCutModal'

beforeEach(() => {
  // @ts-ignore
  global.window = global.window || {}
  // @ts-ignore
  global.window.api = {
    getAllSettings: vi.fn().mockResolvedValue({}),
    devices: {
      printCashCut: vi.fn().mockResolvedValue({ success: true })
    }
  }
})

vi.mock('../renderer/src/store/cashStore', () => ({
  useCashStore: Object.assign(
    () => ({
      currentSession: {
        id: 1,
        opened_at: '2026-10-12T09:00:00.000Z',
        opening_fund: 50000,
        status: 'open',
        opening_denominations: JSON.stringify({ 20000: 2, 10000: 1 })
      },
      currentSummary: {
        sessionId: 1,
        expectedCash: 80000,
        salesCash: 30000,
        salesCard: 25000,
        salesTransfer: 15000,
        salesTotal: 70000,
        salesCount: 10,
        returnsCount: 0,
        returnsTotal: 0,
        withdrawalsCount: 0,
        withdrawalsTotal: 0,
        netSales: 70000
      },
      pastSessions: [],
      fetchSummary: vi.fn(),
      fetchPastSessions: vi.fn(),
      error: null,
      clearError: vi.fn(),
      activeCutDraft: {
        denominationCounts: { 20000: 3, 10000: 2 },
        notes: '',
        cardMachineInput: '',
        transferVerifiedInput: ''
      },
      resetCutDraft: vi.fn(),
      closeSession: vi.fn(),
      discardSession: vi.fn(),
      setCompletedCutReceipt: vi.fn(),
      setDenominationCount: vi.fn(),
      setCutNotes: vi.fn(),
      setCardMachineInput: vi.fn(),
      setTransferVerifiedInput: vi.fn()
    }),
    {
      getState: () => ({
        fetchSummary: vi.fn()
      })
    }
  )
}))

describe('Auditoría UI Pantalla 4: Corte de Caja y Arqueo (CashCutView y componentes)', () => {
  it('renderiza CashCutView con ViewHeader canónico y SubTabs accesibles', () => {
    const html = renderToStaticMarkup(React.createElement(CashCutView))

    expect(html).toContain('Corte de Caja')
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('Corte de Turno Actual')
    expect(html).toContain('Registros Diarios')
  })

  it('DenominationsCalculator renderiza en formato 3 columnas con tabular-nums y sin border-black', () => {
    const counts = { 20000: 2, 10000: 1 }
    const html = renderToStaticMarkup(
      React.createElement(DenominationsCalculator, {
        title: 'Cierre de turno',
        subtitle: 'Ingresa la cantidad física en gaveta para cuadrar',
        denominationCounts: counts,
        readOnly: false
      })
    )

    expect(html).toContain('Cierre de turno')
    expect(html).toContain('Denominación')
    expect(html).toContain('Cantidad')
    expect(html).toContain('Total')
    expect(html).toContain('tabular-nums')
    expect(html).not.toContain('border-black')
  })

  it('ConfirmCashCutModal cumple con semántica ARIA dialog y tabular-nums en montos', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmCashCutModal, {
        isOpen: true,
        sessionId: 1,
        countedCash: 80000,
        expectedCash: 80000,
        difference: 0,
        isClosing: false,
        onClose: vi.fn(),
        onConfirm: vi.fn()
      })
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="confirm-cash-cut-title"')
    expect(html).toContain('¿Confirmar Corte y Cierre de Turno?')
    expect(html).toContain('tabular-nums')
    expect(html).toContain('Cuadrada ($0)')
  })

  it('ReceiptCashCutModal mantiene comprobante inmutable thermal-ticket-paper', () => {
    const receiptData = {
      sessionId: 1,
      closedAt: '2026-10-12T18:00:00.000Z',
      openingFund: 50000,
      salesCash: 30000,
      salesCard: 25000,
      salesTransfer: 15000,
      salesTotal: 70000,
      closingCash: 80000,
      expectedCash: 80000,
      difference: 0
    }

    const html = renderToStaticMarkup(
      React.createElement(ReceiptCashCutModal, {
        isOpen: true,
        data: receiptData,
        onClose: vi.fn()
      })
    )

    expect(html).toContain('thermal-ticket-paper')
    expect(html).toContain('bg-white')
    expect(html).toContain('Fondo Inicial:')
    expect(html).toContain('Total Ventas:')
    expect(html).toContain('Imprimir Comprobante')
  })

  it('DenominationsCalculator y ActiveCashCutTab exponen inputs con IDs y referencias para navegación secuencial con Enter', () => {
    const lastRef = React.createRef<HTMLInputElement>()
    const onLastEnter = vi.fn()

    const calcHtml = renderToStaticMarkup(
      React.createElement(DenominationsCalculator, {
        title: 'Cierre de turno',
        denominationCounts: { 20000: 1 },
        readOnly: false,
        onLastEnter,
        lastInputRef: lastRef
      })
    )

    // Los 9 inputs de denominaciones existen
    expect(calcHtml).toContain('aria-label="Cantidad de $20.000"')
    expect(calcHtml).toContain('aria-label="Cantidad de $10"')

    // La vista completa de corte incluye card-machine-input y el textarea de observaciones
    const cutHtml = renderToStaticMarkup(React.createElement(CashCutView))
    expect(cutHtml).toContain('id="card-machine-input"')
    expect(cutHtml).toContain('id="transfer-verified-input"')
    expect(cutHtml).toContain('placeholder="Detalles sobre diferencias, incidencias o comentarios del turno (opcional)..."')
  })
})

