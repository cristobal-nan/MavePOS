/**
 * Utilidades para normalizar, capturar y comparar atajos de teclado
 * para motivos de ajuste de inventario y comandos rápidos.
 */

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])

/**
 * Normaliza un evento KeyboardEvent a una cadena estándar legible (ej: "1", "M", "Ctrl+1", "Alt+M").
 * Retorna null si solo se presionó una tecla modificadora (Ctrl, Alt, etc.) o una tecla prohibida (Escape, Tab).
 */
export function eventToShortcut(e: KeyboardEvent | React.KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) {
    return null
  }

  // Teclas no asignables como atajos directos
  if (e.key === 'Escape' || e.key === 'Tab') {
    return null
  }

  // Enter solo está permitido con modificador (Ctrl+Enter, Alt+Enter) para no romper el flujo principal
  if (e.key === 'Enter' && !e.ctrlKey && !e.altKey) {
    return null
  }

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey && e.key.length > 1) parts.push('Shift')

  let keyName = e.key
  if (keyName === ' ') {
    keyName = 'Space'
  } else if (keyName.length === 1) {
    keyName = keyName.toUpperCase()
  }

  parts.push(keyName)
  return parts.join('+')
}

/**
 * Compara un KeyboardEvent con un atajo registrado (ej: "1" o "Ctrl+1").
 */
export function isShortcutMatch(e: KeyboardEvent | React.KeyboardEvent, shortcut: string | undefined): boolean {
  if (!shortcut || !shortcut.trim()) return false

  const target = shortcut.trim().toUpperCase()
  const eventShortcut = eventToShortcut(e)?.toUpperCase()

  return eventShortcut === target
}
