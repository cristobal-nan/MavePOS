import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  signLicenseWebCrypto,
  isValidMachineId,
  normalizeMachineId,
  formatHexSignatureBlocks,
  decomposeLicenseKey,
  MASTER_LICENSE_SECRET
} from '../shared/license'
import {
  signLicensePayload,
  verifyLicenseKey,
  MASTER_LICENSE_SECRET as BACKEND_SECRET
} from '../main/services/licenseCrypto'

describe('Generador de Licencias — Criptografía Web Crypto y Compatibilidad Backend', () => {
  it('comparte el mismo secreto maestro de firma entre backend y generador', () => {
    expect(MASTER_LICENSE_SECRET).toBe(BACKEND_SECRET)
    expect(MASTER_LICENSE_SECRET).toBe('MAVE_POS_OFFLINE_LICENSE_MASTER_SECRET_KEY_2026_V1')
  })

  it('firma con Web Crypto produciendo exactamente la misma clave que el motor backend (Node crypto)', async () => {
    const payload = {
      machineId: 'MAVE-A1B2-C3D4-E5F6',
      edition: 'erp' as const,
      topology: 'single' as const,
      issuedAt: '2026-10-21'
    }

    const nodeKey = signLicensePayload(payload)
    const webKey = await signLicenseWebCrypto(payload)

    expect(webKey).toBe(nodeKey)

    // Verificación mutua en el backend
    const verifyResult = verifyLicenseKey(webKey, payload.machineId)
    expect(verifyResult.valid).toBe(true)
    expect(verifyResult.payload?.edition).toBe('erp')
    expect(verifyResult.payload?.topology).toBe('single')
  })

  it('firma licencias POS Monocaja y Multicaja válidas para el backend', async () => {
    const posSingle = await signLicenseWebCrypto({
      machineId: 'MAVE-1111-2222-3333',
      edition: 'pos',
      topology: 'single',
      issuedAt: '2026-10-21'
    })
    expect(verifyLicenseKey(posSingle, 'MAVE-1111-2222-3333').valid).toBe(true)

    const posMulti = await signLicenseWebCrypto({
      machineId: 'MAVE-1111-2222-3333',
      edition: 'pos',
      topology: 'multi',
      issuedAt: '2026-10-21'
    })
    const resMulti = verifyLicenseKey(posMulti, 'MAVE-1111-2222-3333')
    expect(resMulti.valid).toBe(true)
    expect(resMulti.payload?.topology).toBe('multi')
  })

  it('rechaza generar claves con identificadores de máquina inválidos', async () => {
    await expect(
      signLicenseWebCrypto({
        machineId: 'INVALID_ID',
        edition: 'erp',
        topology: 'single'
      })
    ).rejects.toThrow(/Identificador de máquina inválido/)
  })

  it('formatea la firma hexadecimal en bloques legibles de 4 caracteres', () => {
    const hex = 'E4C1AFD93D26B287DFE4B98C003BEB635446EC2410D7E28BF75A757C834B6903'
    const formatted = formatHexSignatureBlocks(hex)

    expect(formatted).toBe('E4C1-AFD9-3D26-B287-DFE4-B98C-003B-EB63-5446-EC24-10D7-E28B-F75A-757C-834B-6903')
    const chunks = formatted.split('-')
    expect(chunks).toHaveLength(16)
    chunks.forEach((chunk) => expect(chunk).toHaveLength(4))
  })

  it('descompone la clave generada para presentación en bloques y previsualización de datos', async () => {
    const key = await signLicenseWebCrypto({
      machineId: 'MAVE-B8F4-1A92-7E3C',
      edition: 'erp',
      topology: 'multi',
      issuedAt: '2026-10-21'
    })

    const decomposed = decomposeLicenseKey(key)
    expect(decomposed).not.toBeNull()
    expect(decomposed?.raw).toBe(key)
    expect(decomposed?.signatureBlocks).toContain('-')
    expect(decomposed?.decodedPayload?.machineId).toBe('MAVE-B8F4-1A92-7E3C')
    expect(decomposed?.decodedPayload?.edition).toBe('erp')
    expect(decomposed?.decodedPayload?.topology).toBe('multi')
  })
})

describe('Herramienta Visual Standalone (tools/license-generator.html)', () => {
  const htmlPath = path.resolve(__dirname, '../../tools/license-generator.html')

  it('el archivo existe y es un documento HTML offline autónomo', () => {
    expect(fs.existsSync(htmlPath)).toBe(true)
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).toContain('<!DOCTYPE html>')
    expect(content).toContain('<html')
    expect(content).toContain('</html>')
    expect(content).toContain('<style>')
    expect(content).toContain('<script>')
  })

  it('no contiene dependencias externas, librerías remotas ni llamadas HTTP (100% offline)', () => {
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).not.toMatch(/https?:\/\//i)
    expect(content).not.toMatch(/cdn\./i)
    expect(content).not.toMatch(/unpkg\.com/i)
    expect(content).not.toMatch(/cdnjs\./i)
    expect(content).not.toMatch(/googleapis\.com/i)
  })

  it('incluye el secreto maestro exacto y la expresión regular canónica', () => {
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).toContain('MAVE_POS_OFFLINE_LICENSE_MASTER_SECRET_KEY_2026_V1')
    expect(content).toContain('MAVE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}')
  })

  it('utiliza crypto.subtle con HMAC y SHA-256 para firmar en el navegador', () => {
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).toContain('crypto.subtle')
    expect(content).toContain('HMAC')
    expect(content).toContain('SHA-256')
  })

  it('contiene selectores de edición (POS vs ERP) y topología (Monocaja vs Multicaja)', () => {
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).toContain('value="pos"')
    expect(content).toContain('value="erp"')
    expect(content).toContain('value="single"')
    expect(content).toContain('value="multi"')
    expect(content).toMatch(/POS Est[áa]ndar/i)
    expect(content).toMatch(/POS \+ ERP/i)
    expect(content).toMatch(/Monocaja/i)
    expect(content).toMatch(/Multicaja/i)
  })

  it('incluye botón para copiar al portapapeles y visualización de bloques formateados', () => {
    const content = fs.readFileSync(htmlPath, 'utf-8')

    expect(content).toMatch(/copiar/i)
    expect(content).toContain('navigator.clipboard')
    expect(content).toContain('formatHexBlocks')
  })
})
