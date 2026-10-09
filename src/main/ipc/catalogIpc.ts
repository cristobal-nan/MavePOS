import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { ProductService } from '../services/productService'
import { SupplierService } from '../services/supplierService'
import { ExcelService } from '../services/excelService'
import {
  ProductInput,
  ProductSearchOptions,
  GroupAsVariableInput,
  ExcelColumnMapping,
  ImportExcelOptions
} from '../../shared/types'

export function registerCatalogIpc(
  productService: ProductService,
  supplierService: SupplierService,
  excelService: ExcelService,
  mainWindow: BrowserWindow
): void {
  // Products
  ipcMain.handle('products:save', (_event, input: ProductInput) => {
    return productService.upsertProduct(input)
  })

  ipcMain.handle('products:getByCode', (_event, code: string, includeInactive = false) => {
    return productService.getProductByCode(code, includeInactive)
  })

  ipcMain.handle('products:checkCodeAvailable', (_event, code: string, excludeProductId?: number) => {
    return productService.checkProductCodeAvailable(code, excludeProductId)
  })

  ipcMain.handle('products:delete', (_event, code: string) => {
    return productService.softDeleteProduct(code)
  })

  ipcMain.handle('products:getActive', (_event, limit = 100, offset = 0) => {
    return productService.getActiveProducts(limit, offset)
  })

  ipcMain.handle('products:search', (_event, options: ProductSearchOptions) => {
    return productService.searchProducts(options)
  })

  ipcMain.handle('products:seed', () => {
    productService.seedSampleData()
    return true
  })

  ipcMain.handle('products:getById', (_event, id: number, includeInactive = false) => {
    return productService.getProductById(id, includeInactive)
  })

  ipcMain.handle('products:getVariations', (_event, parentId: number, includeInactive = false) => {
    return productService.getVariations(parentId, includeInactive)
  })

  ipcMain.handle('products:saveVariable', (_event, parent: ProductInput, variations: ProductInput[]) => {
    return productService.saveVariableProduct(parent, variations)
  })

  ipcMain.handle(
    'products:bulkUpdateCategory',
    (_event, productIds: number[], categoryId?: number | null, supplierIds?: number[]) => {
      return productService.bulkUpdateCategory(productIds, categoryId, supplierIds)
    }
  )

  ipcMain.handle('products:groupAsVariable', (_event, input: GroupAsVariableInput) => {
    return productService.groupProductsAsVariable(input)
  })

  ipcMain.handle('products:bulkDelete', (_event, productIds: number[]) => {
    return productService.bulkSoftDelete(productIds)
  })

  // Categories
  ipcMain.handle('categories:getAll', () => {
    return productService.getAllCategories()
  })

  ipcMain.handle('categories:save', (_event, name: string, parentId: number | null = null, id?: number) => {
    return productService.saveCategory(name, parentId, id)
  })

  ipcMain.handle('categories:delete', (_event, id: number) => {
    return productService.deleteCategory(id)
  })

  // Suppliers
  ipcMain.handle('suppliers:getAll', (_event, includeInactive = false) => {
    return supplierService.getAllSuppliers(includeInactive)
  })

  ipcMain.handle('suppliers:save', (_event, name: string, id?: number) => {
    return supplierService.saveSupplier(name, id)
  })

  ipcMain.handle('suppliers:delete', (_event, id: number) => {
    return supplierService.deleteSupplier(id)
  })

  // Excel
  ipcMain.handle('excel:selectFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar archivo Excel de Catálogo',
      filters: [{ name: 'Hojas de Cálculo Excel (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('excel:parseFile', (_event, filePath: string) => {
    return excelService.parseExcelFile(filePath)
  })

  ipcMain.handle(
    'excel:importFile',
    (_event, filePath: string, customMapping?: Partial<ExcelColumnMapping>, options?: ImportExcelOptions) => {
      return excelService.importExcel(filePath, customMapping, options)
    }
  )

  ipcMain.handle('excel:exportProducts', async (_event, defaultPrefix?: string, productIds?: number[]) => {
    const today = new Date().toISOString().slice(0, 10)
    const prefix = (defaultPrefix || 'Productos').trim() || 'Productos'
    const isSubset = productIds && productIds.length > 0
    const defaultFilename = isSubset ? `${prefix}_Seleccionados_${today}.xlsx` : `${prefix}_${today}.xlsx`

    const res = await dialog.showSaveDialog(mainWindow, {
      title: isSubset ? 'Guardar productos seleccionados en Excel' : 'Guardar catálogo de productos en Excel',
      defaultPath: defaultFilename,
      filters: [{ name: 'Hojas de Cálculo Excel (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (res.canceled || !res.filePath) return null

    const result = excelService.exportProducts(res.filePath, productIds)
    return {
      filePath: res.filePath,
      totalExported: result.totalExported
    }
  })

  ipcMain.handle('excel:openContainingFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
    return true
  })
}
