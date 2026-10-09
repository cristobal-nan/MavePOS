export const INITIAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NULL UNIQUE,
    name TEXT NOT NULL,
    search_name TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK(product_type IN ('simple', 'variable', 'variation')),
    parent_id INTEGER NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name TEXT NULL,
    attribute_value TEXT NULL,
    sale_price INTEGER NOT NULL DEFAULT 0,
    cost_price INTEGER NULL,
    category_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
  CREATE INDEX IF NOT EXISTS idx_products_search_name ON products(search_name);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_id);
  CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    search_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
  CREATE INDEX IF NOT EXISTS idx_suppliers_search_name ON suppliers(search_name);
  CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);

  CREATE TABLE IF NOT EXISTS product_suppliers (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, supplier_id)
  );

  CREATE INDEX IF NOT EXISTS idx_product_suppliers_prod ON product_suppliers(product_id);
  CREATE INDEX IF NOT EXISTS idx_product_suppliers_supp ON product_suppliers(supplier_id);

  CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opening_fund INTEGER NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT NULL,
    closing_cash INTEGER NULL,
    expected_cash INTEGER NULL,
    difference INTEGER NULL,
    notes TEXT NULL,
    opening_denominations TEXT NULL,
    closing_denominations TEXT NULL,
    next_opening_denominations TEXT NULL,
    withdrawal_amount INTEGER NULL,
    sales_cash INTEGER NULL,
    sales_card INTEGER NULL,
    sales_transfer INTEGER NULL,
    card_machine_amount INTEGER NULL,
    card_difference INTEGER NULL DEFAULT 0,
    transfer_verified_amount INTEGER NULL,
    transfer_difference INTEGER NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio INTEGER NULL UNIQUE,
    ticket_number INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'cancelled')),
    total INTEGER NOT NULL DEFAULT 0,
    cash_session_id INTEGER NULL REFERENCES cash_sessions(id) ON DELETE SET NULL,
    exchange_parent_id INTEGER NULL REFERENCES sales(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_folio ON sales(folio);
  CREATE INDEX IF NOT EXISTS idx_sales_ticket_number ON sales(ticket_number);
  CREATE INDEX IF NOT EXISTS idx_sales_session_ticket ON sales(cash_session_id, ticket_number);
  CREATE INDEX IF NOT EXISTS idx_sales_exchange_parent ON sales(exchange_parent_id);
  CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL REFERENCES products(code),
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    cost_price INTEGER NULL,
    quantity INTEGER NOT NULL,
    returned_qty INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK(method IN ('cash', 'card', 'transfer')),
    amount INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT NOT NULL REFERENCES products(code),
    item_name TEXT NULL,
    delta INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('venta', 'devolucion', 'ajuste', 'importacion', 'inicial')),
    reason TEXT NOT NULL,
    ref_sale_id INTEGER NULL REFERENCES sales(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inv_movements_prod ON inventory_movements(product_code);
  CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(created_at);

  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('salida')),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO products (
    code, name, search_name, product_type, sale_price, cost_price,
    stock, min_stock, active, created_at, updated_at
  )
  VALUES ('COMÚN', 'Producto Común', 'producto comun', 'simple', 0, NULL, 0, 0, 0, datetime('now'), datetime('now'));
`
