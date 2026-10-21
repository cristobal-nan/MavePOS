import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { INITIAL_SCHEMA } from '../main/db/schema'
import { SettingsService } from '../main/services/settingsService'
import {
  MASTER_LICENSE_SECRET,
  formatMachineId,
  isValidMachineId,
  signLicensePayload,
  verifyLicenseKey,
  getRawHardwareUUID
} from '../main/services/licenseCrypto'
import { LicenseService } from '../main/services/licenseService'

describe('Motor de Licenciamiento Backend y Hardware ID', () => {
  let db: Database.Database
  let settingsService: SettingsService
  let licenseService: LicenseService

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(INITIAL_SCHEMA)
    settingsService = new SettingsService(db)
    licenseService = new LicenseService(db, settingsService)
  })

  describe('Generación y Validación de Machine ID (Hardware ID)', () => {
    it('formatea un UUID crudo al estándar canónico MAVE-XXXX-XXXX-XXXX', () => {
      const rawUuid = 'b703c51d-7c1a-441c-b7c7-994bc3707afd'
      const machineId = formatMachineId(rawUuid)

      expect(machineId).toMatch(/^MAVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(machineId.length).toBe(19)
    })

    it('es determinista: el mismo hardware produce idéntico machine_id de forma consistente', () => {
      const rawUuid = '03C00218-044D-0532-5106-AB0700080009'
      const id1 = formatMachineId(rawUuid)
      const id2 = formatMachineId(rawUuid)
      const id3 = formatMachineId(rawUuid.toLowerCase())

      expect(id1).toBe(id2)
      expect(id1).toBe(id3)
    })

    it('genera identificadores distintos para computadores con distinto UUID', () => {
      const idA = formatMachineId('b703c51d-7c1a-441c-b7c7-994bc3707afd')
      const idB = formatMachineId('03c00218-044d-0532-5106-ab0700080009')

      expect(idA).not.toBe(idB)
    })

    it('valida correctamente el formato de machine_id', () => {
      expect(isValidMachineId('MAVE-1A2B-3C4D-5E6F')).toBe(true)
      expect(isValidMachineId('MAVE-0000-1111-2222')).toBe(true)

      expect(isValidMachineId('')).toBe(false)
      expect(isValidMachineId('INVALID-1234')).toBe(false)
      expect(isValidMachineId('MAVE-1A2B-3C4D')).toBe(false)
      expect(isValidMachineId('MAVE-1a2b-3c4d-5e6f')).toBe(false) // debe ser mayúsculas
    })

    it('obtiene el UUID de hardware o usa MAVE_MACHINE_UUID de entorno si está configurado', () => {
      const originalEnv = process.env.MAVE_MACHINE_UUID
      try {
        process.env.MAVE_MACHINE_UUID = 'TEST-ENV-UUID-12345'
        const uuid = getRawHardwareUUID()
        expect(uuid).toBe('TEST-ENV-UUID-12345')

        const machineId = formatMachineId(uuid)
        expect(isValidMachineId(machineId)).toBe(true)
      } finally {
        if (originalEnv !== undefined) {
          process.env.MAVE_MACHINE_UUID = originalEnv
        } else {
          delete process.env.MAVE_MACHINE_UUID
        }
      }
    })
  })

  describe('Criptografía Offline (HMAC-SHA256)', () => {
    const testMachineId = 'MAVE-A1B2-C3D4-E5F6'

    it('firma y valida correctamente una licencia POS Monocaja', () => {
      const key = signLicensePayload({
        machineId: testMachineId,
        edition: 'pos',
        topology: 'single'
      })

      expect(typeof key).toBe('string')
      expect(key).toContain('.')

      const result = verifyLicenseKey(key, testMachineId)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.payload?.machineId).toBe(testMachineId)
      expect(result.payload?.edition).toBe('pos')
      expect(result.payload?.topology).toBe('single')
    })

    it('firma y valida correctamente una licencia POS + ERP Multicaja', () => {
      const key = signLicensePayload({
        machineId: testMachineId,
        edition: 'erp',
        topology: 'multi',
        issuedAt: '2026-10-21'
      })

      const result = verifyLicenseKey(key, testMachineId)
      expect(result.valid).toBe(true)
      expect(result.payload?.edition).toBe('erp')
      expect(result.payload?.topology).toBe('multi')
      expect(result.payload?.issuedAt).toBe('2026-10-21')
    })

    it('ignora espacios o saltos de línea accidentales al validar la clave', () => {
      const key = signLicensePayload({
        machineId: testMachineId,
        edition: 'erp',
        topology: 'single'
      })

      const pastedWithSpaces = `  ${key.slice(0, 30)} \n ${key.slice(30)}   `
      const result = verifyLicenseKey(pastedWithSpaces, testMachineId)
      expect(result.valid).toBe(true)
      expect(result.payload?.edition).toBe('erp')
    })

    it('rechaza con error hardware_mismatch cuando la clave pertenece a otra máquina', () => {
      const otherMachineId = 'MAVE-9999-8888-7777'
      const keyForOther = signLicensePayload({
        machineId: otherMachineId,
        edition: 'erp',
        topology: 'single'
      })

      const result = verifyLicenseKey(keyForOther, testMachineId)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('hardware_mismatch')
      expect(result.payload?.machineId).toBe(otherMachineId)
    })

    it('rechaza con error invalid_signature cuando la firma es alterada o corrupta', () => {
      const key = signLicensePayload({
        machineId: testMachineId,
        edition: 'erp',
        topology: 'single'
      })

      const [payload, sig] = key.split('.')
      // Alterar el último carácter de la firma
      const corruptedSig = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0')
      const tamperedKey = `${payload}.${corruptedSig}`

      const result = verifyLicenseKey(tamperedKey, testMachineId)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('invalid_signature')
    })

    it('rechaza con error invalid_signature cuando el payload base64url fue modificado', () => {
      const key = signLicensePayload({
        machineId: testMachineId,
        edition: 'pos',
        topology: 'single'
      })

      const parts = key.split('.')
      // Reemplazar payload por otro
      const fakePayload = Buffer.from(
        JSON.stringify({ machineId: testMachineId, edition: 'erp', topology: 'single' })
      ).toString('base64url')

      const tamperedKey = `${fakePayload}.${parts[1]}`
      const result = verifyLicenseKey(tamperedKey, testMachineId)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('invalid_signature')
    })

    it('rechaza con error invalid_signature si fue firmada con un secreto diferente', () => {
      const wrongSecret = 'SECRETO_DIFERENTE_HACKER'
      const key = signLicensePayload(
        {
          machineId: testMachineId,
          edition: 'erp',
          topology: 'single'
        },
        wrongSecret
      )

      const result = verifyLicenseKey(key, testMachineId, MASTER_LICENSE_SECRET)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('invalid_signature')
    })

    it('rechaza con error invalid_format cadenas malformadas sin separador de firma', () => {
      expect(verifyLicenseKey('CLAVE_TOTALMENTE_INVALIDA', testMachineId).error).toBe('invalid_format')
      expect(verifyLicenseKey('', testMachineId).error).toBe('invalid_format')
    })
  })

  describe('LicenseService: Activación y Persistencia en SQLite', () => {
    const fixedMachineId = 'MAVE-7777-8888-9999'

    beforeEach(() => {
      licenseService.setMachineIdForTest(fixedMachineId)
    })

    it('inicia en modo POS Estándar sin activación previa', () => {
      const status = licenseService.getStatus()

      expect(status.machineId).toBe(fixedMachineId)
      expect(status.isActivated).toBe(false)
      expect(status.edition).toBe('pos')
      expect(status.topology).toBe('single')
      expect(status.licenseKey).toBeNull()
    })

    it('activa exitosamente una clave ERP, persistiendo configuración y actualizando la edición inmediatamente', () => {
      const erpKey = signLicensePayload({
        machineId: fixedMachineId,
        edition: 'erp',
        topology: 'single'
      })

      const activation = licenseService.activateLicense(erpKey)

      expect(activation.success).toBe(true)
      expect(activation.edition).toBe('erp')
      expect(activation.topology).toBe('single')

      // Verificar persistencia en base de datos
      expect(settingsService.get('app_edition')).toBe('erp')
      expect(settingsService.get('app_topology')).toBe('monocaja')
      expect(settingsService.get('license_key')).toBe(erpKey)
      expect(settingsService.get('license_activated_at')).toBeTruthy()

      // Consultar estado tras activación
      const status = licenseService.getStatus()
      expect(status.isActivated).toBe(true)
      expect(status.edition).toBe('erp')
      expect(status.topology).toBe('single')
      expect(status.licenseKey).toBe(erpKey)
    })

    it('persiste multicaja_servidor cuando la topología de la licencia es multi', () => {
      const multiKey = signLicensePayload({
        machineId: fixedMachineId,
        edition: 'erp',
        topology: 'multi'
      })

      const activation = licenseService.activateLicense(multiKey)
      expect(activation.success).toBe(true)
      expect(settingsService.get('app_topology')).toBe('multicaja_servidor')
    })

    it('rechaza activación con error si la clave es de otra máquina y no modifica app_edition', () => {
      const alienKey = signLicensePayload({
        machineId: 'MAVE-1111-2222-3333',
        edition: 'erp',
        topology: 'single'
      })

      const activation = licenseService.activateLicense(alienKey)

      expect(activation.success).toBe(false)
      expect(activation.error).toBe('hardware_mismatch')
      expect(settingsService.get('app_edition', 'pos')).toBe('pos')
      expect(licenseService.getStatus().isActivated).toBe(false)
    })

    it('revierte a POS estándar si la base de datos clonada contiene una clave que no corresponde al hardware actual', () => {
      // Simular que la base de datos viene con licencia de otra máquina
      const alienKey = signLicensePayload({
        machineId: 'MAVE-0000-0000-0000',
        edition: 'erp',
        topology: 'single'
      })
      settingsService.set('license_key', alienKey)
      settingsService.set('app_edition', 'erp')

      // Al consultar el estado en la máquina actual (fixedMachineId)
      const status = licenseService.getStatus()

      expect(status.isActivated).toBe(false)
      expect(status.edition).toBe('pos')
      // Debe revocar app_edition en SQLite
      expect(settingsService.get('app_edition')).toBe('pos')
    })

    it('desactiva la licencia limpiando clave y restaurando POS estándar', () => {
      const erpKey = signLicensePayload({
        machineId: fixedMachineId,
        edition: 'erp',
        topology: 'single'
      })
      licenseService.activateLicense(erpKey)
      expect(licenseService.getStatus().isActivated).toBe(true)

      const result = licenseService.deactivateLicense()
      expect(result.success).toBe(true)

      const status = licenseService.getStatus()
      expect(status.isActivated).toBe(false)
      expect(status.edition).toBe('pos')
      expect(settingsService.get('app_edition')).toBe('pos')
      expect(settingsService.get('license_key')).toBe('')
    })
  })
})
