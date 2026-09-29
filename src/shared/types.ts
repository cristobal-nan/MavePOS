// Shared types between Main and Renderer processes

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type SaleStatus = 'pending' | 'completed' | 'cancelled'
export type MovementType = 'venta' | 'devolucion' | 'ajuste' | 'importacion' | 'inicial'

export interface Category {
  id: number
  name: string
  parent_id: number | null
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
}

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
}

export interface ProductSearchResult extends Product {
  category_name?: string | null
  parent_category_name?: string | null
  parent_name?: string | null
  variations_count?: number
}

export interface ProductSearchOptions {
  query?: string
  categoryId?: number | null
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
  created_at: string
  completed_at: string | null
}

export interface SaleItem {
  id: number
  sale_id: number
  product_code: string
  name: string
  unit_price: number
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
}

export interface CompletedSaleResult {
  sale: Sale
  items: SaleItem[]
  payments: SalePayment[]
  change: number
}

export interface SaleDetail extends Sale {
  items: (SaleItem & { current_stock?: number })[]
  payments: SalePayment[]
  total_items: number
  returned_items_count: number
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
}

export interface AdjustStockInput {
  product_code: string
  new_stock?: number
  delta?: number
  reason: string
}

export interface CashSession {
  id: number
  opening_fund: number
  opened_at: string
  closed_at: string | null
  closing_cash?: number | null
  expected_cash?: number | null
  difference?: number | null
  notes?: string | null
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
}

export interface CloseCashSessionInput {
  sessionId: number
  closingCash?: number
  expectedCash?: number
  difference?: number
  notes?: string
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
