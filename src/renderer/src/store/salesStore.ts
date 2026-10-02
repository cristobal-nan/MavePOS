import { create } from 'zustand'
import { CartItem, CompleteSaleInput, CompletedSaleResult, ExchangeInfo, LastSaleInfo } from '@shared/types'
import { formatPaymentMethods } from '../utils/formatters'

export interface Ticket {
  id?: number // Database sale id if saved as pending
  ticketIndex: number
  label: string
  items: CartItem[]
  exchangeInfo?: ExchangeInfo
}

interface SalesState {
  tickets: Ticket[]
  activeTicketIndex: number
  isLoading: boolean
  error: string | null

  isInitialized: boolean
  initializedSessionId: number | null
  lastSale: LastSaleInfo | null

  // Actions
  loadPendingTickets: (cashSessionId?: number, force?: boolean) => Promise<void>
  createTicket: (cashSessionId?: number) => Promise<void>
  createExchangeTicket: (exchangeInfo: ExchangeInfo, cashSessionId?: number) => Promise<void>
  selectTicket: (index: number) => void
  addItem: (product: { code: string; name: string; sale_price: number; stock: number; variant_label?: string | null }, qty?: number) => void
  updateQuantity: (productCode: string, qty: number) => void
  removeItem: (productCode: string) => void
  clearCart: () => void
  putTicketOnStandby: (cashSessionId: number) => Promise<void>
  deleteTicket: (index: number) => Promise<void>
  finalizeSale: (input: Omit<CompleteSaleInput, 'saleId' | 'items'>) => Promise<CompletedSaleResult>
  fetchLastSale: (cashSessionId?: number) => Promise<void>
  setLastSale: (sale: LastSaleInfo | null) => void
}

