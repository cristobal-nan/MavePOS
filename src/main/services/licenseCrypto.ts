import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import os from 'node:os'
import { LicensePayload, LicenseValidationResult } from '../../shared/types'

export const MASTER_LICENSE_SECRET = 'MAVE_POS_OFFLINE_LICENSE_MASTER_SECRET_KEY_2026_V1'

/**
 * Obtiene el identificador de UUID crudo del hardware Windows.
 * Soporta variable de entorno MAVE_MACHINE_UUID para testing / entornos controlados.
 */
export function getRawHardwareUUID(): string {
  if (process.env.MAVE_MACHINE_UUID && process.env.MAVE_MACHINE_UUID.trim().length > 0) {
    return process.env.MAVE_MACHINE_UUID.trim()
  }

  if (process.platform === 'win32') {
    try {
      const output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        encoding: 'utf8',
        timeout: 2000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
      const match = output.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch {
      // Continuar con fallback
    }

    try {
      const psOutput = execSync(
        'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
        {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        }
      )
      const trimmed = psOutput.trim()
      if (trimmed && trimmed.length > 8 && !trimmed.toLowerCase().includes('error')) {
        return trimmed
      }
    } catch {
      // Continuar con fallback
    }
  }

  // Fallback seguro para entornos no-Windows o testing
  return `${os.hostname()}-${os.userInfo().username || 'default'}`
}

/**
 * Formatea un UUID crudo al estándar canónico MAVE-XXXX-XXXX-XXXX
 */
export function formatMachineId(rawUuid: string): string {
  const normalized = (rawUuid || 'default').trim().toLowerCase()
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').toUpperCase()
  return `MAVE-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`
}

/**
 * Valida si un string cumple estrictamente con el formato MAVE-XXXX-XXXX-XXXX
 */
export function isValidMachineId(machineId: string): boolean {
  if (typeof machineId !== 'string') return false
  return /^MAVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(machineId.trim())
}

/**
 * Firma criptográficamente un payload de licencia con HMAC-SHA256
 */
export function signLicensePayload(
  payload: LicensePayload,
  secret = MASTER_LICENSE_SECRET
): string {
  const normalizedMachineId = payload.machineId.trim().toUpperCase()
  if (!isValidMachineId(normalizedMachineId)) {
    throw new Error(
      `Identificador de máquina inválido: "${payload.machineId}". Debe tener el formato MAVE-XXXX-XXXX-XXXX`
    )
  }

  const normalizedPayload: LicensePayload = {
    machineId: normalizedMachineId,
    edition: payload.edition,
    topology: payload.topology,
    issuedAt: payload.issuedAt || new Date().toISOString().slice(0, 10),
    ...(payload.maxRegisters !== undefined ? { maxRegisters: payload.maxRegisters } : {})
  }

  const jsonStr = JSON.stringify(normalizedPayload)
  const encodedPayload = Buffer.from(jsonStr, 'utf8').toString('base64url')
  const signatureHex = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload, 'utf8')
    .digest('hex')
    .toUpperCase()

  return `${encodedPayload}.${signatureHex}`
}

/**
 * Verifica criptográficamente la integridad y pertenencia de una clave de licencia offline
 */
export function verifyLicenseKey(
  key: string,
  expectedMachineId: string,
  secret = MASTER_LICENSE_SECRET
): LicenseValidationResult {
  if (!key || typeof key !== 'string') {
    return {
      valid: false,
      error: 'invalid_format',
      message: 'La clave de activación no puede estar vacía'
    }
  }

  const cleanKey = key.trim().replace(/\s+/g, '')
  const parts = cleanKey.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      valid: false,
      error: 'invalid_format',
      message: 'Formato de clave inválido (debe contener datos y firma separados por un punto)'
    }
  }

  const [encodedPayload, receivedSig] = parts

  // Calcular firmas esperadas en Hex y Base64URL
  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload, 'utf8')
    .digest('hex')
    .toUpperCase()

  const expectedB64 = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload, 'utf8')
    .digest('base64url')

  let isSigValid = false
  if (receivedSig.length === expectedHex.length) {
    try {
      isSigValid = crypto.timingSafeEqual(
        Buffer.from(receivedSig.toUpperCase(), 'utf8'),
        Buffer.from(expectedHex, 'utf8')
      )
    } catch {
      isSigValid = false
    }
  } else if (receivedSig.length === expectedB64.length) {
    try {
      isSigValid = crypto.timingSafeEqual(
        Buffer.from(receivedSig, 'utf8'),
        Buffer.from(expectedB64, 'utf8')
      )
    } catch {
      isSigValid = false
    }
  }

  if (!isSigValid) {
    return {
      valid: false,
      error: 'invalid_signature',
      message: 'La firma de la clave es inválida o fue modificada'
    }
  }

  // Parsear el payload
  let payload: LicensePayload
  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8')
    payload = JSON.parse(jsonStr)
  } catch {
    return {
      valid: false,
      error: 'invalid_format',
      message: 'El contenido de la clave está dañado o no es legible'
    }
  }

  // Validar campos requeridos
  if (!payload.edition || (payload.edition !== 'pos' && payload.edition !== 'erp')) {
    return {
      valid: false,
      error: 'unknown_edition',
      message: 'La edición especificada en la clave no es válida'
    }
  }

  if (!payload.topology || (payload.topology !== 'single' && payload.topology !== 'multi')) {
    return {
      valid: false,
      error: 'unknown_topology',
      message: 'La topología especificada en la clave no es válida'
    }
  }

  // Validar coincidencia estricta con el machine_id esperado
  const payloadMachineId = (payload.machineId || '').trim().toUpperCase()
  const normalizedExpected = (expectedMachineId || '').trim().toUpperCase()

  if (payloadMachineId !== normalizedExpected) {
    return {
      valid: false,
      error: 'hardware_mismatch',
      message: 'Esta clave de licencia fue calculada para otro computador',
      payload: {
        ...payload,
        machineId: payloadMachineId
      }
    }
  }

  return {
    valid: true,
    payload: {
      machineId: payloadMachineId,
      edition: payload.edition,
      topology: payload.topology,
      issuedAt: payload.issuedAt,
      ...(payload.maxRegisters !== undefined ? { maxRegisters: payload.maxRegisters } : {})
    }
  }
}
