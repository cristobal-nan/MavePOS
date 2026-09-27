// Shared types between Main and Renderer processes

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type SaleStatus = 'pending' | 'completed' | 'cancelled'
export type MovementType = 'venta' | 'devolucion' | 'ajuste' | 'importacion' | 'inicial'

export interface Category {
  id: number
  name: string
  parent_id: number | null
}

export interface Family {
  id: number
  name: string
  category_id: number | null
  created_at: string
}

export interface Product {
  code: string
  name: string
  search_name: string
  sale_price: number
  cost_price: number | null
  category_id: number | null
  family_id: number | null
  variant_label: string | null
  stock: number
  min_stock: number
  active: number // 1: active, 0: soft-deleted
  created_at: string
  updated_at: string
}

export interface ProductInput {
  code: string
  name: string
  sale_price: number
  cost_price?: number | null
  category_id?: number | null
  family_id?: number | null
  variant_label?: string | null
  stock?: number
  min_stock?: number
}

export interface ProductSearchResult extends Product {
  category_name?: string | null
  parent_category_name?: string | null
  family_name?: string | null
}

export interface ProductSearchOptions {
  query?: string
  categoryId?: number | null
  familyId?: number | null
  limit?: number
  offset?: number
  orderBy?: 'name' | 'stock' | 'sale_price'
  orderDir?: 'ASC' | 'DESC'
  includeInactive?: boolean
}

export interface Sale {
  id: number
  folio: number
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

export interface InventoryMovement {
  id: number
  product_code: string
  delta: number
  type: MovementType
  reason: string
  ref_sale_id: number | null
  created_at: string
}

export interface CashSession {
  id: number
  opening_fund: number
  opened_at: string
  closed_at: string | null
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
