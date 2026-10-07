import React, { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { ProductSearch } from './ProductSearch'
import { useCatalogStore } from '../store/catalogStore'
import { useModalStack } from '../utils/modalStack'

interface ProductSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectProduct: (product: ProductSearchResult) => void
  title?: string
  placeholder?: string
  footerText?: string
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  title = 'Búsqueda de Productos',
  placeholder = 'Escribe el nombre o fragmento con % (ej: algod, %negro) y haz clic para seleccionar...',
  footerText = 'Haz doble clic o presiona Enter para seleccionar el producto resaltado.'
}) => {
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({
    width: Math.min(typeof window !== 'undefined' ? Math.max(960, Math.round(window.innerWidth * 0.82)) : 980, 1150),
    height: Math.min(typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.82) : 680, 780)
  })

  const isResizing = useRef(false)
  const resizeStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })

  const handleClose = (): void => {
    useCatalogStore.getState().setSearchQuery('', 'modal')
    useCatalogStore.setState({ modalProducts: [], modalHasMore: false, modalIsLoading: false })
    onClose()
  }

  useEffect(() => {
    if (isOpen) {
      useCatalogStore.getState().setSelectedProductType('sellable', 'modal')
      useCatalogStore.getState().setSearchQuery('', 'modal')
      const cfg = useCatalogStore.getState().config
      if (cfg.modalAutoLoad) {
        useCatalogStore.getState().fetchProducts('', 'modal')
      } else {
        useCatalogStore.setState({ modalProducts: [], modalHasMore: false, modalIsLoading: false })
      }
      // Actualizar config en segundo plano por si fue modificada en Configuración
      useCatalogStore.getState().loadConfig().then(() => {
        const updatedCfg = useCatalogStore.getState().config
        if (updatedCfg.modalAutoLoad && useCatalogStore.getState().modalProducts.length === 0 && !useCatalogStore.getState().modalSearchQuery) {
          useCatalogStore.getState().fetchProducts('', 'modal')
        }
      })
    }
  }, [isOpen])

  const { handleBackdropClick } = useModalStack({
    id: 'product-search-modal',
    isOpen,
    onClose: handleClose,
    closeOnBackdrop: true
  })

  const handleSelect = (product: ProductSearchResult): void => {
    useCatalogStore.getState().setSearchQuery('', 'modal')
    useCatalogStore.setState({ modalProducts: [], modalHasMore: false, modalIsLoading: false })
    onSelectProduct(product)
    onClose()
  }

  // Manejo de redimensionamiento manual por arrastre
  const handleStartResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    resizeStartPos.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = { width: modalSize.width, height: modalSize.height }

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isResizing.current) return
      const deltaX = moveEvent.clientX - resizeStartPos.current.x
      const deltaY = moveEvent.clientY - resizeStartPos.current.y

      const newWidth = Math.min(
        Math.max(540, resizeStartSize.current.width + deltaX),
        window.innerWidth - 32
      )
      const newHeight = Math.min(
        Math.max(400, resizeStartSize.current.height + deltaY),
        window.innerHeight - 32
      )

      setModalSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = (): void => {
      isResizing.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!isOpen) return null

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          maxWidth: '96vw',
          maxHeight: '95vh',
          minWidth: '540px',
          minHeight: '400px'
        }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-black/60 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative select-none"
      >
        {/* Header Ultra Compacto */}
        <div className="px-4 py-1.5 bg-white dark:bg-slate-850 border-b border-black/60 dark:border-slate-800 flex items-center justify-between shrink-0 h-9">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-bold text-xs">
            <div className="w-5 h-5 rounded-md bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
              <Search className="w-3 h-3" />
            </div>
            <span>{title}</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Embedded ProductSearch */}
        <div className="flex-1 p-2 overflow-hidden flex flex-col">
          <ProductSearch
            onSelectProduct={handleSelect}
            showActions={false}
            autoFocus={true}
            placeholder={placeholder}
            context="modal"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>{footerText}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 transition-colors"
            >
              Cerrar (Esc)
            </button>
          </div>
        </div>

        {/* Bottom-Right Corner Resize Grip Handle */}
        <div
          onMouseDown={handleStartResize}
          className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-1 text-slate-400 hover:text-lilac-600 transition-colors z-20 group"
          title="Arrastra para redimensionar ventana horizontal y verticalmente"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="4.5" r="1.2" />
            <circle cx="4.5" cy="8" r="1.2" />
            <circle cx="8" cy="1" r="1.2" />
            <circle cx="4.5" cy="4.5" r="1.2" />
            <circle cx="1" cy="8" r="1.2" />
          </svg>
        </div>
      </div>
    </div>
  )
}
