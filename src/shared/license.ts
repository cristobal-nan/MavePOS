// Shared licensing domain constants and helpers
import { LicensePayload, LicenseValidationResult, AppEdition, AppTopology } from './types'

export const MASTER_LICENSE_SECRET = 'MAVE_POS_OFFLINE_LICENSE_MASTER_SECRET_KEY_2026_V1'
export const MACHINE_ID_REGEX = /^MAVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/**
 * Valida si un identificador de hardware cumple el formato MAVE-XXXX-XXXX-XXXX.
 */
export function isValidMachineId(id: unknown): boolean {
  if (typeof id !== 'string') return false
  return MACHINE_ID_REGEX.test(id.trim().toUpperCase())
}

/**
 * Normaliza un código de máquina eliminando espacios y convirtiéndolo a mayúsculas.
 */
export function normalizeMachineId(id: string): string {
  return (id || '').trim().toUpperCase()
}

/**
 * Codifica una cadena UTF-8 en formato Base64URL sin dependencias externas.
 */
export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodifica una cadena Base64URL a texto UTF-8.
 */
export function base64UrlDecode(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Convierte un ArrayBuffer de firma en un string hexadecimal en mayúsculas.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

/**
 * Firma criptográficamente un payload de licencia utilizando Web Crypto API (SubtleCrypto HMAC-SHA256).
 * Compatible con navegadores modernos, Node.js y Electron.
 */
export async function signLicenseWebCrypto(
  payload: LicensePayload,
  secret: string = MASTER_LICENSE_SECRET
): Promise<string> {
  const normalizedMid = normalizeMachineId(payload.machineId)
  if (!isValidMachineId(normalizedMid)) {
    throw new Error(
      `Identificador de máquina inválido: "${payload.machineId}". Debe tener el formato MAVE-XXXX-XXXX-XXXX`
    )
  }

  const normalizedPayload: LicensePayload = {
    machineId: normalizedMid,
    edition: payload.edition,
    topology: payload.topology,
    issuedAt: payload.issuedAt || new Date().toISOString().slice(0, 10),
    ...(payload.maxRegisters !== undefined ? { maxRegisters: payload.maxRegisters } : {})
  }

  const jsonStr = JSON.stringify(normalizedPayload)
  const encodedPayload = base64UrlEncode(jsonStr)

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBuffer = await globalThis.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(encodedPayload)
  )

  const signatureHex = bufferToHex(sigBuffer)
  return `${encodedPayload}.${signatureHex}`
}

/**
 * Formatea la firma hexadecimal en bloques legibles de 4 caracteres (XXXX-XXXX-...).
 */
export function formatHexSignatureBlocks(hex: string): string {
  if (!hex || typeof hex !== 'string') return ''
  const clean = hex.trim().replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
  const blocks: string[] = []
  for (let i = 0; i < clean.length; i += 4) {
    blocks.push(clean.slice(i, i + 4))
  }
  return blocks.join('-')
}

/**
 * Descompone una clave de activación para renderizado visual estructurado.
 */
export function decomposeLicenseKey(key: string): {
  raw: string
  payloadB64: string
  signatureHex: string
  signatureBlocks: string
  decodedPayload: LicensePayload | null
} | null {
  if (!key || typeof key !== 'string') return null
  const clean = key.trim().replace(/\s+/g, '')
  const parts = clean.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  let decoded: LicensePayload | null = null
  try {
    decoded = JSON.parse(base64UrlDecode(parts[0]))
  } catch {
    decoded = null
  }

  return {
    raw: clean,
    payloadB64: parts[0],
    signatureHex: parts[1],
    signatureBlocks: formatHexSignatureBlocks(parts[1]),
    decodedPayload: decoded
  }
}

export type { LicensePayload, LicenseValidationResult, AppEdition, AppTopology }
