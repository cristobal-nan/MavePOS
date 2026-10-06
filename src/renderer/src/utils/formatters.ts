/**
 * Utilities for formatting CLP and Date/Times
 * Re-exports core financial utilities from src/shared/finance
 */
export { formatCLP, parseCLP } from '../../../shared/finance'

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

export function formatPaymentMethods(payments: { method: string; amount: number }[]): string {
  if (!payments || payments.length === 0) return 'Cambio'
  const active = payments.filter((p) => p.amount > 0)
  if (active.length === 0) return 'Cambio'

  const methodNames: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia'
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

