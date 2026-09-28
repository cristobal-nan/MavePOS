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

  CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opening_fund INTEGER NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT NULL,
    closing_cash INTEGER NULL,
    expected_cash INTEGER NULL,
    difference INTEGER NULL,
    notes TEXT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'cancelled')),
    total INTEGER NOT NULL DEFAULT 0,
    cash_session_id INTEGER NULL REFERENCES cash_sessions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sales_folio ON sales(folio);
  CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL REFERENCES products(code),
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
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
`
