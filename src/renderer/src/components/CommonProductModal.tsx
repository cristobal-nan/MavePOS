import React, { useState, useEffect, useRef } from 'react'
import { X, PackagePlus, ArrowRight, CornerDownLeft } from 'lucide-react'
import { useModalStack } from '../utils/modalStack'
import { formatCLP } from '../utils/formatters'

export interface CommonProductModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (item: { description: string; price: number; quantity: number }) => void
}

export const CommonProductModal: React.FC<CommonProductModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const { handleBackdropClick } = useModalStack({
    id: 'common-product-modal',
    isOpen,
    onClose,
    closeOnBackdrop: true
  })

  const [description, setDescription] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [quantityInput, setQuantityInput] = useState('1')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const descInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)

  // Reset y autofocus al abrir
  useEffect(() => {
    if (isOpen) {
      setDescription('')
      setPriceInput('')
      setQuantityInput('1')
      setErrorMessage(null)

      const timer = setTimeout(() => {
        descInputRef.current?.focus()
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getCleanPrice = (): number => {
    const raw = priceInput.replace(/[^0-9]/g, '')
    return parseInt(raw, 10) || 0
  }

  const getCleanQuantity = (): number => {
    const raw = quantityInput.replace(/[^0-9]/g, '')
    return parseInt(raw, 10) || 0
  }

  const handleSubmit = (e?: React.FormEvent): void => {
    if (e) e.preventDefault()
    setErrorMessage(null)

    const cleanDesc = description.trim()
    if (!cleanDesc) {
      setErrorMessage('Por favor ingresa una descripción para el producto común.')
      descInputRef.current?.focus()
      return
    }

    const price = getCleanPrice()
    if (price <= 0) {
      setErrorMessage('El precio debe ser mayor a $0.')
      priceInputRef.current?.focus()
      return
    }

    const quantity = getCleanQuantity()
    if (quantity <= 0) {
      setErrorMessage('La cantidad debe ser al menos 1 unidad.')
      qtyInputRef.current?.focus()
      return
    }

    onAdd({
      description: cleanDesc,
      price,
      quantity
    })
    onClose()
  }

  // Navegación con tecla Enter
  const handleDescKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!description.trim()) {
        setErrorMessage('Ingresa la descripción del producto o servicio.')
        return
      }
      setErrorMessage(null)
      priceInputRef.current?.focus()
      priceInputRef.current?.select()
    }
  }

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const p = getCleanPrice()
      if (p <= 0) {
        setErrorMessage('Ingresa un precio válido mayor a $0.')
        return
      }
      setErrorMessage(null)
      qtyInputRef.current?.focus()
      qtyInputRef.current?.select()
    }
  }

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const currentPriceNum = getCleanPrice()
  const currentQtyNum = getCleanQuantity()
  const totalEstimado = currentPriceNum * currentQtyNum

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-lilac-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center font-bold shadow-xs">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                Vender Producto Común
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Artículo o servicio fuera de catálogo (código <span className="font-mono font-bold text-slate-700 dark:text-slate-300">COMÚN</span>)
              </p>
            </div>
          </div>

          <button
            type="button"
            tabIndex={6}
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mensaje de Error (Cero Layout Shift: altura fija o flotante reservada) */}
          <div className="min-h-[22px]">
            {errorMessage ? (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in duration-100">
                {errorMessage}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <CornerDownLeft className="w-3 h-3 inline text-lilac-500" />
                <span>Navega entre campos con <strong className="font-semibold text-slate-600 dark:text-slate-400">Enter</strong> o <strong className="font-semibold text-slate-600 dark:text-slate-400">Tab</strong></span>
              </p>
            )}
          </div>

          {/* Fila 1: Descripción (Ancho Completo, tamaño 1) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Descripción del Producto o Servicio *
            </label>
            <input
              ref={descInputRef}
              type="text"
              tabIndex={1}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleDescKeyDown}
              placeholder="Ej: Arreglo de bastilla, Botón fantasía, Costura especial..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 dark:focus:ring-lilac-950/40 transition-all shadow-inner"
            />
          </div>

          {/* Fila 2: Dos Columnas (1/2 Precio y 1/2 Cantidad) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Columna 1: Precio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Precio Unitario (CLP) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                  $
                </span>
                <input
                  ref={priceInputRef}
                  type="text"
                  tabIndex={2}
                  inputMode="numeric"
                  value={priceInput}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                    setPriceInput(onlyNums ? parseInt(onlyNums, 10).toLocaleString('es-CL') : '')
                  }}
                  onKeyDown={handlePriceKeyDown}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 dark:focus:ring-lilac-950/40 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Columna 2: Cantidad */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cantidad *
              </label>
              <input
                ref={qtyInputRef}
                type="text"
                tabIndex={3}
                inputMode="numeric"
                value={quantityInput}
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                  setQuantityInput(onlyNums)
                }}
                onKeyDown={handleQtyKeyDown}
                placeholder="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-center text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 dark:focus:ring-lilac-950/40 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Subtotal Informativo (siempre visible para mantener altura fija y cero layout shift) */}
          <div className="pt-2 px-1 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Total a sumar en carrito:</span>
            <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
              {formatCLP(totalEstimado)}
            </span>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              tabIndex={5}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar (Esc)
            </button>

            <button
              type="submit"
              tabIndex={4}
              className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-lilac-600/20 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>Agregar al Carrito</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
