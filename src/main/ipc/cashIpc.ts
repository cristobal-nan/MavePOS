import { ipcMain } from 'electron'
import { CashService } from '../services/cashService'

export function registerCashIpc(cashService: CashService): void {
  ipcMain.handle('cash:getCurrentSession', () => {
    return cashService.getCurrentOpenSession()
  })

  ipcMain.handle('cash:openSession', (_event, openingFund: number) => {
    return cashService.openSession(openingFund)
  })

  ipcMain.handle('cash:closeSession', (_event, sessionId: number, closingData?: any) => {
    return cashService.closeSession(sessionId, closingData)
  })

  ipcMain.handle('cash:getSessionSummary', (_event, sessionId: number) => {
    return cashService.getSessionSummary(sessionId)
  })

  ipcMain.handle('cash:getPastSessions', (_event, limit?: number, offset?: number) => {
    return cashService.getPastSessions(limit, offset)
  })

  ipcMain.handle('cash:addMovement', (_event, sessionId: number, amount: number, reason: string) => {
    return cashService.addMovement(sessionId, amount, reason)
  })

  ipcMain.handle('cash:getSessionMovements', (_event, sessionId: number) => {
    return cashService.getSessionMovements(sessionId)
  })
}
