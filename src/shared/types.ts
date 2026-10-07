// Shared types between Main and Renderer processes

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type SaleStatus = 'pending' | 'completed' | 'cancelled'
export type MovementType = 'venta' | 'devolucion' | 'ajuste' | 'importacion' | 'inicial'

export interface Category {
  id: number
  name: string
  parent_id: number | null
}

export interface Supplier {
  id: number
  name: string
  search_name: string
  active: number
  created_at: string
  updated_at: string
}

export type ProductType = 'simple' | 'variable' | 'variation'

export interface Product {
  id?: number
  code: string | null
  name: string
  search_name: string
  product_type: ProductType
  parent_id: number | null
  attribute_name: string | null
  attribute_value: string | null
  sale_price: number
  cost_price: number | null
  category_id: number | null
  stock: number
  min_stock: number
  active: number // 1: active, 0: soft-deleted
  created_at: string
  updated_at: string
  supplier_ids?: number[]
  suppliers?: ProductSupplierInfo[]
}

export type ProductSupplierInfo = { id: number; name: string }

export interface ProductInput {
  id?: number
  code?: string | null
  name: string
  product_type?: ProductType
  parent_id?: number | null
  attribute_name?: string | null
  attribute_value?: string | null
  sale_price?: number
  cost_price?: number | null
  category_id?: number | null
  stock?: number
  min_stock?: number
  supplier_ids?: number[]
  sync_variations?: boolean
}

export interface ProductSearchResult extends Product {
  category_name?: string | null
  parent_category_name?: string | null
  parent_name?: string | null
  variations_count?: number
  suppliers?: ProductSupplierInfo[]
  category_display?: string
}

export interface ProductSearchOptions {
  query?: string
  categoryId?: number | null
  supplierId?: number | null
  productType?: ProductType | 'sellable' | 'all'
  parentId?: number | null
  onlySellable?: boolean
  limit?: number
  offset?: number
  orderBy?: 'name' | 'stock' | 'sale_price'
  orderDir?: 'ASC' | 'DESC'
  includeInactive?: boolean
}

export interface GroupAsVariableItemInput {
  productId: number
  attributeValue: string
  name?: string
}

export interface GroupAsVariableInput {
  parentName: string
  categoryId: number | null
  supplierIds?: number[]
  attributeName: string
  items: GroupAsVariableItemInput[]
}

export interface Sale {
  id: number
  folio: number
  ticket_number?: number
  status: SaleStatus
  total: number
  cash_session_id: number | null
  exchange_parent_id?: number | null
  exchange_parent_folio?: number | null
  created_at: string
  completed_at: string | null
}

export interface SaleItem {
  id: number
  sale_id: number
  product_code: string
  name: string
  unit_price: number
  cost_price?: number | null
  quantity: number
  returned_qty: number
}

export interface SalePayment {
  id: number
  sale_id: number
  method: PaymentMethod
  amount: number
}

export interface CartItem {
  product_code: string
  name: string
  unit_price: number
  quantity: number
  stock: number
  variant_label?: string | null
}

export interface PendingTicket {
  id: number // database sale ID
  folio?: number | null
  ticket_number: number
  total: number
  created_at: string
  items: CartItem[]
}

export interface ExchangeReturnedItem {
  product_code: string
  name: string
  unit_price: number
  quantity: number
}

export interface ExchangeInfo {
  originalSaleId: number
  originalFolio: number
  originalDate: string
  returnedItems: ExchangeReturnedItem[]
  exchangeCredit: number
}

export interface CompleteSaleInput {
  saleId?: number
  folio?: number
  ticket_number?: number
  cashSessionId: number
  items: {
    product_code: string
    name: string
    unit_price: number
    quantity: number
  }[]
  payments: {
    method: PaymentMethod
    amount: number
  }[]
  cashPaid?: number
  exchangeInfo?: ExchangeInfo
}

export interface CompletedSaleResult {
  sale: Sale
  items: SaleItem[]
  payments: SalePayment[]
  change: number
}

export interface LastSaleInfo {
  folio?: number | null
  ticket_number?: number
  paymentMethod: string
  totalItems: number
  totalAmount: number
  change?: number | null
  completedAt?: string
}

export interface SaleDetail extends Sale {
  items: (SaleItem & { current_stock?: number })[]
  payments: SalePayment[]
  total_items: number
  returned_items_count: number
  child_exchanges?: { id: number; folio: number; created_at: string }[]
}

