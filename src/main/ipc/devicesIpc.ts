import { ipcMain, BrowserWindow } from 'electron'
import { PrinterService } from '../services/printerService'
import { PrinterConfig, SaleDetail } from '../../shared/types'

export function registerDevicesIpc(
  printerService: PrinterService,
  mainWindow: BrowserWindow
): void {
  ipcMain.handle('printers:getList', () => {
    return printerService.getInstalledPrinters(mainWindow)
  })

  ipcMain.handle('printers:getConfig', () => {
    return printerService.getPrinterConfig()
  })

  ipcMain.handle('printers:saveConfig', (_event, config: Partial<PrinterConfig>) => {
    printerService.savePrinterConfig(config)
    return { ok: true }
  })

  ipcMain.handle(
    'printers:printThermal',
    (_event, saleDetail: SaleDetail, change = 0, customConfig?: Partial<PrinterConfig>) => {
      return printerService.printThermalReceipt(saleDetail, change, customConfig)
    }
  )

  ipcMain.handle('printers:openCashDrawer', (_event, customConfig?: Partial<PrinterConfig>) => {
    return printerService.openCashDrawer(customConfig)
  })

  ipcMain.handle('printers:testThermal', (_event, customConfig?: Partial<PrinterConfig>) => {
    return printerService.printTestTicket(customConfig)
  })

  ipcMain.handle('printers:printNormal', (_event, saleDetail: SaleDetail, printerName?: string) => {
    return printerService.printNormalReceipt(saleDetail, printerName)
  })
}
