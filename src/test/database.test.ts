import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../main/db/migrations'
import { ProductService } from '../main/services/productService'
import { CashService } from '../main/services/cashService'
import { SettingsService } from '../main/services/settingsService'
import { BackupService, MAX_BACKUPS_RETENTION } from '../main/services/backupService'
import { normalizeSearchName } from '../main/db/utils'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Fase 2: Datos, Esquema, Servicios y Backup', () => {
  let db: Database.Database
  let productService: ProductService
  let cashService: CashService
  let settingsService: SettingsService

  beforeEach(() => {
    // In-memory SQLite for fast and isolated tests
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    productService = new ProductService(db)
    cashService = new CashService(db)
    settingsService = new SettingsService(db)
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('Esquema y Migraciones', () => {
    it('debe crear todas las tablas esperadas y registrar la migración v1', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC")
        .all() as { name: string }[]
      const tableNames = tables.map((t) => t.name)

      expect(tableNames).toContain('categories')
      expect(tableNames).toContain('products')
      expect(tableNames).toContain('sales')
      expect(tableNames).toContain('sale_items')
      expect(tableNames).toContain('sale_payments')
      expect(tableNames).toContain('inventory_movements')
      expect(tableNames).toContain('cash_sessions')
      expect(tableNames).toContain('cash_movements')
      expect(tableNames).toContain('settings')
      expect(tableNames).toContain('schema_migrations')

      const migration = db.prepare('SELECT * FROM schema_migrations WHERE version = 1').get() as any
      expect(migration).toBeDefined()
      expect(migration.version).toBe(1)
    })
  })

  describe('Categorías (Exactamente 2 niveles: Depto -> Subcat)', () => {
    it('permite crear categorías de nivel 1 (parent_id = null)', () => {
      const depto = productService.saveCategory('Lanas')
      expect(depto.id).toBeDefined()
      expect(depto.name).toBe('Lanas')
      expect(depto.parent_id).toBeNull()
    })

    it('permite crear subcategorías de nivel 2 con padre válido', () => {
      const depto = productService.saveCategory('Lanas')
      const subcat = productService.saveCategory('Gruesas', depto.id)
      expect(subcat.parent_id).toBe(depto.id)
    })

    it('RECHAZA crear un tercer nivel (subcategoría de una subcategoría)', () => {
      const depto = productService.saveCategory('Lanas')
      const subcat = productService.saveCategory('Gruesas', depto.id)
      expect(() => {
        productService.saveCategory('Extra Gruesas', subcat.id)
      }).toThrow(/No se permiten más de 2 niveles/)
    })
  })

  describe('Productos (Upsert, Normalización y Soft Delete)', () => {
    it('normaliza correctamente el search_name (mayúsculas y sin tildes)', () => {
      expect(normalizeSearchName('Algodón Negro')).toBe('ALGODON NEGRO')
      expect(normalizeSearchName('   hilo súper fino   ')).toBe('HILO SUPER FINO')
    })

    it('crea un producto nuevo y calcula search_name correctamente', () => {
      const prod = productService.upsertProduct({
        code: 'PROD001',
        name: 'Algodón Rústico Azul',
        sale_price: 3500,
        cost_price: 2000,
        stock: 50,
        min_stock: 5
      })

      expect(prod.code).toBe('PROD001')
      expect(prod.name).toBe('Algodón Rústico Azul')
      expect(prod.search_name).toBe('ALGODON RUSTICO AZUL')
      expect(prod.sale_price).toBe(3500)
      expect(prod.active).toBe(1)
    })

    it('realiza UPSERT: actualiza datos de un producto si el código ya existe', () => {
      productService.upsertProduct({
        code: 'PROD001',
        name: 'Algodón Rústico Azul',
        sale_price: 3500
      })

      const updated = productService.upsertProduct({
        code: 'PROD001',
        name: 'Algodón Rústico Azul Marino',
        sale_price: 3990,
        stock: 45
      })

      expect(updated.code).toBe('PROD001')
      expect(updated.name).toBe('Algodón Rústico Azul Marino')
      expect(updated.search_name).toBe('ALGODON RUSTICO AZUL MARINO')
      expect(updated.sale_price).toBe(3990)
      expect(updated.stock).toBe(45)
    })

    it('realiza SOFT DELETE (active = 0) preservando la fila en base de datos', () => {
      productService.upsertProduct({
        code: 'PROD_DEL',
        name: 'Producto a eliminar',
        sale_price: 1500
      })

      const deleted = productService.softDeleteProduct('PROD_DEL')
      expect(deleted).toBe(true)

      // Regular active query does not return it
      const activeProd = productService.getProductByCode('PROD_DEL', false)
      expect(activeProd).toBeNull()

      // Active products list does not include it
      const activeList = productService.getActiveProducts()
      expect(activeList.some((p) => p.code === 'PROD_DEL')).toBe(false)

      // Query including inactive returns it with active = 0
      const storedProd = productService.getProductByCode('PROD_DEL', true)
      expect(storedProd).not.toBeNull()
      expect(storedProd?.active).toBe(0)
    })

    it('si se vuelve a hacer upsert de un producto eliminado, se reactiva (active = 1)', () => {
      productService.upsertProduct({
        code: 'PROD_REACT',
        name: 'Producto Reactivar',
        sale_price: 1000
      })
      productService.softDeleteProduct('PROD_REACT')

      productService.upsertProduct({
        code: 'PROD_REACT',
        name: 'Producto Reactivado',
        sale_price: 1200
      })

      const reactivated = productService.getProductByCode('PROD_REACT')
      expect(reactivated).not.toBeNull()
      expect(reactivated?.active).toBe(1)
      expect(reactivated?.name).toBe('Producto Reactivado')
    })

    it('crea un Producto Variable con Variaciones y aplica soft delete en cascada a sus variaciones', () => {
      const { parent, variations } = productService.saveVariableProduct(
        {
          name: 'Algodón Rústico',
          attribute_name: 'Color'
        },
        [
          {
            code: 'VAR_ROJO',
            name: 'Algodón Rústico Rojo',
            attribute_value: 'Rojo',
            sale_price: 3500,
            stock: 20
          },
          {
            code: 'VAR_AZUL',
            name: 'Algodón Rústico Azul',
            attribute_value: 'Azul',
            sale_price: 3500,
            stock: 15
          }
        ]
      )

      expect(parent.id).toBeDefined()
      expect(parent.product_type).toBe('variable')
      expect(variations).toHaveLength(2)
      expect(variations[0].parent_id).toBe(parent.id)
      expect(variations[0].product_type).toBe('variation')
      expect(variations[0].attribute_name).toBe('Color')
      expect(variations[0].attribute_value).toBe('Rojo')

      // Soft delete del padre debe desactivar al padre y a sus variaciones
      productService.softDeleteProduct(parent.id!)

      const activeParent = productService.getProductById(parent.id!, false)
      expect(activeParent).toBeNull()

      const activeVariations = productService.getVariations(parent.id!, false)
      expect(activeVariations).toHaveLength(0)

      // Verificamos que las variaciones sigan existiendo en BD con active = 0
      const storedVariations = productService.getVariations(parent.id!, true)
      expect(storedVariations).toHaveLength(2)
      expect(storedVariations.every((v) => v.active === 0)).toBe(true)
    })
  })

  describe('Control de Sesión de Caja', () => {
    it('permite abrir una sesión de caja con fondo inicial', () => {
      const session = cashService.openSession(50000)
      expect(session.id).toBeDefined()
      expect(session.opening_fund).toBe(50000)
      expect(session.closed_at).toBeNull()

      const current = cashService.getCurrentOpenSession()
      expect(current?.id).toBe(session.id)
    })

    it('no permite abrir una segunda sesión si ya hay una abierta', () => {
      cashService.openSession(50000)
      expect(() => {
        cashService.openSession(30000)
      }).toThrow(/Ya existe una sesión de caja abierta/)
    })

    it('permite cerrar la sesión de caja abierta', () => {
      const session = cashService.openSession(50000)
      const closed = cashService.closeSession(session.id)
      expect(closed.closed_at).not.toBeNull()

      const current = cashService.getCurrentOpenSession()
      expect(current).toBeNull()
    })

    it('registra salidas de dinero en una sesión activa', () => {
      const session = cashService.openSession(50000)
      const mov = cashService.addMovement(session.id, 5000, 'Compra insumos de limpieza')

      expect(mov.type).toBe('salida')
      expect(mov.amount).toBe(5000)
      expect(mov.reason).toBe('Compra insumos de limpieza')

      const movements = cashService.getSessionMovements(session.id)
      expect(movements).toHaveLength(1)
      expect(movements[0].amount).toBe(5000)
    })
  })

  describe('Configuración (Settings)', () => {
    it('permite guardar y recuperar configuraciones', () => {
      settingsService.set('printer_type', 'thermal_80mm')
      settingsService.set('backup_retention', '7')

      expect(settingsService.get('printer_type')).toBe('thermal_80mm')
      expect(settingsService.get('backup_retention')).toBe('7')
      expect(settingsService.get('inexistente', 'defecto')).toBe('defecto')
    })
  })

  describe('Servicio de Respaldos y Retención de 7 archivos', () => {
    it('crea respaldo consistente con db.backup() y retiene como máximo 7 archivos', async () => {
      // Create a temporary backup directory on disk
      const tempDir = mkdtempSync(join(tmpdir(), 'pos-backup-test-'))

      try {
        const backupService = new BackupService(db, settingsService)

        // Generate 9 backups
        for (let i = 1; i <= 9; i++) {
          // Add some data to ensure database content
          settingsService.set(`backup_run_${i}`, `val_${i}`)
          await backupService.createBackup(tempDir)
          // Small sleep to ensure distinct timestamps/mtime
          await new Promise((resolve) => setTimeout(resolve, 15))
        }

        const backups = backupService.listBackups(tempDir)
        // Check that retention strictly kept only the latest 7 backups
        expect(backups.length).toBe(MAX_BACKUPS_RETENTION)
        expect(MAX_BACKUPS_RETENTION).toBe(7)

        const filesOnDisk = readdirSync(tempDir).filter((f) => f.endsWith('.db'))
        expect(filesOnDisk.length).toBe(7)
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })
})
