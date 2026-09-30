/**
 * Domain Financial Logic for Chilean Peso (CLP) POS
 *
 * Rules:
 * - Integer amounts only (no decimals). All calculations round to nearest integer.
 * - Chilean currency uses dot as thousands separator ($ 19.990).
 * - Official denominations: bills (20.000, 10.000, 5.000, 2.000, 1.000) and coins (500, 100, 50, 10).
 * - Pure calculations without side-effects for use in both Main process, Renderer, and Tests.
 */

export interface ChileanDenomination {
  value: number
  label: string
  type: 'bill' | 'coin'
}

export const CHILEAN_DENOMINATIONS: readonly ChileanDenomination[] = [
  { value: 20000, label: '$20.000', type: 'bill' },
  { value: 10000, label: '$10.000', type: 'bill' },
  { value: 5000, label: '$5.000', type: 'bill' },
  { value: 2000, label: '$2.000', type: 'bill' },
  { value: 1000, label: '$1.000', type: 'bill' },
  { value: 500, label: '$500', type: 'coin' },
  { value: 100, label: '$100', type: 'coin' },
  { value: 50, label: '$50', type: 'coin' },
  { value: 10, label: '$10', type: 'coin' }
] as const

/**
 * Formats a numeric value into a standard Chilean Peso string with dots as thousands separators.
 * e.g., 19990 -> "$ 19.990", -5000 -> "$ -5.000"
 */
export function formatCLP(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$ 0'
  }
  const integerVal = Math.round(amount)
  const isNegative = integerVal < 0
  const absVal = Math.abs(integerVal)
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return isNegative ? `$ -${formatted}` : `$ ${formatted}`
}

/**
 * Parses a user input string into an integer CLP amount, stripping currency symbols, letters, spaces and dots.
 */
export function parseCLP(input: string | number | null | undefined): number {
  if (typeof input === 'number') {
    return Math.round(input)
  }
  if (!input) return 0
  const clean = input.replace(/[^0-9-]/g, '')
  const val = parseInt(clean, 10)
  return isNaN(val) ? 0 : val
}

/**
 * Calculates total counted physical cash from an object of denomination counts.
 */
export function calculateCountedCash(denominationCounts: Record<number, number>): number {
  if (!denominationCounts) return 0
  let total = 0
  for (const denom of CHILEAN_DENOMINATIONS) {
    const count = denominationCounts[denom.value] || 0
    if (count > 0) {
      total += denom.value * count
    }
  }
  return Math.round(total)
}

export interface DenominationBreakdownItem {
  value: number
  label: string
  type: 'bill' | 'coin'
  count: number
  subtotal: number
}

/**
 * Returns a structured breakdown of each denomination, count, and subtotal.
 */
export function calculateDenominationBreakdown(
  denominationCounts: Record<number, number>
): DenominationBreakdownItem[] {
  return CHILEAN_DENOMINATIONS.map((d) => {
    const count = Math.max(0, denominationCounts?.[d.value] || 0)
    return {
      value: d.value,
      label: d.label,
      type: d.type,
      count,
      subtotal: Math.round(d.value * count)
    }
  })
}

export type WithdrawalRules = Record<number, number | null>

/**
 * Reglas por defecto acordadas:
 * - $20.000: 0 unidades (se retiran todos los billetes de 20.000)
 * - $10.000: 2 unidades (se dejan máximo 2 billetes de 10.000, excedente se retira)
 * - Demás denominaciones: null (sin límite, se dejan todas en el fondo)
 */
export const DEFAULT_WITHDRAWAL_RULES: WithdrawalRules = {
  20000: 0,
  10000: 2,
  5000: null,
  2000: null,
  1000: null,
  500: null,
  100: null,
  50: null,
  10: null
}

export interface NextOpeningFundAndWithdrawalResult {
  nextOpeningFund: number
  withdrawalAmount: number
  nextOpeningCounts: Record<number, number>
  withdrawalCounts: Record<number, number>
}

/**
 * Calcula cuánto efectivo queda como fondo de caja para el siguiente turno y cuánto se retira.
 * Si el límite de la regla es null, se conserva todo (0 retirado).
 * Si es un número >= 0, se conservan como máximo 'límite' unidades y se retira el excedente.
 */
export function calculateNextOpeningFundAndWithdrawal(
  closingCounts: Record<number, number>,
  rules: WithdrawalRules = DEFAULT_WITHDRAWAL_RULES
): NextOpeningFundAndWithdrawalResult {
  const nextOpeningCounts: Record<number, number> = {}
  const withdrawalCounts: Record<number, number> = {}
  let nextOpeningFund = 0
  let withdrawalAmount = 0

  for (const denom of CHILEAN_DENOMINATIONS) {
    const totalCount = Math.max(0, closingCounts?.[denom.value] || 0)
    const limit = rules?.[denom.value]

    let keepCount = totalCount
    let withdrawCount = 0

    if (limit !== null && limit !== undefined && limit >= 0) {
      keepCount = Math.min(totalCount, limit)
      withdrawCount = Math.max(0, totalCount - keepCount)
    }

    nextOpeningCounts[denom.value] = keepCount
    withdrawalCounts[denom.value] = withdrawCount

    nextOpeningFund += denom.value * keepCount
    withdrawalAmount += denom.value * withdrawCount
  }

  return {
    nextOpeningFund: Math.round(nextOpeningFund),
    withdrawalAmount: Math.round(withdrawalAmount),
    nextOpeningCounts,
    withdrawalCounts
  }
}

