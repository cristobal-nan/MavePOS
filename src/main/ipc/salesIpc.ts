import { ipcMain } from 'electron'
import { SalesService } from '../services/salesService'
import {
  CartItem,
  CompleteSaleInput,
  SalesHistoryFilter
} from '../../shared/types'

export function registerSalesIpc(salesService: SalesService): void {
  ipcMain.handle('sales:getNextFolio', () => {
    return salesService.getNextFolio()
  })

  ipcMain.handle(
    'sales:getNextTicketNumber',
    (_event, openTickets?: number[], cashSessionId?: number) => {
      return salesService.getNextTicketNumber(openTickets, cashSessionId)
    }
  )

  ipcMain.handle('sales:getPending', (_event, cashSessionId?: number) => {
    return salesService.getPendingSales(cashSessionId)
  })

  ipcMain.handle(
    'sales:savePending',
    (_event, data: { id?: number; cashSessionId: number | null; items: CartItem[] }) => {
      return salesService.savePendingSale(data)
    }
  )

  ipcMain.handle('sales:deletePending', (_event, saleId: number) => {
    return salesService.deletePendingSale(saleId)
  })

  ipcMain.handle('sales:complete', (_event, input: CompleteSaleInput) => {
    return salesService.completeSale(input)
  })

  ipcMain.handle('sales:getHistory', (_event, filter?: SalesHistoryFilter) => {
    return salesService.getSalesHistory(filter)
  })

  ipcMain.handle('sales:getDetail', (_event, saleId: number) => {
    return salesService.getSaleDetail(saleId)
  })

  ipcMain.handle('sales:cancel', (_event, saleId: number, reason?: string) => {
    return salesService.cancelSale(saleId, reason)
  })

  ipcMain.handle(
    'sales:returnItem',
    (_event, saleId: number, productCode: string, quantity: number, reason?: string) => {
      return salesService.returnSaleItem(saleId, productCode, quantity, reason)
    }
  )
}
