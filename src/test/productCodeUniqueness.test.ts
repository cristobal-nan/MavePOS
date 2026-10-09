import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { runMigrations } from '../main/db/migrations'
import { ProductService } from '../main/services/productService'
import { ExcelService } from '../main/services/excelService'
import { SalesService } from '../main/services/salesService'
import { CashService } from '../main/services/cashService'

describe('Garantía de Unicidad Estricta de Códigos de Producto y Liberación en Soft Delete', () => {
  let db: Database.Database
  let productService: ProductService
  let excelService: ExcelService
  let salesService: SalesService
  let cashService: CashService
  let tempFilePath: string

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)

    productService = new ProductService(db)
    excelService = new ExcelService(db)
    salesService = new SalesService(db)
    cashService = new CashService(db)

    tempFilePath = path.join(os.tmpdir(), `test_uniqueness_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`)
  })

  afterEach(() => {
    if (db) db.close()
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath)
      } catch {}
    }
  })

  describe('Validación de Unicidad en Creación y Edición de Productos', () => {
    it('no permite crear dos productos simples con el mismo código', () => {
      productService.upsertProduct({
        code: 'CODE-100',
        name: 'Madeja Lana Roja',
        sale_price: 3500
      })

      expect(() => {
        productService.upsertProduct({
          code: 'CODE-100',
          name: 'Madeja Lana Azul',
          sale_price: 4000
        })
      }).toThrow(/ya está registrado en el producto 'Madeja Lana Roja'/)
    })

    it('permite a un producto conservar su propio código al editar otros campos', () => {
      const prod = productService.upsertProduct({
        code: 'CODE-200',
        name: 'Hilo Rústico',
        sale_price: 2500
      })

      const updated = productService.upsertProduct({
        id: prod.id,
        code: 'CODE-200',
        name: 'Hilo Rústico Premium',
        sale_price: 2990
      })

      expect(updated.id).toBe(prod.id)
      expect(updated.name).toBe('Hilo Rústico Premium')
      expect(updated.code).toBe('CODE-200')
    })

    it('no permite a un producto modificar su código por el de otro producto existente', () => {
      productService.upsertProduct({
        code: 'CODE-AAA',
        name: 'Producto A',
        sale_price: 1000
      })

      const prodB = productService.upsertProduct({
        code: 'CODE-BBB',
        name: 'Producto B',
        sale_price: 2000
      })

      expect(() => {
        productService.upsertProduct({
          id: prodB.id,
          code: 'CODE-AAA',
          name: 'Producto B con código robado',
          sale_price: 2000
        })
      }).toThrow(/ya está registrado en el producto 'Producto A'/)
    })

    it('checkProductCodeAvailable verifica disponibilidad y respeta excludeProductId', () => {
      const prod = productService.upsertProduct({
        code: 'CHECK-01',
        name: 'Algodón Crudo',
        sale_price: 3000
      })

      // Código existente sin excluir
      const check1 = productService.checkProductCodeAvailable('CHECK-01')
      expect(check1.available).toBe(false)
      expect(check1.conflictProductName).toBe('Algodón Crudo')

      // Mismo código excluyendo el propio ID del producto (caso edición)
      const check2 = productService.checkProductCodeAvailable('CHECK-01', prod.id)
      expect(check2.available).toBe(true)

      // Código completamente libre
      const check3 = productService.checkProductCodeAvailable('LIBRE-99')
      expect(check3.available).toBe(true)
    })
  })

  describe('Unicidad en Productos Variables y Variaciones', () => {
    it('rechaza guardar un producto variable si dos de sus variaciones tienen el mismo código', () => {
      expect(() => {
        productService.saveVariableProduct(
          {
            name: 'Lana Merino Multicolor',
            attribute_name: 'Color'
          },
          [
            {
              code: 'VAR-DUP',
              name: 'Lana Merino Multicolor Rojo',
              attribute_name: 'Color',
              attribute_value: 'Rojo',
              sale_price: 5000,
              stock: 10
            },
            {
              code: 'VAR-DUP',
              name: 'Lana Merino Multicolor Azul',
              attribute_name: 'Color',
              attribute_value: 'Azul',
              sale_price: 5000,
              stock: 10
            }
          ]
        )
      }).toThrow(/está repetido en la variación/)
    })

    it('rechaza una variación cuyo código ya está registrado en un producto simple', () => {
      productService.upsertProduct({
        code: 'EXISTING-SIMPLE',
        name: 'Crochet Bambú',
        sale_price: 1200
      })

      expect(() => {
        productService.saveVariableProduct(
          {
            name: 'Trapillo Bobina',
            attribute_name: 'Color'
          },
          [
            {
              code: 'EXISTING-SIMPLE',
              name: 'Trapillo Bobina Mostaza',
              attribute_name: 'Color',
              attribute_value: 'Mostaza',
              sale_price: 4500,
              stock: 5
            }
          ]
        )
      }).toThrow(/ya está registrado en el producto 'Crochet Bambú'/)
    })
  })

  describe('Liberación de Código en Soft Delete y Protección Referencial', () => {
    it('al eliminar un producto (soft delete), libera su código y permite registrar inmediatamente uno nuevo con ese código', () => {
      const prodOriginal = productService.upsertProduct({
        code: '78012345',
        name: 'Producto Temporal',
        sale_price: 1000
      })

      // Eliminar el producto
      const deleted = productService.softDeleteProduct('78012345')
      expect(deleted).toBe(true)

      // El producto original ya no está activo
      expect(productService.getProductByCode('78012345', false)).toBeNull()

      // El código original está disponible
      expect(productService.checkProductCodeAvailable('78012345').available).toBe(true)

      // El producto original se renombró a 78012345_deleted1
      const archived = productService.getProductById(prodOriginal.id!, true)
      expect(archived?.active).toBe(0)
      expect(archived?.code).toBe('78012345_deleted1')

      // Ahora podemos crear un nuevo producto con el código liberado 78012345
      const nuevoProd = productService.upsertProduct({
        code: '78012345',
        name: 'Producto Nuevo Reutilizando Código',
        sale_price: 2500
      })

      expect(nuevoProd.code).toBe('78012345')
      expect(nuevoProd.name).toBe('Producto Nuevo Reutilizando Código')
      expect(nuevoProd.active).toBe(1)
      expect(nuevoProd.id).not.toBe(prodOriginal.id)
    })

    it('actualiza referencias de Kardex y Venta cuando un producto es soft-deleted', () => {
      const session = cashService.openSession(10000)

      // Crear producto
      const prod = productService.upsertProduct({
        code: 'KARDEX-CODE',
        name: 'Madeja Merino',
        sale_price: 5000,
        stock: 10
      })

      // Realizar una venta
      salesService.completeSale({
        cashSessionId: session.id,
        items: [{ product_code: 'KARDEX-CODE', name: 'Madeja Merino', unit_price: 5000, quantity: 2 }],
        payments: [{ method: 'cash', amount: 10000 }]
      })

      // Eliminar el producto (soft delete)
      productService.softDeleteProduct('KARDEX-CODE')

      // Verificar que los movimientos de kardex se actualizaron a KARDEX-CODE_deleted1
      const movements = db
        .prepare('SELECT product_code FROM inventory_movements WHERE product_code = ?')
        .all('KARDEX-CODE_deleted1') as any[]
      expect(movements.length).toBeGreaterThan(0)

      // Verificar que los ítems de venta se actualizaron a KARDEX-CODE_deleted1
      const saleItems = db
        .prepare('SELECT product_code FROM sale_items WHERE product_code = ?')
        .all('KARDEX-CODE_deleted1') as any[]
      expect(saleItems.length).toBeGreaterThan(0)
    })
  })

  describe('Importación Excel y Control de Duplicados', () => {
    const createWorkbook = (rows: any[][]) => {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Catálogo')
      XLSX.writeFile(wb, tempFilePath)
    }

    it('en modo create_only (por defecto): omite filas cuyo código ya existe en el sistema sin sobreescribir', () => {
      // Producto preexistente en la base de datos
      productService.upsertProduct({
        code: 'EXISTING-01',
        name: 'Hilo Existente Original',
        sale_price: 3000,
        stock: 50
      })

      // Excel con 1 existente y 1 nuevo
      createWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['EXISTING-01', 'Hilo Intento Sobreescritura', '1500', '4990', '999', '5', 'Hilos'],
        ['NUEVO-01', 'Aguja Circular 80cm', '800', '2500', '20', '3', 'Accesorios']
      ])

      const report = excelService.importExcel(tempFilePath, undefined, {
        duplicateCodeAction: 'create_only'
      })

      expect(report.totalRows).toBe(2)
      expect(report.createdCount).toBe(1)
      expect(report.updatedCount).toBe(0)
      expect(report.skippedCount).toBe(1)
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].code).toBe('EXISTING-01')
      expect(report.errors[0].reason).toContain('ya existe en el sistema')

      // Verificar que el producto existente no fue sobreescrito
      const original = productService.getProductByCode('EXISTING-01')
      expect(original?.name).toBe('Hilo Existente Original')
      expect(original?.sale_price).toBe(3000)
      expect(original?.stock).toBe(50)

      // Verificar que el nuevo sí se creó
      const nuevo = productService.getProductByCode('NUEVO-01')
      expect(nuevo?.name).toBe('Aguja Circular 80cm')
    })

    it('en modo allow_update: actualiza el producto existente por su código', () => {
      productService.upsertProduct({
        code: 'EXISTING-02',
        name: 'Algodón Tradicional',
        sale_price: 2000,
        stock: 10
      })

      createWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['EXISTING-02', 'Algodón Tradicional Actualizado', '1000', '2800', '35', '5', 'Hilos']
      ])

      const report = excelService.importExcel(tempFilePath, undefined, {
        duplicateCodeAction: 'allow_update',
        updateStock: true
      })

      expect(report.totalRows).toBe(1)
      expect(report.createdCount).toBe(0)
      expect(report.updatedCount).toBe(1)
      expect(report.skippedCount).toBe(0)

      const updated = productService.getProductByCode('EXISTING-02')
      expect(updated?.name).toBe('Algodón Tradicional Actualizado')
      expect(updated?.sale_price).toBe(2800)
      expect(updated?.stock).toBe(35)
    })

    it('detecta códigos duplicados dentro del mismo archivo Excel y omite la fila repetida', () => {
      createWorkbook([
        ['Código', 'Producto', 'P. Costo', 'P. Venta', 'Existencia', 'Inv. Mínimo', 'Departamento'],
        ['SAME-CODE', 'Primer Producto del Archivo', '1000', '2500', '10', '2', 'Lanas'],
        ['SAME-CODE', 'Segundo Producto con Código Repetido', '1200', '3000', '15', '2', 'Lanas']
      ])

      const report = excelService.importExcel(tempFilePath, undefined, {
        duplicateCodeAction: 'create_only'
      })

      expect(report.totalRows).toBe(2)
      expect(report.createdCount).toBe(1)
      expect(report.skippedCount).toBe(1)
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].code).toBe('SAME-CODE')
      expect(report.errors[0].reason).toContain('ya aparece duplicado en la fila 2 de este archivo')

      // El primer producto se creó con su nombre
      const prod = productService.getProductByCode('SAME-CODE')
      expect(prod?.name).toBe('Primer Producto del Archivo')
    })
  })
})
