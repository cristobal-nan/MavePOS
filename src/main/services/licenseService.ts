import Database from 'better-sqlite3'
import { SettingsService } from './settingsService'
import {
  MASTER_LICENSE_SECRET,
  getRawHardwareUUID,
  formatMachineId,
  verifyLicenseKey
} from './licenseCrypto'
import {
  LicenseStatus,
  LicenseValidationResult,
  ActivateLicenseResult,
  AppEdition
} from '../../shared/types'

export class LicenseService {
  private cachedMachineId: string | null = null

  constructor(
    private db: Database.Database,
    private settingsService: SettingsService,
    private secret: string = MASTER_LICENSE_SECRET
  ) {}

  /**
   * Obtiene el machine_id formateado de la máquina (cacheador en memoria tras el primer cálculo).
   */
  getMachineId(): string {
    if (!this.cachedMachineId) {
      const raw = getRawHardwareUUID()
      this.cachedMachineId = formatMachineId(raw)
    }
    return this.cachedMachineId
  }

  /**
   * Permite inyectar un machine_id específico para pruebas unitarias.
   */
  setMachineIdForTest(id: string | null): void {
    this.cachedMachineId = id
  }

  /**
   * Obtiene el estado actual de la licencia inspeccionando la configuración local de SQLite.
   * Si la clave guardada no coincide con el hardware (base de datos copiada), revoca el modo ERP.
   */
  getStatus(): LicenseStatus {
    const machineId = this.getMachineId()
    const storedKey = this.settingsService.get('license_key')
    const activatedAt = this.settingsService.get('license_activated_at')

    if (!storedKey || storedKey.trim() === '') {
      const currentEdition = (this.settingsService.get('app_edition') as AppEdition) || 'pos'
      return {
        machineId,
        edition: currentEdition === 'erp' ? 'pos' : currentEdition,
        topology: 'single',
        isActivated: false,
        licenseKey: null,
        activatedAt: null
      }
    }

    const validation = verifyLicenseKey(storedKey, machineId, this.secret)
    if (!validation.valid || !validation.payload) {
      // Protección de hardware: si la clave es inválida o pertenece a otro hardware,
      // se revoca el acceso a ERP inmediatamente en SQLite
      if (this.settingsService.get('app_edition') === 'erp') {
        this.settingsService.set('app_edition', 'pos')
      }
      return {
        machineId,
        edition: 'pos',
        topology: 'single',
        isActivated: false,
        licenseKey: null,
        activatedAt: null
      }
    }

    return {
      machineId,
      edition: validation.payload.edition,
      topology: validation.payload.topology,
      isActivated: true,
      licenseKey: storedKey,
      activatedAt: activatedAt || null
    }
  }

  /**
   * Valida una clave sin activarla aún en la base de datos.
   */
  validateKey(key: string): LicenseValidationResult {
    return verifyLicenseKey(key, this.getMachineId(), this.secret)
  }

  /**
   * Activa y persiste una clave de licencia en la base de datos local SQLite,
   * actualizando de inmediato la edición (`app_edition`) y topología activa.
   */
  activateLicense(key: string): ActivateLicenseResult {
    const machineId = this.getMachineId()
    const validation = verifyLicenseKey(key, machineId, this.secret)

    if (!validation.valid || !validation.payload) {
      return {
        success: false,
        error: validation.error,
        message: validation.message
      }
    }

    const { edition, topology } = validation.payload
    const appTopology = topology === 'single' ? 'monocaja' : 'multicaja_servidor'
    const activatedAt = new Date().toISOString()
    const cleanKey = key.trim().replace(/\s+/g, '')

    // Persistir configuración de forma consistente
    this.settingsService.set('license_key', cleanKey)
    this.settingsService.set('app_edition', edition)
    this.settingsService.set('app_topology', appTopology)
    this.settingsService.set('license_edition', edition)
    this.settingsService.set('license_topology', topology)
    this.settingsService.set('license_activated_at', activatedAt)

    return {
      success: true,
      edition,
      topology,
      status: this.getStatus()
    }
  }

  /**
   * Desactiva la licencia actual y retorna a la edición POS Estándar Monocaja.
   */
  deactivateLicense(): { success: boolean } {
    this.settingsService.set('license_key', '')
    this.settingsService.set('app_edition', 'pos')
    this.settingsService.set('app_topology', 'monocaja')
    this.settingsService.set('license_edition', 'pos')
    this.settingsService.set('license_topology', 'single')
    this.settingsService.set('license_activated_at', '')

    return { success: true }
  }
}
