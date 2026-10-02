import { describe, it, expect, beforeEach } from 'vitest'
import { registerModal, unregisterModal, getTopModal, isTopModal } from '../renderer/src/utils/modalStack'

describe('Modal Stack Manager (LIFO)', () => {
  beforeEach(() => {
    // Clean stack before each test
    while (getTopModal()) {
      const top = getTopModal()
      if (top) unregisterModal(top.id)
    }
  })

  it('registra modales y mantiene el orden LIFO (último en entrar es el tope)', () => {
    let closedId: string | null = null

    registerModal({
      id: 'modal-1',
      onClose: () => {
        closedId = 'modal-1'
      },
      closeOnBackdrop: true
    })

    expect(isTopModal('modal-1')).toBe(true)
    expect(getTopModal()?.id).toBe('modal-1')

    registerModal({
      id: 'modal-2',
      onClose: () => {
        closedId = 'modal-2'
      },
      closeOnBackdrop: false
    })

    expect(isTopModal('modal-2')).toBe(true)
    expect(isTopModal('modal-1')).toBe(false)
    expect(getTopModal()?.id).toBe('modal-2')

    // Desregistrar modal-2 devuelve modal-1 al tope
    unregisterModal('modal-2')
    expect(isTopModal('modal-1')).toBe(true)
    expect(getTopModal()?.id).toBe('modal-1')
  })

  it('mover un modal existente al tope si se vuelve a registrar', () => {
    registerModal({ id: 'modal-a', onClose: () => {}, closeOnBackdrop: true })
    registerModal({ id: 'modal-b', onClose: () => {}, closeOnBackdrop: true })
    registerModal({ id: 'modal-c', onClose: () => {}, closeOnBackdrop: true })

    expect(getTopModal()?.id).toBe('modal-c')

    // Si modal-a se vuelve a registrar (ej: foco o actualización) pasa al tope
    registerModal({ id: 'modal-a', onClose: () => {}, closeOnBackdrop: true })
    expect(getTopModal()?.id).toBe('modal-a')
  })

  it('respeta la bandera closeOnBackdrop por modal', () => {
    registerModal({ id: 'form-modal', onClose: () => {}, closeOnBackdrop: false })
    expect(getTopModal()?.closeOnBackdrop).toBe(false)

    registerModal({ id: 'confirm-modal', onClose: () => {}, closeOnBackdrop: true })
    expect(getTopModal()?.closeOnBackdrop).toBe(true)
  })
})
