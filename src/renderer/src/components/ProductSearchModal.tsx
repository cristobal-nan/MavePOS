import React from 'react'
import { X, Search } from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { ProductSearch } from './ProductSearch'

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
  footerText = 'Haz clic en cualquier fila para seleccionar el producto.'
}) => {
  if (!isOpen) return null

  const handleSelect = (product: ProductSearchResult): void => {
    onSelectProduct(product)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-lilac-100 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded ProductSearch */}
        <div className="flex-1 p-4 overflow-hidden">
          <ProductSearch
            onSelectProduct={handleSelect}
            showActions={false}
            autoFocus={true}
            placeholder={placeholder}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{footerText}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl font-medium text-slate-700 transition-colors"
          >
            Cerrar (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
