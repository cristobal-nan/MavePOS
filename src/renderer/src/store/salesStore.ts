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
  createTicket: () => Promise<void>
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
    { ticketIndex: 1, label: 'Ticket #1', items: [] }
  ],
  activeTicketIndex: 0,
  isLoading: false,
  error: null,

  loadPendingTickets: async (cashSessionId?: number) => {
    try {
      set({ isLoading: true })
      const pending = await window.api.getPendingSales(cashSessionId)

      if (pending.length > 0) {
        const loadedTickets: Ticket[] = pending.map((p) => ({
          id: p.id,
          ticketIndex: p.folio,
          label: `Ticket #${p.folio}`,
          items: p.items
        }))
        loadedTickets.sort((a, b) => a.ticketIndex - b.ticketIndex)
        set({
          tickets: loadedTickets,
          activeTicketIndex: 0,
          isLoading: false
        })
      } else {
        // Start with a clean ticket matching the first available non-sold folio
        const initialIndex = await window.api.getNextFolio([])
        set({
          tickets: [{ ticketIndex: initialIndex, label: `Ticket #${initialIndex}`, items: [] }],
          activeTicketIndex: 0,
          isLoading: false
        })
      }
    } catch (err: any) {
      console.error('Error cargando ventas pendientes:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  createTicket: async () => {
    const { tickets } = get()
    try {
      // Find the first integer starting from 1 that is neither in sales (DB) nor open in memory
      const openFolios = tickets.map((t) => t.ticketIndex)
      const nextIdx = await window.api.getNextFolio(openFolios)
      const newTicket: Ticket = {
        ticketIndex: nextIdx,
        label: `Ticket #${nextIdx}`,
        items: []
      }
      const allTickets = [...tickets, newTicket].sort((a, b) => a.ticketIndex - b.ticketIndex)
      const newActiveIdx = allTickets.findIndex((t) => t.ticketIndex === nextIdx)
      set({
        tickets: allTickets,
        activeTicketIndex: newActiveIdx >= 0 ? newActiveIdx : allTickets.length - 1
      })
    } catch (err: any) {
      console.error('Error creando nuevo ticket:', err)
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
      // Persist in DB with status = pending and requested folio
      const saved = await window.api.savePendingSale({
        id: currentTicket.id,
        folio: currentTicket.ticketIndex,
        cashSessionId,
        items: currentTicket.items
      })

      const updatedCurrentTicket: Ticket = {
        ...currentTicket,
        id: saved.id,
        ticketIndex: saved.folio,
        label: `Ticket #${saved.folio}`
      }

      const updatedTickets = tickets.map((t, idx) => {
        if (idx === activeTicketIndex) return updatedCurrentTicket
        return t
      })

      const openFolios = updatedTickets.map((t) => t.ticketIndex)
      const nextIdx = await window.api.getNextFolio(openFolios)
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
        await window.api.deletePendingSale(ticketToDelete.id)
      } catch (err) {
        console.error('Error eliminando venta pendiente de BD:', err)
      }
    }

    if (tickets.length <= 1) {
      // Just clear items if it's the only ticket, keep its assigned index
      set({
        tickets: [{ ticketIndex: ticketToDelete.ticketIndex, label: ticketToDelete.label, items: [] }],
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
        folio: currentTicket.ticketIndex,
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
        // If it was the only ticket, generate the first available non-sold folio
        const nextIdx = await window.api.getNextFolio([])
        set({
          tickets: [{ ticketIndex: nextIdx, label: `Ticket #${nextIdx}`, items: [] }],
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
