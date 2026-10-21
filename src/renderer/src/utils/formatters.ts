/**
 * Utilities for formatting CLP and Date/Times
 * Re-exports core financial utilities from src/shared/finance
 */
export { formatCLP, parseCLP } from '../../../shared/finance'
import { CashSession, DailyCashRecord } from '../../../shared/types'

export function formatDateTime(isoString: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const pad = (n: number) => String(n).padStart(2, '0')
    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    const hours = pad(d.getHours())
    const mins = pad(d.getMinutes())
    return `${day}/${month}/${year} ${hours}:${mins}`
  } catch {
    return isoString
  }
}

export function formatDate(isoString: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const pad = (n: number) => String(n).padStart(2, '0')
    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return isoString
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const pad = (n: number) => String(n).padStart(2, '0')
    const hours = pad(d.getHours())
    const mins = pad(d.getMinutes())
    return `${hours}:${mins}`
  } catch {
    return isoString
  }
}

export function getLocalDateKey(isoString: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return isoString.slice(0, 10)
  }
}

export function groupSessionsByDay(sessions: CashSession[]): DailyCashRecord[] {
  if (!sessions || sessions.length === 0) return []

  const groups = new Map<string, CashSession[]>()

  for (const session of sessions) {
    const key = getLocalDateKey(session.opened_at)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(session)
  }

  const result: DailyCashRecord[] = []

  for (const [dateKey, list] of groups.entries()) {
    const sorted = [...list].sort((a, b) => {
      const timeA = new Date(a.opened_at).getTime()
      const timeB = new Date(b.opened_at).getTime()
      return timeA !== timeB ? timeA - timeB : a.id - b.id
    })

    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    const totalSalesCash = sorted.reduce((sum, s) => sum + (s.sales_cash ?? 0), 0)
    const totalSalesCard = sorted.reduce((sum, s) => sum + (s.sales_card ?? 0), 0)
    const totalSalesTransfer = sorted.reduce((sum, s) => sum + (s.sales_transfer ?? 0), 0)
    const totalDifferenceCash = sorted.reduce((sum, s) => sum + (s.difference ?? 0), 0)
    const totalDifferenceCard = sorted.reduce((sum, s) => sum + (s.card_difference ?? 0), 0)
    const totalWithdrawal = sorted.reduce((sum, s) => sum + (s.withdrawal_amount ?? 0), 0)

    result.push({
      dateKey,
      displayDate: formatDate(first.opened_at),
      sessions: sorted,
      turnCount: sorted.length,
      firstOpenedAt: first.opened_at,
      lastClosedAt: last.closed_at,
      initialOpeningFund: first.opening_fund,
      finalClosingCash:
        last.closing_cash !== undefined && last.closing_cash !== null ? last.closing_cash : null,
      totalSalesCash,
      totalSalesCard,
      totalSalesTransfer,
      totalSales: totalSalesCash + totalSalesCard + totalSalesTransfer,
      totalDifferenceCash,
      totalDifferenceCard,
      totalWithdrawal
    })
  }

  return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

export function formatPaymentMethods(payments: { method: string; amount: number }[]): string {
  if (!payments || payments.length === 0) return 'Cambio'
  const active = payments.filter((p) => p.amount > 0)
  if (active.length === 0) return 'Cambio'

  const methodNames: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    credito: 'Crédito'
  }

  if (active.length === 1) {
    return methodNames[active[0].method] || active[0].method
  }

  return active.map((p) => methodNames[p.method] || p.method).join(' + ')
}

/**
 * Fuerce la mayúscula en la primera letra de cada palabra (Title Case)
 * preservando acentos (á, é, í, ó, ú, ñ), delimitadores y caracteres siguientes.
 */
export function capitalizeWords(text: string): string {
  if (!text) return ''
  return text.replace(/(?:^|[\s([{\-/"'])\p{L}/gu, (match) => match.toUpperCase())
}

