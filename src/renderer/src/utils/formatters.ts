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
