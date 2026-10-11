import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { useCashStore, DEFAULT_CASH_CUT_DRAFT } from '../renderer/src/store/cashStore'

describe('CashStore — Persistencia del Borrador de Corte de Turno Actual', () => {
  const originalLocalStorage = globalThis.localStorage
  let storageMock: Record<string, string> = {}

  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (key: string) => storageMock[key] ?? null,
      setItem: (key: string, val: string) => {
        storageMock[key] = String(val)
      },
      removeItem: (key: string) => {
        delete storageMock[key]
      },
      clear: () => {
        storageMock = {}
      },
      key: () => null,
      length: 0
    } as any
  })

  afterAll(() => {
    globalThis.localStorage = originalLocalStorage
  })

  beforeEach(() => {
    storageMock = {}
    useCashStore.setState({
      currentSession: {
        id: 123,
        opened_at: new Date().toISOString(),
        opening_fund: 50000,
        status: 'open'
      } as any,
      activeCutDraft: {
        ...DEFAULT_CASH_CUT_DRAFT,
        denominationCounts: { ...DEFAULT_CASH_CUT_DRAFT.denominationCounts }
      }
    })
  })

  it('inicia con el borrador de corte por defecto', () => {
    const draft = useCashStore.getState().activeCutDraft
    expect(draft.notes).toBe('')
    expect(draft.cardMachineInput).toBe('')
    expect(draft.transferVerifiedInput).toBe('')
    expect(draft.denominationCounts[20000]).toBe(0)
    expect(draft.denominationCounts[1000]).toBe(0)
  })

  it('actualiza y persiste denominaciones en el borrador', () => {
    const { setDenominationCount } = useCashStore.getState()

    setDenominationCount(20000, 5)
    setDenominationCount(10000, 3)
    setDenominationCount(500, 10)

    const state = useCashStore.getState()
    expect(state.activeCutDraft.denominationCounts[20000]).toBe(5)
    expect(state.activeCutDraft.denominationCounts[10000]).toBe(3)
    expect(state.activeCutDraft.denominationCounts[500]).toBe(10)

    // Verifica que se haya guardado en localStorage bajo la sesión 123
    const savedRaw = localStorage.getItem('cash_cut_draft_123')
    expect(savedRaw).not.toBeNull()
    const saved = JSON.parse(savedRaw!)
    expect(saved.denominationCounts[20000]).toBe(5)
  })

  it('actualiza y persiste observaciones, máquina POS y banco', () => {
    const { setCutNotes, setCardMachineInput, setTransferVerifiedInput } = useCashStore.getState()

    setCutNotes('Turno cuadrado con $50 de diferencia en monedas')
    setCardMachineInput('150000')
    setTransferVerifiedInput('45000')

    const state = useCashStore.getState()
    expect(state.activeCutDraft.notes).toBe('Turno cuadrado con $50 de diferencia en monedas')
    expect(state.activeCutDraft.cardMachineInput).toBe('150000')
    expect(state.activeCutDraft.transferVerifiedInput).toBe('45000')

    const savedRaw = localStorage.getItem('cash_cut_draft_123')
    const saved = JSON.parse(savedRaw!)
    expect(saved.notes).toBe('Turno cuadrado con $50 de diferencia en monedas')
    expect(saved.cardMachineInput).toBe('150000')
    expect(saved.transferVerifiedInput).toBe('45000')
  })

  it('conserva el borrador intacto entre navegaciones de pestañas o consultas de resumen', () => {
    // Usuario ingresa datos en corte de caja
    useCashStore.getState().setDenominationCount(20000, 4)
    useCashStore.getState().setCutNotes('Nota previa a cambio de pestaña')
    useCashStore.getState().setCardMachineInput('80000')

    // Simular que el usuario cambia a pestaña Ventas y luego vuelve:
    // El store en memoria retiene los datos intactos
    expect(useCashStore.getState().activeCutDraft.denominationCounts[20000]).toBe(4)
    expect(useCashStore.getState().activeCutDraft.notes).toBe('Nota previa a cambio de pestaña')
    expect(useCashStore.getState().activeCutDraft.cardMachineInput).toBe('80000')
  })

  it('resetCutDraft limpia el borrador en memoria y en localStorage', () => {
    useCashStore.getState().setDenominationCount(20000, 2)
    useCashStore.getState().setCutNotes('Nota temporal')
    expect(localStorage.getItem('cash_cut_draft_123')).not.toBeNull()

    useCashStore.getState().resetCutDraft()

    const draft = useCashStore.getState().activeCutDraft
    expect(draft.denominationCounts[20000]).toBe(0)
    expect(draft.notes).toBe('')
    expect(localStorage.getItem('cash_cut_draft_123')).toBeNull()
  })
})
