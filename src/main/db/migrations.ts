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
