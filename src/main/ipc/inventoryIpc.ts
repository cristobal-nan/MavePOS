import { ipcMain } from 'electron'
import { InventoryService } from '../services/inventoryService'
import { AdjustStockInput, MovementType } from '../../shared/types'

export function registerInventoryIpc(inventoryService: InventoryService): void {
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
}
