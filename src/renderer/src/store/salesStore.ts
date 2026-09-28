import { create } from 'zustand'
import { CartItem, CompleteSaleInput, CompletedSaleResult } from '@shared/types'

export interface Ticket {
  id?: number // Database sale id if saved as pending
  ticketIndex: number
  label: string
  items: CartItem[]
}

interface SalesState {
  tickets: Ticket[]
  activeTicketIndex: number
  isLoading: boolean
  error: string | null

  // Actions
  loadPendingTickets: (cashSessionId?: number) => Promise<void>
  createTicket: () => void
  selectTicket: (index: number) => void
  addItem: (product: { code: string; name: string; sale_price: number; stock: number; variant_label?: string | null }, qty?: number) => void
  updateQuantity: (productCode: string, qty: number) => void
  removeItem: (productCode: string) => void
  clearCart: () => void
  putTicketOnStandby: (cashSessionId: number) => Promise<void>
  deleteTicket: (index: number) => Promise<void>
  finalizeSale: (input: Omit<CompleteSaleInput, 'saleId' | 'items'>) => Promise<CompletedSaleResult>
}

export const useSalesStore = create<SalesState>((set, get) => ({
  tickets: [
    { ticketIndex: 1, label: 'Ticket 1', items: [] }
  ],
  activeTicketIndex: 0,
  isLoading: false,
  error: null,

  loadPendingTickets: async (cashSessionId?: number) => {
    try {
      set({ isLoading: true })
      const pending = await window.api.getPendingSales(cashSessionId)

      if (pending.length > 0) {
        const loadedTickets: Ticket[] = pending.map((p, idx) => ({
          id: p.id,
          ticketIndex: idx + 1,
          label: `Ticket #${p.folio}`,
          items: p.items
        }))
        set({ tickets: loadedTickets, activeTicketIndex: 0, isLoading: false })
      } else {
        // Start with one clean ticket if none pending
        set({
          tickets: [{ ticketIndex: 1, label: 'Ticket 1', items: [] }],
          activeTicketIndex: 0,
          isLoading: false
        })
      }
    } catch (err: any) {
      console.error('Error cargando ventas pendientes:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  createTicket: () => {
    const { tickets } = get()
    const nextIdx = tickets.length + 1
    const newTicket: Ticket = {
      ticketIndex: nextIdx,
      label: `Ticket ${nextIdx}`,
      items: []
    }
    set({
      tickets: [...tickets, newTicket],
      activeTicketIndex: tickets.length
    })
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
      // Persist in DB with status = pending
      const saved = await window.api.savePendingSale({
        id: currentTicket.id,
        cashSessionId,
        items: currentTicket.items
      })

      // Update current ticket with saved ID and folio label
      const updatedCurrentTicket: Ticket = {
        ...currentTicket,
        id: saved.id,
        label: `Ticket #${saved.folio}`
      }

      // Automatically create or switch to a new empty ticket
      const newTicketNumber = tickets.length + 1
      const newEmptyTicket: Ticket = {
        ticketIndex: newTicketNumber,
        label: `Ticket ${newTicketNumber}`,
        items: []
      }

      const updatedTickets = tickets.map((t, idx) => {
        if (idx === activeTicketIndex) return updatedCurrentTicket
        return t
      })

      set({
        tickets: [...updatedTickets, newEmptyTicket],
        activeTicketIndex: updatedTickets.length, // focus new ticket
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
        await window.api.deletePendingSale(ticketToDelete.id)
      } catch (err) {
        console.error('Error eliminando venta pendiente de BD:', err)
      }
    }

    if (tickets.length <= 1) {
      // Just clear items if it's the only ticket
      set({
        tickets: [{ ticketIndex: 1, label: 'Ticket 1', items: [] }],
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
      const result = await window.api.completeSale({
        ...input,
        saleId: currentTicket.id,
        items: currentTicket.items.map((it) => ({
          product_code: it.product_code,
          name: it.name,
          unit_price: it.unit_price,
          quantity: it.quantity
        }))
      })

      // Clean or remove current ticket
      if (tickets.length > 1) {
        const remaining = tickets.filter((_, idx) => idx !== activeTicketIndex)
        set({
          tickets: remaining,
          activeTicketIndex: Math.min(activeTicketIndex, remaining.length - 1),
          isLoading: false
        })
      } else {
        set({
          tickets: [{ ticketIndex: 1, label: 'Ticket 1', items: [] }],
          activeTicketIndex: 0,
          isLoading: false
        })
      }

      return result
    } catch (err: any) {
      set({ isLoading: false })
      throw err
    }
  }
}))