export interface SalesHistoryFilter {
  date?: string
  folio?: number
  cashSessionId?: number
  status?: SaleStatus | 'all'
  limit?: number
  offset?: number
}

export interface CancelSaleInput {
  saleId: number
  reason?: string
}

export interface ReturnSaleItemInput {
  saleId: number
  productCode: string
  quantity: number
  reason?: string
}

export interface InventoryMovement {
  id: number
  product_code: string
  delta: number
  type: MovementType
  reason: string
  ref_sale_id: number | null
  created_at: string
}

export interface InventoryMovementDetail extends InventoryMovement {
  product_name: string
  sale_folio: number | null
  parent_name?: string | null
  attribute_value?: string | null
  stock_before?: number
  stock_after?: number
}

export interface AdjustStockInput {
  product_code: string
  new_stock?: number
  delta?: number
  reason: string
}

export interface QuickAdjustmentReason {
  id: string
  text: string
  type: 'replace' | 'append'
  shortcut?: string
}

export const DEFAULT_QUICK_REASONS: QuickAdjustmentReason[] = [
  { id: '1', text: 'Conteo físico / Arqueo', type: 'replace' },
  { id: '2', text: 'Merma por daño o rotura', type: 'replace' },
  { id: '3', text: 'Devolución a proveedor', type: 'replace' },
  { id: '4', text: 'Ingreso de mercadería / Ajuste', type: 'replace' },
  { id: '5', text: 'Pérdida / Descuadre', type: 'replace' },
  { id: '6', text: 'Corrección de inventario', type: 'replace' }
]

export type DenominationCounts = Record<number, number>

export type WithdrawalRules = Record<number, number | null>

export interface CashSession {
  id: number
  opening_fund: number
  opened_at: string
  closed_at: string | null
  closing_cash?: number | null
  expected_cash?: number | null
  difference?: number | null
  notes?: string | null
  opening_denominations?: string | DenominationCounts | null
  closing_denominations?: string | DenominationCounts | null
  next_opening_denominations?: string | DenominationCounts | null
  withdrawal_amount?: number | null
  sales_cash?: number | null
  sales_card?: number | null
  sales_transfer?: number | null
  card_machine_amount?: number | null
  card_difference?: number | null
  transfer_verified_amount?: number | null
  transfer_difference?: number | null
}

export interface CashCutSummary {
  sessionId: number
  openedAt: string
  closedAt: string | null
  openingFund: number
  salesCash: number
  salesCard: number
  salesTransfer: number
  salesTotal: number
  salesCount: number
  returnsTotal: number
  returnsCash: number
  returnsCount: number
  withdrawalsTotal: number
  withdrawalsCount: number
  netSales: number
  expectedCash: number
  closingCash: number | null
  difference: number | null
  notes: string | null
  withdrawalAmount?: number | null
  nextOpeningFund?: number | null
  openingDenominations?: Record<number, number> | null
  closingDenominations?: Record<number, number> | null
  nextOpeningDenominations?: Record<number, number> | null
  cardMachineAmount?: number | null
  cardDifference?: number | null
  transferVerifiedAmount?: number | null
  transferDifference?: number | null
}

export interface CloseCashSessionInput {
  sessionId: number
  closingCash?: number
  expectedCash?: number
  difference?: number
  notes?: string
  openingDenominations?: Record<number, number>
  closingDenominations?: Record<number, number>
  nextOpeningDenominations?: Record<number, number>
  withdrawalAmount?: number
  salesCash?: number
  salesCard?: number
  salesTransfer?: number
  cardMachineAmount?: number
  cardDifference?: number
  transferVerifiedAmount?: number
  transferDifference?: number
}

export interface OpenCashSessionInput {
  openingFund: number
  openingDenominations?: Record<number, number>
}

export interface CashMovement {
  id: number
  cash_session_id: number
  type: 'salida'
  amount: number
  reason: string
  created_at: string
}

export interface Setting {
  key: string
  value: string
}

export interface BackupInfo {
  filename: string
  filepath: string
  sizeBytes: number
  createdAt: string
}

// ----------------------------------------------------
// Fase 10: Importación de Catálogo desde Excel (.xlsx)
// ----------------------------------------------------

