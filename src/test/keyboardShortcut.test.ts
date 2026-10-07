import { describe, it, expect } from 'vitest'
import { eventToShortcut, isShortcutMatch } from '../renderer/src/utils/keyboardShortcut'

describe('keyboardShortcut utils', () => {
  it('normaliza teclas individuales simples', () => {
    const event1 = { key: '1', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    expect(eventToShortcut(event1)).toBe('1')

    const eventM = { key: 'm', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    expect(eventToShortcut(eventM)).toBe('M')
  })

  it('normaliza combinaciones con modificadores', () => {
    const eventCtrl1 = { key: '1', ctrlKey: true, altKey: false, shiftKey: false } as KeyboardEvent
    expect(eventToShortcut(eventCtrl1)).toBe('Ctrl+1')

    const eventAltM = { key: 'm', ctrlKey: false, altKey: true, shiftKey: false } as KeyboardEvent
    expect(eventToShortcut(eventAltM)).toBe('Alt+M')

    const eventCtrlAltA = { key: 'a', ctrlKey: true, altKey: true, shiftKey: false } as KeyboardEvent
    expect(eventToShortcut(eventCtrlAltA)).toBe('Ctrl+Alt+A')
  })

  it('retorna null para modificadores puros o teclas reservadas', () => {
    expect(eventToShortcut({ key: 'Control', ctrlKey: true, altKey: false, shiftKey: false } as KeyboardEvent)).toBeNull()
    expect(eventToShortcut({ key: 'Alt', ctrlKey: false, altKey: true, shiftKey: false } as KeyboardEvent)).toBeNull()
    expect(eventToShortcut({ key: 'Shift', ctrlKey: false, altKey: false, shiftKey: true } as KeyboardEvent)).toBeNull()
    expect(eventToShortcut({ key: 'Escape', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent)).toBeNull()
    expect(eventToShortcut({ key: 'Tab', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent)).toBeNull()
    expect(eventToShortcut({ key: 'Enter', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent)).toBeNull()
  })

  it('compara atajos correctamente con isShortcutMatch', () => {
    const event1 = { key: '1', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    expect(isShortcutMatch(event1, '1')).toBe(true)
    expect(isShortcutMatch(event1, '2')).toBe(false)
    expect(isShortcutMatch(event1, undefined)).toBe(false)
    expect(isShortcutMatch(event1, '')).toBe(false)

    const eventCtrl1 = { key: '1', ctrlKey: true, altKey: false, shiftKey: false } as KeyboardEvent
    expect(isShortcutMatch(eventCtrl1, 'Ctrl+1')).toBe(true)
    expect(isShortcutMatch(eventCtrl1, 'ctrl+1')).toBe(true)
    expect(isShortcutMatch(eventCtrl1, '1')).toBe(false)
  })

  it('encuentra el motivo correspondiente a partir de un evento de teclado', () => {
    const reasons = [
      { id: '1', text: 'Conteo físico', type: 'replace' as const, shortcut: '1' },
      { id: '2', text: 'Merma por rotura', type: 'replace' as const, shortcut: 'M' },
      { id: '3', text: 'en bodega', type: 'append' as const, shortcut: 'B' },
      { id: '4', text: 'Sin atajo', type: 'replace' as const }
    ]

    const event1 = { key: '1', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    const matched1 = reasons.find((r) => isShortcutMatch(event1, r.shortcut))
    expect(matched1).toBeDefined()
    expect(matched1?.text).toBe('Conteo físico')

    const eventM = { key: 'm', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    const matchedM = reasons.find((r) => isShortcutMatch(eventM, r.shortcut))
    expect(matchedM).toBeDefined()
    expect(matchedM?.text).toBe('Merma por rotura')

    const eventX = { key: 'x', ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent
    const matchedX = reasons.find((r) => isShortcutMatch(eventX, r.shortcut))
    expect(matchedX).toBeUndefined()
  })

  it('aplica motivos correctamente según tipo replace y append', () => {
    let currentReason = ''

    const applyReason = (item: { text: string; type: 'replace' | 'append' }): void => {
      if (item.type === 'replace') {
        currentReason = item.text
      } else {
        currentReason = currentReason.trim() ? `${currentReason.trim()} ${item.text}` : item.text
      }
    }

    // 1. Reemplazo inicial
    applyReason({ text: 'Merma por daño', type: 'replace' })
    expect(currentReason).toBe('Merma por daño')

    // 2. Encadenamiento de complementos
    applyReason({ text: 'en bodega central', type: 'append' })
    expect(currentReason).toBe('Merma por daño en bodega central')

    applyReason({ text: 'sector B', type: 'append' })
    expect(currentReason).toBe('Merma por daño en bodega central sector B')

    // 3. Reemplazo posterior
    applyReason({ text: 'Conteo físico', type: 'replace' })
    expect(currentReason).toBe('Conteo físico')
  })
})
