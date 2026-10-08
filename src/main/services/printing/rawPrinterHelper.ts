import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import net from 'net'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Standard ESC/POS and Star Micronics drawer kick pulse.
 * - ESC p 0 25 250: Pin 2 (50ms ON, 500ms OFF)
 * - ESC p 1 25 250: Pin 5 (50ms ON, 500ms OFF)
 * - 0x07 (BEL): Star Micronics kick
 */
export const CASH_DRAWER_PULSE_BUFFER = Buffer.from([
  0x1b, 0x70, 0x00, 0x19, 0xfa,
  0x1b, 0x70, 0x01, 0x19, 0xfa,
  0x07
])

/**
 * Discovers the path to the winrawprint.exe binary.
 */
export function getRawPrintExePath(): string | null {
  const possiblePaths: (string | null | undefined)[] = [
    // Electron extraResources directory in packaged production app
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'bin', 'winrawprint.exe')
      : null,
    // When Electron app is available
    typeof app !== 'undefined' && app?.getAppPath
      ? path.join(app.getAppPath(), 'resources', 'bin', 'winrawprint.exe')
      : null,
    // Relative to working directory (development or test runner)
    path.join(process.cwd(), 'resources', 'bin', 'winrawprint.exe'),
    // Relative to compiled or source directory
    path.join(__dirname, '..', '..', '..', '..', 'resources', 'bin', 'winrawprint.exe'),
    path.join(__dirname, '..', '..', 'resources', 'bin', 'winrawprint.exe')
  ]

  for (const candidate of possiblePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Discovers the path to the PowerShell fallback script (print_raw.ps1).
 */
export function getRawPrintPs1Path(): string | null {
  const possiblePaths: (string | null | undefined)[] = [
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'bin', 'print_raw.ps1')
      : null,
    typeof app !== 'undefined' && app?.getAppPath
      ? path.join(app.getAppPath(), 'resources', 'bin', 'print_raw.ps1')
      : null,
    path.join(process.cwd(), 'resources', 'bin', 'print_raw.ps1'),
    path.join(__dirname, '..', '..', '..', '..', 'resources', 'bin', 'print_raw.ps1'),
    path.join(__dirname, '..', '..', 'resources', 'bin', 'print_raw.ps1')
  ]

  for (const candidate of possiblePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Sends a raw binary ESC/POS buffer directly to a Windows printer spooler using Win32 winspool.drv RAW.
 */
export async function sendRawBufferToPrinter(
  printerName: string,
  buffer: Buffer,
  docTitle = 'POS Ticket'
): Promise<{ success: boolean; error?: string }> {
  if (!printerName || !printerName.trim()) {
    return {
      success: false,
      error: 'Nombre de impresora térmica no especificado.'
    }
  }

  const cleanPrinterName = printerName.trim()
  const tempFileName = `pos_raw_${Date.now()}_${Math.random().toString(36).substring(2)}.bin`
  const tempFilePath = path.join(os.tmpdir(), tempFileName)

  try {
    await fs.promises.writeFile(tempFilePath, buffer)

    // Strategy 1: Fast native winrawprint.exe (~10ms)
    const exePath = getRawPrintExePath()
    if (exePath) {
      try {
        const { stdout, stderr } = await execFileAsync(
          exePath,
          [cleanPrinterName, tempFilePath, docTitle],
          {
            windowsHide: true,
            timeout: 8000
          }
        )

        if (stderr && stderr.trim().length > 0) {
          console.warn('winrawprint aviso:', stderr.trim())
        }

        if (stdout && stdout.includes('OK')) {
          return { success: true }
        }

        // If it exited 0, treat as success
        return { success: true }
      } catch (exeErr: any) {
        console.warn(
          `winrawprint.exe falló con la impresora '${cleanPrinterName}'. Intentando fallback PowerShell:`,
          exeErr?.message || exeErr
        )
      }
    }

    // Strategy 2: PowerShell P/Invoke script fallback
    const ps1Path = getRawPrintPs1Path()
    if (ps1Path) {
      try {
        const { stdout, stderr } = await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            ps1Path,
            '-PrinterName',
            cleanPrinterName,
            '-FilePath',
            tempFilePath,
            '-DocTitle',
            docTitle
          ],
          {
            windowsHide: true,
            timeout: 15000
          }
        )

        if (stderr && stderr.trim().length > 0) {
          console.warn('print_raw.ps1 aviso:', stderr.trim())
        }

        if (stdout && stdout.includes('OK')) {
          return { success: true }
        }

        return { success: true }
      } catch (psErr: any) {
        console.error('Fallback PowerShell falló:', psErr)
        return {
          success: false,
          error: `No se pudo enviar a la impresora '${cleanPrinterName}': ${
            psErr?.message || 'Error en el spooler de Windows'
          }`
        }
      }
    }

    return {
      success: false,
      error: 'No se encontró el ejecutable ni el script de impresión RAW (winrawprint / print_raw.ps1).'
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error al procesar el archivo temporal de impresión.'
    }
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath)
      }
    } catch {
      // Ignore temporary file cleanup errors
    }
  }
}

/**
 * Sends a raw binary ESC/POS buffer over network TCP socket (e.g. 192.168.1.100:9100).
 */
export async function sendRawBufferToTcp(
  target: string,
  buffer: Buffer,
  timeoutMs = 5000
): Promise<{ success: boolean; error?: string }> {
  let cleanTarget = target.replace(/^tcp:\/\//i, '').trim()
  let host = cleanTarget
  let port = 9100

  if (cleanTarget.includes(':')) {
    const parts = cleanTarget.split(':')
    host = parts[0]
    port = parseInt(parts[1], 10) || 9100
  }

  if (!host) {
    return { success: false, error: 'Dirección IP de impresora de red no válida.' }
  }

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false

    const done = (result: { success: boolean; error?: string }): void => {
      if (resolved) return
      resolved = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeoutMs)

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) {
          done({
            success: false,
            error: `Error al transmitir datos a ${host}:${port}: ${err.message}`
          })
        } else {
          socket.end()
          done({ success: true })
        }
      })
    })

    socket.on('error', (err) => {
      done({
        success: false,
        error: `No se pudo conectar con la impresora en ${host}:${port}: ${err.message}`
      })
    })

    socket.on('timeout', () => {
      done({
        success: false,
        error: `Tiempo de espera agotado al conectar con ${host}:${port}.`
      })
    })
  })
}