function getInitialLastSale(): LastSaleInfo | null {
  try {
    const raw = localStorage.getItem('last_sale_info')
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

export const useSalesStore = create<SalesState>((set, get) => ({
  tickets: [
    { ticketIndex: 1, label: 'Ticket #1', items: [] }
  ],
  activeTicketIndex: 0,
  isLoading: false,
  error: null,
  isInitialized: false,
  initializedSessionId: null,
  lastSale: getInitialLastSale(),

  setLastSale: (sale: LastSaleInfo | null) => set({ lastSale: sale }),

  fetchLastSale: async (cashSessionId?: number) => {
    if (!window?.api?.sales?.getHistory) return
    try {
      const history = await window.api.sales.getHistory({
        limit: 1,
        status: 'completed',
        cashSessionId
      })
      if (history && history.length > 0) {
        const s = history[0]
        let change: number | null = null
        try {
          const raw = localStorage.getItem('last_sale_info')
          if (raw) {
            const cached = JSON.parse(raw) as LastSaleInfo
            if (cached.folio === s.folio || cached.ticket_number === s.ticket_number) {
              change = cached.change ?? null
            }
          }
        } catch {
          // ignore
        }

        const info: LastSaleInfo = {
          folio: s.folio,
          ticket_number: s.ticket_number,
          paymentMethod: formatPaymentMethods(s.payments || []),
          totalItems: s.total_items || 0,
          totalAmount: s.total,
          change,
          completedAt: s.completed_at || s.created_at
        }
        set({ lastSale: info })
      }
    } catch (err) {
      console.error('Error obteniendo última venta:', err)
    }
  },

  loadPendingTickets: async (cashSessionId?: number, force = false) => {
    const { isInitialized, initializedSessionId } = get()
    const targetSessionId = cashSessionId ?? null

    // If already initialized for this exact session and not forced, preserve active memory tickets!
    if (!force && isInitialized && initializedSessionId === targetSessionId) {
      return
    }

    try {
      set({ isLoading: true })
      const pending = await window.api.sales.getPending(cashSessionId)

      if (pending.length > 0) {
        const loadedTickets: Ticket[] = pending.map((p) => ({
          id: p.id,
          ticketIndex: p.ticket_number,
          label: `Ticket #${p.ticket_number}`,
          items: p.items
        }))
        loadedTickets.sort((a, b) => a.ticketIndex - b.ticketIndex)
        set({
          tickets: loadedTickets,
          activeTicketIndex: 0,
          isLoading: false,
          isInitialized: true,
          initializedSessionId: targetSessionId
        })
      } else {
        // Start with a clean ticket matching the first available non-sold ticket number (starting at 1 for this session)
        const initialIndex = await window.api.sales.getNextTicketNumber([], cashSessionId)
        set({
          tickets: [{ ticketIndex: initialIndex, label: `Ticket #${initialIndex}`, items: [] }],
          activeTicketIndex: 0,
          isLoading: false,
          isInitialized: true,
          initializedSessionId: targetSessionId
        })
      }

      // Sincronizar última venta registrada
      get().fetchLastSale(targetSessionId ?? undefined)
    } catch (err: any) {
      console.error('Error cargando ventas pendientes:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  createTicket: async (cashSessionId?: number) => {
    const { tickets } = get()
    try {
      // Find the first integer starting from 0 that is neither in sales (DB) for this session nor open in memory
      const openTickets = tickets.map((t) => t.ticketIndex)
      const nextIdx = await window.api.sales.getNextTicketNumber(openTickets, cashSessionId)
      const newTicket: Ticket = {
        ticketIndex: nextIdx,
        label: `Ticket #${nextIdx}`,
        items: []
      }
      const allTickets = [...tickets, newTicket].sort((a, b) => a.ticketIndex - b.ticketIndex)
      const newActiveIdx = allTickets.findIndex((t) => t.ticketIndex === nextIdx)
      set({
        tickets: allTickets,
        activeTicketIndex: newActiveIdx >= 0 ? newActiveIdx : allTickets.length - 1,
        isInitialized: true,
        initializedSessionId: cashSessionId ?? null
      })
    } catch (err: any) {
      console.error('Error creando nuevo ticket:', err)
    }
  },

  createExchangeTicket: async (exchangeInfo: ExchangeInfo, cashSessionId?: number) => {
    let { tickets, isInitialized } = get()
    try {
      // If store hasn't loaded pending tickets yet, load them first
      if (!isInitialized) {
        await get().loadPendingTickets(cashSessionId)
        tickets = get().tickets
      }

      // If there is only 1 ticket and it's completely empty and not persisted/exchange, replace it directly
      if (tickets.length === 1 && tickets[0].items.length === 0 && !tickets[0].id && !tickets[0].exchangeInfo) {
        const newTicket: Ticket = {
          ticketIndex: tickets[0].ticketIndex,
          label: `CAMBIO (Venta #${exchangeInfo.originalFolio})`,
          items: [],
          exchangeInfo
        }
        set({
          tickets: [newTicket],
          activeTicketIndex: 0,
          isInitialized: true,
          initializedSessionId: cashSessionId ?? null
        })
        return
      }

      const openTickets = tickets.map((t) => t.ticketIndex)
      const nextIdx = await window.api.sales.getNextTicketNumber(openTickets, cashSessionId)
      const newTicket: Ticket = {
        ticketIndex: nextIdx,
        label: `CAMBIO (Venta #${exchangeInfo.originalFolio})`,
        items: [],
        exchangeInfo
      }
      const allTickets = [...tickets, newTicket].sort((a, b) => a.ticketIndex - b.ticketIndex)
      const newActiveIdx = allTickets.findIndex((t) => t.ticketIndex === nextIdx)
      set({
        tickets: allTickets,
        activeTicketIndex: newActiveIdx >= 0 ? newActiveIdx : allTickets.length - 1,
        isInitialized: true,
        initializedSessionId: cashSessionId ?? null
      })
    } catch (err: any) {
      console.error('Error creando ticket de cambio:', err)
    }
  },

  selectTicket: (index: number) => {
    const { tickets } = get()
    if (index >= 0 && index < tickets.length) {
      set({ activeTicketIndex: index })
    }
  },

  addItem: (product, qty = 1) => {
    const { tickets, activeTicketIndex } = get()
    const currentTicket = tickets[activeTicketIndex]
    if (!currentTicket) return

    const existingIndex = currentTicket.items.findIndex((it) => it.product_code === product.code)
    let newItems: CartItem[]

    if (existingIndex >= 0) {
      newItems = currentTicket.items.map((it, idx) => {
        if (idx === existingIndex) {
          return { ...it, quantity: it.quantity + qty }
        }
        return it
      })
    } else {
      newItems = [
        ...currentTicket.items,
        {
          product_code: product.code,
          name: product.name,
          unit_price: product.sale_price,
          quantity: qty,
          stock: product.stock,
          variant_label: product.variant_label
        }
      ]
    }

    const updatedTickets = tickets.map((t, idx) => {
      if (idx === activeTicketIndex) {
        return { ...t, items: newItems }
      }
      return t
    })

    set({ tickets: updatedTickets })
  },

  updateQuantity: (productCode: string, qty: number) => {
    const { tickets, activeTicketIndex } = get()
    const currentTicket = tickets[activeTicketIndex]
    if (!currentTicket) return

    if (qty <= 0) {
      get().removeItem(productCode)
      return
    }

    const newItems = currentTicket.items.map((it) => {
      if (it.product_code === productCode) {
        return { ...it, quantity: qty }
      }
      return it
    })

    const updatedTickets = tickets.map((t, idx) => {
      if (idx === activeTicketIndex) {
        return { ...t, items: newItems }
      }
      return t
    })

    set({ tickets: updatedTickets })
  },

  removeItem: (productCode: string) => {
    const { tickets, activeTicketIndex } = get()
    const currentTicket = tickets[activeTicketIndex]
    if (!currentTicket) return

    const newItems = currentTicket.items.filter((it) => it.product_code !== productCode)

    const updatedTickets = tickets.map((t, idx) => {
      if (idx === activeTicketIndex) {
        return { ...t, items: newItems }
      }
      return t
    })

    set({ tickets: updatedTickets })
  },

  clearCart: () => {
    const { tickets, activeTicketIndex } = get()
    const updatedTickets = tickets.map((t, idx) => {
      if (idx === activeTicketIndex) {
        return { ...t, items: [] }
      }
      return t
    })
    set({ tickets: updatedTickets })
  },

  putTicketOnStandby: async (cashSessionId: number) => {
    const { tickets, activeTicketIndex } = get()
    const currentTicket = tickets[activeTicketIndex]
    if (!currentTicket || currentTicket.items.length === 0) return

    try {
      set({ isLoading: true })
      // Persist in DB with status = pending and requested ticket_number
      const saved = await window.api.sales.savePending({
        id: currentTicket.id,
        ticket_number: currentTicket.ticketIndex,
        cashSessionId,
        items: currentTicket.items
      })

      const updatedCurrentTicket: Ticket = {
        ...currentTicket,
        id: saved.id,
        ticketIndex: saved.ticket_number,
        label: `Ticket #${saved.ticket_number}`
      }

      const updatedTickets = tickets.map((t, idx) => {
        if (idx === activeTicketIndex) return updatedCurrentTicket
        return t
      })

      const openTickets = updatedTickets.map((t) => t.ticketIndex)
      const nextIdx = await window.api.sales.getNextTicketNumber(openTickets, cashSessionId)
      const newEmptyTicket: Ticket = {
        ticketIndex: nextIdx,
        label: `Ticket #${nextIdx}`,
        items: []
      }

      const allTickets = [...updatedTickets, newEmptyTicket].sort((a, b) => a.ticketIndex - b.ticketIndex)
      const newActiveIdx = allTickets.findIndex((t) => t.ticketIndex === nextIdx)

      set({
        tickets: allTickets,
        activeTicketIndex: newActiveIdx >= 0 ? newActiveIdx : allTickets.length - 1,
        isLoading: false
      })
    } catch (err: any) {
      console.error('Error dejando venta en espera:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  deleteTicket: async (index: number) => {
    const { tickets, activeTicketIndex } = get()
    const ticketToDelete = tickets[index]
    if (!ticketToDelete) return

    // If ticket was saved in DB as pending, delete from DB
    if (ticketToDelete.id) {
      try {
        await window.api.sales.deletePending(ticketToDelete.id)
      } catch (err) {
        console.error('Error eliminando venta pendiente de BD:', err)
      }
    }

    if (tickets.length <= 1) {
      // Just clear items if it's the only ticket, reset to standard ticket (clearing exchangeInfo and custom label)
      set({
        tickets: [
          {
            ticketIndex: ticketToDelete.ticketIndex,
            label: `Ticket #${ticketToDelete.ticketIndex}`,
            items: []
          }
        ],
        activeTicketIndex: 0
      })
      return
    }

    const filtered = tickets.filter((_, idx) => idx !== index)
    const nextActive = activeTicketIndex >= filtered.length ? filtered.length - 1 : activeTicketIndex
    set({ tickets: filtered, activeTicketIndex: nextActive })
  },

  finalizeSale: async (input) => {
    const { tickets, activeTicketIndex } = get()
    const currentTicket = tickets[activeTicketIndex]
    if (!currentTicket || currentTicket.items.length === 0) {
      throw new Error('No hay productos en el ticket actual')
    }

    set({ isLoading: true })
    try {
      const result = await window.api.sales.complete({
        ...input,
        saleId: currentTicket.id,
        ticket_number: currentTicket.ticketIndex,
        exchangeInfo: currentTicket.exchangeInfo,
        items: currentTicket.items.map((it) => ({
          product_code: it.product_code,
          name: it.name,
          unit_price: it.unit_price,
          quantity: it.quantity
        }))
      })

      const totalItems = currentTicket.items.reduce((sum, it) => sum + it.quantity, 0)
      const lastSaleInfo: LastSaleInfo = {
        folio: result.sale.folio,
        ticket_number: result.sale.ticket_number,
        paymentMethod: formatPaymentMethods(result.payments || []),
        totalItems,
        totalAmount: result.sale.total,
        change: result.change,
        completedAt: result.sale.completed_at || result.sale.created_at
      }

      try {
        localStorage.setItem('last_sale_info', JSON.stringify(lastSaleInfo))
      } catch {
        // ignore
      }

      // Clean or remove current ticket
      if (tickets.length > 1) {
        const remaining = tickets.filter((_, idx) => idx !== activeTicketIndex)
        set({
          tickets: remaining,
          activeTicketIndex: Math.min(activeTicketIndex, remaining.length - 1),
          isLoading: false,
          lastSale: lastSaleInfo
        })
      } else {
        // If it was the only ticket, generate the first available non-sold ticket number for this session
        const nextIdx = await window.api.sales.getNextTicketNumber([], input.cashSessionId)
        set({
          tickets: [{ ticketIndex: nextIdx, label: `Ticket #${nextIdx}`, items: [] }],
          activeTicketIndex: 0,
          isLoading: false,
          lastSale: lastSaleInfo
        })
      }

      return result
    } catch (err: any) {
      set({ isLoading: false })
      throw err
    }
  }
}))
