import { ipcMain, dialog, BrowserWindow } from 'electron'
import { InventoryService } from '../services/inventoryService'
import { ExcelService } from '../services/excelService'
import { AdjustStockInput, MovementType, InventoryMovementDetail } from '../../shared/types'

export function registerInventoryIpc(
  inventoryService: InventoryService,
  excelService: ExcelService,
  mainWindow: BrowserWindow
): void {
  ipcMain.handle('inventory:adjustStock', (_event, input: AdjustStockInput) => {
    return inventoryService.adjustStock(input)
  })

  ipcMain.handle('inventory:getLowStock', (_event, limit = 100, offset = 0) => {
    return inventoryService.getLowStockProducts(limit, offset)
  })

  ipcMain.handle('inventory:getMovements', (_event, dateStr?: string, type?: MovementType) => {
    return inventoryService.getMovementsByDate(dateStr, type)
  })

  ipcMain.handle('inventory:getKardex', (_event, productCode: string, limit = 100) => {
    return inventoryService.getProductKardex(productCode, limit)
  })

  ipcMain.handle(
    'inventory:exportMovementsExcel',
    async (_event, dateStr: string, movements: InventoryMovementDetail[]) => {
      const defaultFilename = `Movimientos_${dateStr || new Date().toISOString().slice(0, 10)}.xlsx`
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Guardar Movimientos por Día en Excel',
        defaultPath: defaultFilename,
        filters: [{ name: 'Hojas de Cálculo Excel (*.xlsx)', extensions: ['xlsx'] }]
      })

      if (res.canceled || !res.filePath) return null

      const result = excelService.exportMovements(res.filePath, movements)
      return result
    }
  )

  ipcMain.handle(
    'inventory:exportKardexExcel',
    async (
      _event,
      productInfo: { code: string; name: string; category_name?: string | null; current_stock: number },
      limit?: number
    ) => {
      // Si limit no viene especificado o es undefined, trae todo el historial completo
      const allMovements = inventoryService.getProductKardex(productInfo.code, limit)
      const sanitizedCode = (productInfo.code || 'Producto').replace(/[/\\?%*:|"<>]/g, '_')
      const today = new Date().toISOString().slice(0, 10)
      const defaultFilename = `Kardex_${sanitizedCode}_${today}.xlsx`

      const res = await dialog.showSaveDialog(mainWindow, {
        title: `Guardar Kardex de ${productInfo.name} en Excel`,
        defaultPath: defaultFilename,
        filters: [{ name: 'Hojas de Cálculo Excel (*.xlsx)', extensions: ['xlsx'] }]
      })

      if (res.canceled || !res.filePath) return null

      const result = excelService.exportKardex(res.filePath, productInfo, allMovements)
      return result
    }
  )
}