export interface CartItemLike {
  unit_price: number
  quantity: number
}

/**
 * Calculates total monetary amount and total unit count from a list of cart/sale items.
 */
export function calculateCartTotal(items: CartItemLike[]): { totalAmount: number; totalItems: number } {
  if (!items || items.length === 0) {
    return { totalAmount: 0, totalItems: 0 }
  }

  let totalAmount = 0
  let totalItems = 0

  for (const item of items) {
    const qty = Math.max(0, item.quantity || 0)
    const price = Math.round(item.unit_price || 0)
    totalAmount += price * qty
    totalItems += qty
  }

  return {
    totalAmount: Math.round(totalAmount),
    totalItems
  }
}

export interface PaymentChangeResult {
  change: number
  isSufficient: boolean
  difference: number
}

/**
 * Calculates change for a given sale total and amount tendered.
 * In CLP, change is never negative.
 */
export function calculatePaymentChange(totalAmount: number, totalPaid: number): PaymentChangeResult {
  const roundedTotal = Math.max(0, Math.round(totalAmount))
  const roundedPaid = Math.max(0, Math.round(totalPaid))
  const diff = roundedPaid - roundedTotal

  return {
    change: diff >= 0 ? diff : 0,
    isSufficient: diff >= 0,
    difference: diff
  }
}

/**
 * Computes expected cash in drawer at cash cut:
 * Opening Fund + Cash Sales - Cash Returns - Cash Withdrawals (salidas)
 */
export function calculateExpectedCash(
  openingFund: number,
  cashSales: number,
  cashReturns: number,
  cashWithdrawals: number
): number {
  const fund = Math.round(openingFund || 0)
  const sales = Math.round(cashSales || 0)
  const returns = Math.round(cashReturns || 0)
  const withdrawals = Math.round(cashWithdrawals || 0)

  return Math.round(fund + sales - returns - withdrawals)
}

export interface CashDifferenceResult {
  difference: number
  status: 'balanced' | 'surplus' | 'shortage'
}

/**
 * Computes difference between counted physical cash and expected cash:
 * difference = countedCash - expectedCash
 * status: 'balanced' (difference === 0), 'surplus' (> 0), 'shortage' (< 0)
 */
export function calculateCashDifference(countedCash: number, expectedCash: number): CashDifferenceResult {
  const diff = Math.round(countedCash) - Math.round(expectedCash)
  let status: 'balanced' | 'surplus' | 'shortage' = 'balanced'

  if (diff > 0) {
    status = 'surplus'
  } else if (diff < 0) {
    status = 'shortage'
  }

  return {
    difference: diff,
    status
  }
}

/**
 * Computes Net Sales = Gross Sales - Total Returns
 */
export function calculateNetSales(grossSales: number, returnsTotal: number): number {
  return Math.round(Math.round(grossSales || 0) - Math.round(returnsTotal || 0))
}

export interface ExchangeBalanceResult {
  differenceToPay: number
  remainingCredit: number
  canComplete: boolean
  status: 'exact' | 'due' | 'insufficient'
}

/**
 * Calculates financial balance for a product exchange.
 * Rules:
 * - Customers cannot receive cash back for exchange credits.
 * - New products total must be >= exchange credit to complete the exchange.
 * - If newProductsTotal == exchangeCredit: exact match ($0 to pay).
 * - If newProductsTotal > exchangeCredit: differenceToPay = newProductsTotal - exchangeCredit.
 * - If newProductsTotal < exchangeCredit: cannot complete yet (remaining credit pending).
 */
export function calculateExchangeBalance(
  exchangeCredit: number,
  newProductsTotal: number
): ExchangeBalanceResult {
  const credit = Math.max(0, Math.round(exchangeCredit || 0))
  const newTotal = Math.max(0, Math.round(newProductsTotal || 0))

  if (newTotal === credit) {
    return {
      differenceToPay: 0,
      remainingCredit: 0,
      canComplete: true,
      status: 'exact'
    }
  }

  if (newTotal > credit) {
    return {
      differenceToPay: newTotal - credit,
      remainingCredit: 0,
      canComplete: true,
      status: 'due'
    }
  }

  return {
    differenceToPay: 0,
    remainingCredit: credit - newTotal,
    canComplete: false,
    status: 'insufficient'
  }
}

export interface ExchangePeriodResult {
  isExceeded: boolean
  daysDiff: number
}

/**
 * Checks if a sale date exceeds the standard 30-day exchange window.
 * Returns isExceeded (true if > 30 days) and daysDiff.
 */
export function isExchangePeriodExceeded(
  saleDateIso: string,
  daysLimit = 30,
  referenceDate = new Date()
): ExchangePeriodResult {
  if (!saleDateIso) {
    return { isExceeded: false, daysDiff: 0 }
  }

  const saleDate = new Date(saleDateIso)
  if (isNaN(saleDate.getTime())) {
    return { isExceeded: false, daysDiff: 0 }
  }

  const diffMs = referenceDate.getTime() - saleDate.getTime()
  const daysDiff = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  return {
    isExceeded: daysDiff > daysLimit,
    daysDiff
  }
}
