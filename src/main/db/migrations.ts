import Database from 'better-sqlite3'
import { INITIAL_SCHEMA } from './schema'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(INITIAL_SCHEMA)
    }
  },
  {
    version: 2,
    up: (db) => {
      const cols = db.pragma('table_info(products)') as { name: string }[]
      const hasProductType = cols.some((c) => c.name === 'product_type')
      if (!hasProductType) {
        db.pragma('foreign_keys = OFF')

        db.exec(`
          CREATE TABLE products_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NULL UNIQUE,
            name TEXT NOT NULL,
            search_name TEXT NOT NULL,
            product_type TEXT NOT NULL CHECK(product_type IN ('simple', 'variable', 'variation')) DEFAULT 'simple',
            parent_id INTEGER NULL REFERENCES products_new(id) ON DELETE CASCADE,
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

          INSERT INTO products_new (
            code, name, search_name, product_type, parent_id,
            attribute_name, attribute_value, sale_price, cost_price,
            category_id, stock, min_stock, active, created_at, updated_at
          )
          SELECT
            code, name, search_name,
            'simple',
            NULL,
            NULL,
            variant_label,
            sale_price, cost_price,
            category_id, stock, min_stock, active, created_at, updated_at
          FROM products;

          DROP TABLE products;
          ALTER TABLE products_new RENAME TO products;

          CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
          CREATE INDEX IF NOT EXISTS idx_products_search_name ON products(search_name);
          CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
          CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_id);
          CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

          DROP TABLE IF EXISTS families;
        `)

        db.pragma('foreign_keys = ON')
      } else {
        db.exec('DROP TABLE IF EXISTS families;')
      }
    }
  },
  {
    version: 3,
    up: (db) => {
      const cols = db.pragma('table_info(cash_sessions)') as { name: string }[]
      const hasClosingCash = cols.some((c) => c.name === 'closing_cash')
      if (!hasClosingCash) {
        db.exec(`
          ALTER TABLE cash_sessions ADD COLUMN closing_cash INTEGER NULL;
          ALTER TABLE cash_sessions ADD COLUMN expected_cash INTEGER NULL;
          ALTER TABLE cash_sessions ADD COLUMN difference INTEGER NULL;
          ALTER TABLE cash_sessions ADD COLUMN notes TEXT NULL;
        `)
      }
    }
  },
  {
    version: 4,
    up: (db) => {
      // Recreate sales table with ticket_number and unique folio
      const cols = db.pragma('table_info(sales)') as { name: string }[]
      const hasTicketNumber = cols.some((c) => c.name === 'ticket_number')
      if (!hasTicketNumber) {
        db.pragma('foreign_keys = OFF')

        db.exec(`
          CREATE TABLE sales_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio INTEGER NULL UNIQUE,
            ticket_number INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'cancelled')),
            total INTEGER NOT NULL DEFAULT 0,
            cash_session_id INTEGER NULL REFERENCES cash_sessions(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL,
            completed_at TEXT NULL
          );

          INSERT INTO sales_new (id, folio, ticket_number, status, total, cash_session_id, created_at, completed_at)
          SELECT id, folio, COALESCE(folio, 0), status, total, cash_session_id, created_at, completed_at FROM sales;

          DROP TABLE sales;
          ALTER TABLE sales_new RENAME TO sales;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_folio ON sales(folio);
          CREATE INDEX IF NOT EXISTS idx_sales_ticket_number ON sales(ticket_number);
          CREATE INDEX IF NOT EXISTS idx_sales_session_ticket ON sales(cash_session_id, ticket_number);
          CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
          CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
        `)

        db.pragma('foreign_keys = ON')
      }
    }
  },
  {
    version: 5,
    up: (db) => {
      // Ensure ticket_number column exists and folio is unique even if v4 already ran earlier
      const cols = db.pragma('table_info(sales)') as { name: string }[]
      const hasTicketNumber = cols.some((c) => c.name === 'ticket_number')
      if (!hasTicketNumber) {
        db.exec('ALTER TABLE sales ADD COLUMN ticket_number INTEGER NOT NULL DEFAULT 0;')
        db.exec('CREATE INDEX IF NOT EXISTS idx_sales_ticket_number ON sales(ticket_number);')
        db.exec('CREATE INDEX IF NOT EXISTS idx_sales_session_ticket ON sales(cash_session_id, ticket_number);')
      }
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_folio_unique ON sales(folio);')
    }
  },
  {
    version: 6,
    up: (db) => {
      db.exec(`
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
      `)
    }
  },
  {
    version: 7,
    up: (db) => {
      const cols = db.pragma('table_info(sales)') as { name: string }[]
      const hasExchangeParent = cols.some((c) => c.name === 'exchange_parent_id')
      if (!hasExchangeParent) {
        db.exec(`
          ALTER TABLE sales ADD COLUMN exchange_parent_id INTEGER NULL REFERENCES sales(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_sales_exchange_parent ON sales(exchange_parent_id);
        `)
      }
    }
  },
  {
    version: 8,
    up: (db) => {
      const cols = db.pragma('table_info(sale_items)') as { name: string }[]
      const hasCostPrice = cols.some((c) => c.name === 'cost_price')
      if (!hasCostPrice) {
        db.exec(`
          ALTER TABLE sale_items ADD COLUMN cost_price INTEGER NULL;
        `)
      }
    }
  },
  {
    version: 9,
    up: (db) => {
      const cols = db.pragma('table_info(cash_sessions)') as { name: string }[]
      const colNames = new Set(cols.map((c) => c.name))

      if (!colNames.has('opening_denominations')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN opening_denominations TEXT NULL;')
      }
      if (!colNames.has('closing_denominations')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN closing_denominations TEXT NULL;')
      }
      if (!colNames.has('next_opening_denominations')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN next_opening_denominations TEXT NULL;')
      }
      if (!colNames.has('withdrawal_amount')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN withdrawal_amount INTEGER NULL;')
      }
      if (!colNames.has('sales_cash')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN sales_cash INTEGER NULL;')
      }
      if (!colNames.has('sales_card')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN sales_card INTEGER NULL;')
      }
      if (!colNames.has('sales_transfer')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN sales_transfer INTEGER NULL;')
      }
      if (!colNames.has('card_difference')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN card_difference INTEGER NULL DEFAULT 0;')
      }
    }
  },
  {
    version: 10,
    up: (db) => {
      const cols = db.pragma('table_info(cash_sessions)') as { name: string }[]
      const colNames = new Set(cols.map((c) => c.name))

      if (!colNames.has('card_machine_amount')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN card_machine_amount INTEGER NULL;')
      }
      if (!colNames.has('transfer_verified_amount')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN transfer_verified_amount INTEGER NULL;')
      }
      if (!colNames.has('transfer_difference')) {
        db.exec('ALTER TABLE cash_sessions ADD COLUMN transfer_difference INTEGER NULL DEFAULT 0;')
      }
    }
  },
  {
    version: 11,
    up: (db) => {
      const cols = db.pragma('table_info(inventory_movements)') as { name: string }[]
      const colNames = new Set(cols.map((c) => c.name))

      if (!colNames.has('item_name')) {
        db.exec('ALTER TABLE inventory_movements ADD COLUMN item_name TEXT NULL;')
      }

      db.prepare(`
        INSERT OR IGNORE INTO products (
          code, name, search_name, product_type, sale_price, cost_price,
          stock, min_stock, active, created_at, updated_at
        )
        VALUES ('COMÚN', 'Producto Común', 'producto comun', 'simple', 0, NULL, 0, 0, 0, datetime('now'), datetime('now'))
      `).run()
    }
  },
  {
    version: 12,
    up: (db) => {
      // Liberar códigos de productos archivados preexistentes (active = 0)
      db.exec('PRAGMA defer_foreign_keys = ON;')
      const inactiveProducts = db
        .prepare(`
          SELECT id, code
          FROM products
          WHERE active = 0
            AND code IS NOT NULL
            AND code != 'COMÚN'
            AND code NOT LIKE '%_deleted%'
          ORDER BY id ASC
        `)
        .all() as { id: number; code: string }[]

      const updateProdStmt = db.prepare('UPDATE products SET code = ? WHERE id = ?')
      const updateInvStmt = db.prepare('UPDATE inventory_movements SET product_code = ? WHERE product_code = ?')
      const updateSaleStmt = db.prepare('UPDATE sale_items SET product_code = ? WHERE product_code = ?')

      for (const prod of inactiveProducts) {
        let index = 1
        let newCode = `${prod.code}_deleted${index}`
        while (db.prepare('SELECT 1 FROM products WHERE code = ?').get(newCode)) {
          index++
          newCode = `${prod.code}_deleted${index}`
        }

        updateProdStmt.run(newCode, prod.id)
        updateInvStmt.run(newCode, prod.code)
        updateSaleStmt.run(newCode, prod.code)
      }
    }
  }
]

export function runMigrations(db: Database.Database): void {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const getAppliedVersions = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
  const rows = getAppliedVersions.all() as { version: number }[]
  const appliedSet = new Set(rows.map((r) => r.version))

  const insertMigration = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      const applyTx = db.transaction(() => {
        migration.up(db)
        insertMigration.run(migration.version, new Date().toISOString())
      })
      applyTx()
    }
  }
}
