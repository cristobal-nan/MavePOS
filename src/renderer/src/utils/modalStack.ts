import { useEffect } from 'react'

export interface ModalRegistration {
  id: string
  onClose: () => void
  closeOnBackdrop?: boolean
}

// Global modal stack (LIFO)
const modalStack: ModalRegistration[] = []

export const registerModal = (item: ModalRegistration): void => {
  // Remove if already exists to move to top of stack
  const index = modalStack.findIndex((m) => m.id === item.id)
  if (index >= 0) {
    modalStack.splice(index, 1)
  }
  modalStack.push(item)
}

export const unregisterModal = (id: string): void => {
  const index = modalStack.findIndex((m) => m.id === id)
  if (index >= 0) {
    modalStack.splice(index, 1)
  }
}

export const getTopModal = (): ModalRegistration | undefined => {
  return modalStack[modalStack.length - 1]
}

export const isTopModal = (id: string): boolean => {
  const top = getTopModal()
  return top ? top.id === id : false
}

// Global Escape listener (registered once)
let isListenerAttached = false

const handleGlobalKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' && modalStack.length > 0) {
    const top = modalStack[modalStack.length - 1]
    if (top) {
      e.preventDefault()
      e.stopPropagation()
      top.onClose()
    }
  }
}

const ensureListener = (): void => {
  if (!isListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeyDown, true) // capture phase
    isListenerAttached = true
  }
}

/**
 * Hook to register a modal into the global LIFO stack.
 * Closes only the topmost modal when ESC is pressed.
 * Handles backdrop clicks if closeOnBackdrop is true.
 */
export function useModalStack(options: {
  id: string
  isOpen: boolean
  onClose: () => void
  closeOnBackdrop?: boolean
}): {
  handleBackdropClick: (e: React.MouseEvent) => void
  isTop: boolean
} {
  const { id, isOpen, onClose, closeOnBackdrop = true } = options

  useEffect(() => {
    ensureListener()
    if (isOpen) {
      registerModal({ id, onClose, closeOnBackdrop })
    } else {
      unregisterModal(id)
    }

    return () => {
      unregisterModal(id)
    }
  }, [id, isOpen, onClose, closeOnBackdrop])

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      if (closeOnBackdrop && isTopModal(id)) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
  }

  return {
    handleBackdropClick,
    isTop: isTopModal(id)
  }
}
