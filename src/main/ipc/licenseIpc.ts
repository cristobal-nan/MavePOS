import { ipcMain } from 'electron'
import { LicenseService } from '../services/licenseService'

export function registerLicenseIpc(licenseService: LicenseService): void {
  ipcMain.handle('license:getMachineId', () => {
    return licenseService.getMachineId()
  })

  ipcMain.handle('license:getStatus', () => {
    return licenseService.getStatus()
  })

  ipcMain.handle('license:validateKey', (_event, key: string) => {
    return licenseService.validateKey(key)
  })

  ipcMain.handle('license:activate', (_event, key: string) => {
    return licenseService.activateLicense(key)
  })

  ipcMain.handle('license:deactivate', () => {
    return licenseService.deactivateLicense()
  })
}