export interface ExcelColumnMapping {
  code: string
  name: string
  cost_price?: string
  sale_price: string
  stock: string
  min_stock?: string
  department?: string
  product_type?: string
  parent_name?: string
  attribute_name?: string
  attribute_value?: string
  suppliers?: string
}

export interface ExportExcelResult {
  filePath: string
  totalExported: number
}

export interface ExcelParsePreview {
  fileName: string
  sheetName: string
  totalRows: number
  headers: string[]
  detectedMapping: Partial<ExcelColumnMapping>
  previewRows: Record<string, any>[]
}

export interface ExcelImportRow {
  code: string
  name: string
  cost_price?: number | null
  sale_price: number
  stock: number
  min_stock?: number
  department?: string | null
}

export interface ImportErrorDetail {
  row: number
  code?: string
  name?: string
  reason: string
}

export interface ImportReportResult {
  totalRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  departmentsCreated: number
  errors: ImportErrorDetail[]
}

// ----------------------------------------------------
// Fase 11: Reportes, Métricas y Gráficos (Recharts)
// ----------------------------------------------------

export type ReportPeriodType = 'today' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom'

export interface ReportFilter {
  periodType: ReportPeriodType
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
}

export interface ReportKPISummary {
  totalSales: number // Ventas netas CLP
  salesCount: number // Número de transacciones
  averageTicket: number // Ticket promedio CLP
  unitsSold: number // Unidades físicas netas
  estimatedCost: number // Costo total de bienes vendidos (con costo conocido)
  estimatedMargin: number // Ganancia bruta estimada CLP
  marginPercentage: number // % de margen
  // Comparativos con el período anterior equivalente
  prevTotalSales: number
  prevSalesCount: number
  prevAverageTicket: number
  prevUnitsSold: number
  salesGrowthPct: number | null // % variación ventas
  countGrowthPct: number | null // % variación transacciones
}

export interface SalesOverTimePoint {
  label: string // '10:00' o '24 Sep'
  date: string // '2026-09-24' o ISO
  total: number // CLP
  count: number // cantidad ventas
}

export interface PaymentMethodStat {
  method: PaymentMethod
  methodName: string // 'Efectivo', 'Tarjeta', 'Transferencia'
  total: number
  percentage: number
  count: number
}

export interface TopProductStat {
  code: string
  name: string
  categoryName: string
  unitsSold: number
  totalRevenue: number
  unitPrice: number
}

export interface CategorySalesStat {
  categoryId: number | null
  categoryName: string
  totalRevenue: number
  unitsSold: number
  percentage: number
}

export interface SupplierSalesStat {
  supplierId: number | null
  supplierName: string
  totalRevenue: number
  unitsSold: number
  percentage: number
}

export interface FullReportData {
  filter: ReportFilter
  dateRange: {
    start: string
    end: string
    prevStart: string
    prevEnd: string
  }
  kpi: ReportKPISummary
  salesOverTime: SalesOverTimePoint[]
  paymentMethods: PaymentMethodStat[]
  topProducts: TopProductStat[]
  categorySales: CategorySalesStat[]
  supplierSales: SupplierSalesStat[]
}

// ----------------------------------------------------
// Fase 9: Impresión y Periféricos
// ----------------------------------------------------

export type ThermalPrinterType = 'epson' | 'star'
export type ThermalPaperWidth = '58mm' | '80mm'
export type ThermalInterfaceType = 'windows_printer' | 'tcp' | 'shared'

export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  isDefault: boolean
  status: number
}

export interface PrinterConfig {
  thermalType: ThermalPrinterType
  thermalInterfaceType: ThermalInterfaceType
  thermalInterface: string
  paperWidth: ThermalPaperWidth
  openDrawerOnPrint: boolean
  autoPrintOnSale: boolean
  normalPrinterName?: string
}

export interface PrintResult {
  success: boolean
  error?: string
}

export interface CatalogConfig {
  catalogAutoLoad: boolean
  catalogInitialLimit: number
  catalogScrollBatch: number
  modalAutoLoad: boolean
  modalInitialLimit: number
  modalScrollBatch: number
}

export const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  catalogAutoLoad: true,
  catalogInitialLimit: 150,
  catalogScrollBatch: 150,
  modalAutoLoad: true,
  modalInitialLimit: 150,
  modalScrollBatch: 150
}


