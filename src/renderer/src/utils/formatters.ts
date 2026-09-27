/**
 * Utilities for formatting CLP (Chilean Peso)
 * Domain rules:
 * - Integer amounts only (no decimals)
 * - Dot as thousands separator (e.g., $ 19.990, $ 50.000)
 */

export function formatCLP(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$ 0'
  }
  const integerVal = Math.round(amount)
  // Format with dot as thousands separator
  const formatted = integerVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$ ${formatted}`
}

export function parseCLP(input: string): number {
  if (!input) return 0
  // Remove currency symbol, spaces and dots
  const clean = input.replace(/[^0-9]/g, '')
  const val = parseInt(clean, 10)
  return isNaN(val) ? 0 : val
}

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
