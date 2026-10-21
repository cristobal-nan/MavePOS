// Validador y formateador universal para el RUT chileno (Algoritmo Módulo 11)

/**
 * Calcula el dígito verificador (DV) de un cuerpo de RUT utilizando el algoritmo Módulo 11.
 * Retorna '0', '1'...'9' o 'K'.
 */
export function calculateDv(rutBody: string | number): string {
  const bodyStr = String(rutBody).replace(/\D/g, '')
  if (!bodyStr) return ''

  let sum = 0
  let multiplier = 2

  for (let i = bodyStr.length - 1; i >= 0; i--) {
    sum += parseInt(bodyStr[i], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const remainder = sum % 11
  const calculated = 11 - remainder

  if (calculated === 11) return '0'
  if (calculated === 10) return 'K'
  return String(calculated)
}

/**
 * Limpia un RUT eliminando puntos, espacios y caracteres extraños,
 * garantizando formato estándar con guion: XXXXXXXX-X (con DV en mayúsculas).
 */
export function cleanRut(rut: string): string {
  if (!rut || typeof rut !== 'string') return ''
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body}-${dv}`
}

/**
 * Formatea un RUT para presentación.
 * @param rut Cadena con o sin formato previo.
 * @param withDots Si es true, formatea con puntos de miles (ej: 12.345.678-5).
 *                 Si es false, devuelve solo cuerpo con guion (ej: 12345678-5).
 */
export function formatRut(rut: string, withDots = false): string {
  const cleaned = cleanRut(rut)
  if (!cleaned.includes('-')) return cleaned

  const [body, dv] = cleaned.split('-')
  if (!body) return cleaned

  if (!withDots) {
    return `${body}-${dv}`
  }

  // Insertar puntos separadores de miles
  let formattedBody = ''
  let count = 0
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody
    count++
    if (count % 3 === 0 && i > 0) {
      formattedBody = '.' + formattedBody
    }
  }

  return `${formattedBody}-${dv}`
}

/**
 * Valida si un RUT chileno es válido según el algoritmo Módulo 11.
 * Rechaza RUTs vacíos, con longitud inadecuada o con dígito verificador incorrecto.
 */
export function validateRut(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false

  const cleaned = cleanRut(rut)
  if (!cleaned.includes('-')) return false

  const [body, dv] = cleaned.split('-')
  if (!body || !dv) return false

  // El cuerpo del RUT debe ser puramente numérico (1 a 8 dígitos)
  if (!/^\d{1,8}$/.test(body)) return false

  const expectedDv = calculateDv(body)
  return dv.toUpperCase() === expectedDv
}
