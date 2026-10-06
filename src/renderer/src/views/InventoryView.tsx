import React, { useState, useEffect, useRef } from 'react'
import {
  SlidersHorizontal,
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Search,
  RefreshCw,
  CheckCircle2,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  X,
  AlertCircle,
  Barcode,
  Package,
  Tag,
  Boxes,
  ArrowUpDown,
  Hash,
  FileText
} from 'lucide-react'
import { useInventoryStore } from '../store/inventoryStore'
import { ProductSearchResult, MovementType, QuickAdjustmentReason, DEFAULT_QUICK_REASONS } from '@shared/types'
import { ProductSearchModal } from '../components/ProductSearchModal'
import { formatCLP } from '../utils/formatters'

export const InventoryView: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedProduct,
    setSelectedProduct,
    lowStockProducts,
    fetchLowStock,
    movements,
    fetchMovements,
    selectedDate,
    setSelectedDate,
    selectedMovementType,
    setSelectedMovementType,
    kardexProduct,
    setKardexProduct,
    kardexMovements,
    adjustStock,
    isLoading
  } = useInventoryStore()

  // Modales y filtros locales
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [modalTarget, setModalTarget] = useState<'adjust' | 'kardex'>('adjust')
  const [codeInput, setCodeInput] = useState('')
  const [kardexCodeInput, setKardexCodeInput] = useState('')
  const [movementSearchQuery, setMovementSearchQuery] = useState('')

  // Estado del formulario de ajuste
  const [deltaInput, setDeltaInput] = useState('')
  const [newStockInput, setNewStockInput] = useState('')
  const [reason, setReason] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error'
    text: string
    subtext?: string
    sign?: '+' | '-'
  } | null>(null)
  const [quickReasons, setQuickReasons] = useState<QuickAdjustmentReason[]>([...DEFAULT_QUICK_REASONS])

  const [windowHeight, setWindowHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900
  )

  useEffect(() => {
    const handleResize = (): void => {
      setWindowHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isCompactHeight = windowHeight <= 820
  const isMediumHeight = windowHeight > 820 && windowHeight <= 950

  const codeInputRef = useRef<HTMLInputElement>(null)
  const kardexCodeInputRef = useRef<HTMLInputElement>(null)
  const deltaInputRef = useRef<HTMLInputElement>(null)
  const newStockInputRef = useRef<HTMLInputElement>(null)
  const reasonInputRef = useRef<HTMLInputElement>(null)
  const handleConfirmAdjustRef = useRef<((e?: React.MouseEvent | React.KeyboardEvent) => Promise<void>) | null>(null)

  // Atajo F10 para abrir catálogo en inventario y Enter para confirmar ajuste cuando no hay input enfocado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F10') {
        e.preventDefault()
        if (activeTab === 'adjust') {
          setModalTarget('adjust')
          setIsSearchModalOpen(true)
        } else if (activeTab === 'kardex') {
          setModalTarget('kardex')
          setIsSearchModalOpen(true)
        }
        return
      }

      if (e.key === 'Enter' && activeTab === 'adjust' && !isSearchModalOpen) {
        const activeEl = document.activeElement
        const isInputOrTextarea =
          activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement

        if (!isInputOrTextarea) {
          e.preventDefault()
          handleConfirmAdjustRef.current?.(e as unknown as React.KeyboardEvent)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, isSearchModalOpen])

  // Helper para formatear nombre de producto evitando duplicar nombre del padre
  const getProductDisplayName = (name: string, parentName?: string | null): string => {
    if (!parentName) return name
    if (name.toLowerCase().startsWith(parentName.toLowerCase())) return name
    return `${parentName} ${name}`
  }

  // Cargar motivos configurados desde settings al cambiar de tab o montar
  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((settings) => {
        if (!isMounted) return
        if (settings?.inventory_quick_reasons) {
          try {
            const parsed = JSON.parse(settings.inventory_quick_reasons)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setQuickReasons(parsed)
            }
          } catch (e) {
            console.error('Error parseando inventory_quick_reasons:', e)
          }
        }
      })
      .catch((err) => {
        console.error('Error al cargar configuración de motivos:', err)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab])

  // Cargar datos al montar y al cambiar de tab
  useEffect(() => {
    fetchLowStock()
  }, [fetchLowStock])

  // Foco automático en el cuadro de código al entrar a ajustar existencia o a kardex
  useEffect(() => {
    if (activeTab === 'adjust') {
      if (!selectedProduct) {
        codeInputRef.current?.focus()
      } else {
        setTimeout(() => {
          deltaInputRef.current?.focus()
          deltaInputRef.current?.select()
        }, 50)
      }
    } else if (activeTab === 'kardex') {
      kardexCodeInputRef.current?.focus()
    }
  }, [activeTab])

  // Al seleccionar un producto en 'adjust', inicializar inputs con su stock actual y enfocar el input de +/-
  useEffect(() => {
    if (selectedProduct) {
      setCodeInput(selectedProduct.code || '')
      setNewStockInput(String(selectedProduct.stock))
      setDeltaInput('')
      setReason('')
      setFeedbackMessage(null)

      if (activeTab === 'adjust') {
        setTimeout(() => {
          deltaInputRef.current?.focus()
          deltaInputRef.current?.select()
        }, 50)
      }
    } else {
      setCodeInput('')
      setNewStockInput('')
      setDeltaInput('')
      setReason('')
    }
  }, [selectedProduct, activeTab])

  // Calcular nuevo stock según inputs
  const calculateNewStock = (): number => {
    if (!selectedProduct) return 0
    const n = parseInt(newStockInput, 10)
    return isNaN(n) ? selectedProduct.stock : n
  }

  // Calcular delta real
  const calculateEffectiveDelta = (): number => {
    if (!selectedProduct) return 0
    const n = parseInt(newStockInput, 10)
    if (isNaN(n)) return 0
    return n - selectedProduct.stock
  }

  // Manejador del input de delta (+ / -) con sincronización bidireccional
  const handleDeltaChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!selectedProduct) return
    const val = e.target.value.replace(/[^0-9+-]/g, '')
    // Evitar múltiples signos
    if ((val.match(/\+/g) || []).length > 1 || (val.match(/-/g) || []).length > 1) {
      return
    }
    setDeltaInput(val)
    if (val === '' || val === '+' || val === '-') {
      setNewStockInput(String(selectedProduct.stock))
      return
    }
    const d = parseInt(val, 10)
    if (!isNaN(d)) {
      setNewStockInput(String(selectedProduct.stock + d))
    }
  }

  // Manejador del input de nueva cantidad con sincronización bidireccional
  const handleNewStockChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!selectedProduct) return
    const val = e.target.value.replace(/[^0-9]/g, '')
    setNewStockInput(val)
    if (val === '') {
      const d = 0 - selectedProduct.stock
      setDeltaInput(d > 0 ? `+${d}` : String(d))
      return
    }
    const n = parseInt(val, 10)
    if (!isNaN(n)) {
      const d = n - selectedProduct.stock
      setDeltaInput(d > 0 ? `+${d}` : String(d))
    }
  }

  // Buscar producto por código digitado / escaneado
  const handleCodeSearch = async (target: 'adjust' | 'kardex'): Promise<void> => {
    const raw = target === 'adjust' ? codeInput.trim() : kardexCodeInput.trim()
    if (!raw) return

    try {
      // 1. Probar primero búsqueda directa de código con tolerancia a ceros a la izquierda
      const directMatch = await window.api.getProductByCode(raw)
      if (directMatch && directMatch.code) {
        if (target === 'adjust') {
          setSelectedProduct(directMatch)
          setTimeout(() => {
            deltaInputRef.current?.focus()
            deltaInputRef.current?.select()
          }, 60)
        } else {
          setKardexProduct(directMatch)
          setKardexCodeInput('')
        }
        return
      }

      // 2. Probar si coincide con mayúsculas exactas
      const upperMatch = await window.api.getProductByCode(raw.toUpperCase())
      if (upperMatch && upperMatch.code) {
        if (target === 'adjust') {
          setSelectedProduct(upperMatch)
          setTimeout(() => {
            deltaInputRef.current?.focus()
            deltaInputRef.current?.select()
          }, 60)
        } else {
          setKardexProduct(upperMatch)
          setKardexCodeInput('')
        }
        return
      }

      // 3. Si no existe el código, limpiar el cuadrado y mostrar mensaje de error (sin abrir modal)
      if (target === 'adjust') {
        setCodeInput('')
        setSelectedProduct(null)
        codeInputRef.current?.focus()
        setFeedbackMessage({
          type: 'error',
          text: `Código ${raw}`,
          subtext: 'No encontrado'
        })
      } else {
        setKardexCodeInput('')
        kardexCodeInputRef.current?.focus()
        setFeedbackMessage({
          type: 'error',
          text: `Código ${raw}`,
          subtext: 'No encontrado'
        })
      }
    } catch (err: any) {
      console.error('Error buscando producto:', err)
      if (target === 'adjust') {
        setCodeInput('')
        codeInputRef.current?.focus()
      } else {
        setKardexCodeInput('')
        kardexCodeInputRef.current?.focus()
      }
      setFeedbackMessage({
        type: 'error',
        text: 'Error de búsqueda',
        subtext: err.message || 'Producto no encontrado'
      })
    }
  }

  // Enviar formulario de ajuste
  const handleConfirmAdjust = async (e?: React.MouseEvent | React.KeyboardEvent): Promise<void> => {
    if (!selectedProduct || !selectedProduct.code) {
      setFeedbackMessage({
        type: 'error',
        text: 'Sin producto seleccionado',
        subtext: 'Escanee o busque un producto'
      })
      return
    }

    const effDelta = calculateEffectiveDelta()
    const newStock = calculateNewStock()

    if (effDelta === 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Diferencia en cero',
        subtext: 'El ajuste no modifica el stock'
      })
      return
    }

    if (newStock < 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Stock inválido',
        subtext: 'El resultado no puede ser negativo'
      })
      return
    }

    if (!reason.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Motivo requerido',
        subtext: 'Seleccione o escriba un motivo'
      })
      return
    }

    const keepProduct = Boolean(e?.shiftKey)

    try {
      await adjustStock({
        product_code: selectedProduct.code,
        new_stock: newStock,
        reason: reason.trim()
      })

      const productName = getProductDisplayName(selectedProduct.name, selectedProduct.parent_name)
      const absDelta = Math.abs(effDelta)
      const sign = effDelta > 0 ? '+' : '-'
      const unitsLabel = absDelta === 1 ? 'unidad' : 'unidades'

      setFeedbackMessage({
        type: 'success',
        text: productName,
        subtext: `${absDelta} ${unitsLabel}`,
        sign
      })

      if (keepProduct) {
        // Mantener el producto seleccionado con su nuevo stock
        setSelectedProduct({
          ...selectedProduct,
          stock: newStock
        })
        setDeltaInput('')
        setNewStockInput(String(newStock))
        setReason('')
        setTimeout(() => {
          deltaInputRef.current?.focus()
          deltaInputRef.current?.select()
        }, 60)
      } else {
        // Quitar el producto, limpiar código y enfocar para volver a escribir
        setSelectedProduct(null)
        setCodeInput('')
        setDeltaInput('')
        setNewStockInput('')
        setReason('')
        codeInputRef.current?.focus()
      }

      // Actualizar conteo de stock bajo en segundo plano
      fetchLowStock()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: 'Error al ajustar',
        subtext: err.message || 'No se pudo guardar el ajuste'
      })
    }
  }
  handleConfirmAdjustRef.current = handleConfirmAdjust

  // Aplicar motivo rápido (reemplazar o añadir a la frase)
  const handleApplyReason = (item: QuickAdjustmentReason): void => {
    if (item.type === 'replace') {
      setReason(item.text)
    } else {
      setReason((prev) => (prev.trim() ? `${prev.trim()} ${item.text}` : item.text))
    }
    setTimeout(() => {
      reasonInputRef.current?.focus()
    }, 40)
  }

  // Abrir modal de búsqueda
  const handleOpenSearchModal = (target: 'adjust' | 'kardex'): void => {
    setModalTarget(target)
    setIsSearchModalOpen(true)
  }

  // Manejar selección desde el modal
  const handleModalSelect = (product: ProductSearchResult): void => {
    if (modalTarget === 'adjust') {
      setSelectedProduct(product)
      setCodeInput('')
      setTimeout(() => {
        deltaInputRef.current?.focus()
        deltaInputRef.current?.select()
      }, 60)
    } else {
      setKardexProduct(product)
      setKardexCodeInput('')
    }
  }

  // Acceso directo desde Stock Bajo para ajustar
  const handleDirectAdjust = (product: ProductSearchResult): void => {
    setSelectedProduct(product)
    setActiveTab('adjust')
    setTimeout(() => {
      deltaInputRef.current?.focus()
      deltaInputRef.current?.select()
    }, 60)
  }

  // Helpers para badges de movimientos
  const getMovementBadge = (type: MovementType): { label: string; bg: string; text: string } => {
    switch (type) {
      case 'venta':
        return { label: 'Venta', bg: 'bg-rose-100', text: 'text-rose-700' }
      case 'devolucion':
        return { label: 'Devolución', bg: 'bg-amber-100', text: 'text-amber-700' }
      case 'ajuste':
        return { label: 'Ajuste', bg: 'bg-lilac-100', text: 'text-lilac-700' }
      case 'importacion':
        return { label: 'Importación', bg: 'bg-blue-100', text: 'text-blue-700' }
      case 'inicial':
        return { label: 'Inicial', bg: 'bg-emerald-100', text: 'text-emerald-700' }
      default:
        return { label: type, bg: 'bg-slate-100', text: 'text-slate-700' }
    }
  }

  // Formato de hora amigable
  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return isoString
    }
  }

  const formatDateTime = (isoString: string): string => {
    try {
      const d = new Date(isoString)
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      return isoString
    }
  }

  // Fecha local de hoy
  const getTodayLocalDate = (): string => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="bg-white border-b border-lilac-100 px-4 sm:px-6 pt-3 gap-2 pb-0 flex flex-col shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg sm:w-10 sm:h-10 sm:rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shadow-inner shrink-0">
              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                Control de Inventario
              </h1>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-transparent -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'adjust'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Ajustar Existencia</span>
          </button>

          <button
            onClick={() => setActiveTab('lowStock')}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'lowStock'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Stock Bajo</span>
            {lowStockProducts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'movements'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Movimientos por Día</span>
          </button>

          <button
            onClick={() => setActiveTab('kardex')}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'kardex'
                ? 'border-lilac-600 text-lilac-700 bg-lilac-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Kardex de Producto</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div
        className={`flex-1 ${
          isCompactHeight ? 'p-2 sm:p-2.5' : isMediumHeight ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6'
        } ${activeTab === 'adjust' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
      >
        {/* ========================================================= */}
        {/* SUBTAB 1: AJUSTAR EXISTENCIA                             */}
        {/* ========================================================= */}
        {activeTab === 'adjust' && (
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0">
            <div
              className={`bg-white rounded-2xl border border-lilac-100 ${
                isCompactHeight ? 'p-2.5 sm:p-3 gap-1.5' : isMediumHeight ? 'p-4 gap-2.5' : 'p-5 sm:p-6 gap-3.5'
              } shadow-sm flex flex-col flex-1 justify-between min-h-0`}
            >
              {/* Encabezado moderno con altura fija */}
              <div
                className={`flex items-center justify-between border-b border-lilac-100/80 ${
                  isCompactHeight ? 'pb-1.5 min-h-[32px]' : isMediumHeight ? 'pb-2 min-h-[38px]' : 'pb-3 min-h-[44px]'
                } shrink-0`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`${
                      isCompactHeight ? 'w-7 h-7 rounded-lg' : isMediumHeight ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl'
                    } bg-lilac-50 text-lilac-600 flex items-center justify-center shrink-0`}
                  >
                    <SlidersHorizontal className={isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} />
                  </div>
                  <div>
                    <h2 className={`${isCompactHeight ? 'text-sm' : 'text-base'} font-bold text-slate-800 leading-tight`}>
                      Ajustar Existencia
                    </h2>
                    {!isCompactHeight && (
                      <p className="text-xs text-slate-500">
                        Ajuste físico de stock, mermas y auditoría de existencias
                      </p>
                    )}
                  </div>
                </div>

                <div className={`${isCompactHeight ? 'h-7' : 'h-9'} flex items-center justify-end shrink-0`}>
                  {feedbackMessage && (
                    <div
                      className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border flex items-center gap-1.5 sm:gap-2 animate-in fade-in duration-200 shadow-2xs ${
                        feedbackMessage.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {feedbackMessage.type === 'success' ? (
                        <CheckCircle2 className={`${isCompactHeight ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-600 shrink-0`} />
                      ) : (
                        <AlertCircle className={`${isCompactHeight ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-rose-600 shrink-0`} />
                      )}
                      <div className="flex flex-col text-left leading-none max-w-[280px] sm:max-w-[320px]">
                        <span className={`${isCompactHeight ? 'text-[11px]' : 'text-xs'} font-bold leading-tight truncate`} title={feedbackMessage.text}>
                          {feedbackMessage.text}
                        </span>
                        {feedbackMessage.subtext && (
                          <span className={`${isCompactHeight ? 'text-[10px]' : 'text-[11px]'} opacity-90 leading-tight mt-0.5 font-medium`}>
                            {feedbackMessage.sign && (
                              <span className="font-black text-xs mr-0.5">{feedbackMessage.sign}</span>
                            )}
                            {feedbackMessage.subtext}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFeedbackMessage(null)}
                        className="p-0.5 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer ml-0.5 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario en orden exacto y estructurado con el estilo del sistema */}
              <div className="divide-y divide-slate-100 border-y border-slate-100 flex-1 flex flex-col justify-evenly py-0.5 min-h-0">
                {/* 1. Código del Producto */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <label className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <Barcode className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Código del Producto</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative flex-1">
                      <Barcode className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (selectedProduct && (codeInput.trim() === '' || codeInput.trim() === selectedProduct.code)) {
                              e.preventDefault()
                              deltaInputRef.current?.focus()
                              deltaInputRef.current?.select()
                            } else {
                              handleCodeSearch('adjust')
                            }
                          }
                        }}
                        placeholder="Escanear o ingresar código y presionar Enter..."
                        className={`w-full pl-8 pr-8 ${isCompactHeight ? 'py-1 text-xs' : 'py-1.5 text-sm'} bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl font-mono outline-none transition-all uppercase shadow-2xs`}
                      />
                      {codeInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setCodeInput('')
                            setSelectedProduct(null)
                            codeInputRef.current?.focus()
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          title="Limpiar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenSearchModal('adjust')}
                      className={`${isCompactHeight ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs`}
                      title="Buscar en el catálogo de productos (F10)"
                    >
                      <Search className={isCompactHeight ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      <span>Buscar (F10)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Nombre */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <span className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <Package className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Nombre</span>
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-2 overflow-hidden min-w-0">
                    {selectedProduct ? (
                      <>
                        <span
                          className={`${isCompactHeight ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} font-bold text-slate-900 truncate`}
                          title={getProductDisplayName(selectedProduct.name, selectedProduct.parent_name)}
                        >
                          {getProductDisplayName(selectedProduct.name, selectedProduct.parent_name)}
                        </span>
                        {(selectedProduct.parent_category_name || selectedProduct.category_name) && (
                          <span className={`px-2 py-0.5 rounded-lg ${isCompactHeight ? 'text-[10px]' : 'text-xs'} font-semibold bg-lilac-50 text-lilac-700 border border-lilac-100 shrink-0`}>
                            {selectedProduct.parent_category_name
                              ? `${selectedProduct.parent_category_name}${selectedProduct.category_name ? ' > ' + selectedProduct.category_name : ''}`
                              : selectedProduct.category_name}
                          </span>
                        )}
                        {selectedProduct.product_type === 'variation' && (
                          <span className={`px-2 py-0.5 rounded-lg ${isCompactHeight ? 'text-[10px]' : 'text-xs'} font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0`}>
                            Variación
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 font-normal italic text-xs">
                        Ningún producto seleccionado
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Precio Venta */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <span className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <Tag className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Precio Venta</span>
                    </span>
                  </div>
                  <div className={`flex-1 ${isCompactHeight ? 'text-sm' : 'text-base'} font-bold text-slate-800`}>
                    {selectedProduct ? (
                      <span>{formatCLP(selectedProduct.sale_price)}</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic text-xs">—</span>
                    )}
                  </div>
                </div>

                {/* 4. Cantidad Actual */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <span className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <Boxes className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Cantidad Actual</span>
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    {selectedProduct ? (
                      <>
                        <span className={`${isCompactHeight ? 'text-base sm:text-lg' : 'text-xl'} font-bold text-slate-800 leading-none`}>
                          {selectedProduct.stock}
                        </span>
                        <span className={`${isCompactHeight ? 'text-xs' : 'text-sm'} text-slate-500 font-medium`}>unidades</span>
                      </>
                    ) : (
                      <span className="text-slate-400 font-normal italic text-xs">—</span>
                    )}
                  </div>
                </div>

                {/* 5. + / - */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <label className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <ArrowUpDown className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>+ / -</span>
                    </label>
                  </div>
                  <div className="flex-1 flex items-center">
                    <input
                      ref={deltaInputRef}
                      type="text"
                      disabled={!selectedProduct}
                      value={deltaInput}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={handleDeltaChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          newStockInputRef.current?.focus()
                          newStockInputRef.current?.select()
                        }
                      }}
                      placeholder="0"
                      className={`w-32 sm:w-36 ${isCompactHeight ? 'py-1 text-sm' : 'py-1.5 text-base'} px-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-lilac-500 rounded-xl font-bold text-slate-800 text-center outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs`}
                    />
                  </div>
                </div>

                {/* 6. Nueva Cantidad */}
                <div className={`${isCompactHeight ? 'py-1 min-h-[32px]' : isMediumHeight ? 'py-1.5 min-h-[38px]' : 'py-2.5 min-h-[46px]'} px-1 flex items-center justify-between gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0">
                    <label className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <Hash className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Nueva Cantidad</span>
                    </label>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      ref={newStockInputRef}
                      type="text"
                      disabled={!selectedProduct}
                      value={newStockInput}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={handleNewStockChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          reasonInputRef.current?.focus()
                          reasonInputRef.current?.select()
                        }
                      }}
                      placeholder="0"
                      className={`w-32 sm:w-36 ${isCompactHeight ? 'py-1 text-sm' : 'py-1.5 text-base'} px-3 bg-slate-50 focus:bg-white border rounded-xl font-bold text-center outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs ${
                        calculateNewStock() < 0
                          ? 'border-rose-400 text-rose-600 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 text-slate-800 focus:border-lilac-500'
                      }`}
                    />
                    {calculateNewStock() < 0 && (
                      <span className="px-2 py-0.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 flex items-center gap-1 shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>No puede ser negativo</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 7. Motivo del ajuste */}
                <div className={`${isCompactHeight ? 'py-1.5' : isMediumHeight ? 'py-2' : 'py-3'} px-1 flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3`}>
                  <div className="w-36 sm:w-48 shrink-0 pt-1">
                    <label className={`${isCompactHeight ? 'text-xs' : 'text-sm sm:text-base'} font-normal text-slate-700 flex items-center gap-2`}>
                      <FileText className={`${isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} text-lilac-600 shrink-0`} />
                      <span>Motivo del ajuste</span>
                    </label>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <input
                      ref={reasonInputRef}
                      type="text"
                      disabled={!selectedProduct}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleConfirmAdjust(e)
                        }
                      }}
                      placeholder="Escribe el motivo del ajuste (ej: Conteo físico, rotura, merma...)"
                      className={`w-full ${isCompactHeight ? 'py-1 px-2.5 text-xs' : 'py-1.5 px-3.5 text-xs sm:text-sm'} bg-slate-50 focus:bg-white border border-slate-200 focus:border-lilac-500 rounded-xl outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs`}
                    />

                    {/* Chips de motivos configurables agrupados siempre presentes */}
                    <div className="flex flex-col gap-1">
                      {/* Motivos principales (Reemplazar) */}
                      {quickReasons.filter((r) => r.type === 'replace').length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <span className={`${isCompactHeight ? 'text-[10px]' : 'text-[11px]'} font-bold text-lilac-700 mr-1 select-none`}>
                            Principal:
                          </span>
                          {quickReasons
                            .filter((r) => r.type === 'replace')
                            .map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                disabled={!selectedProduct}
                                onClick={() => handleApplyReason(r)}
                                className={`${isCompactHeight ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'} rounded-lg font-medium transition-all ${
                                  !selectedProduct
                                    ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                                    : reason === r.text
                                    ? 'bg-lilac-600 text-white shadow-xs cursor-pointer'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                                }`}
                                title="Reemplaza todo el texto con este motivo"
                              >
                                {r.text}
                              </button>
                            ))}
                        </div>
                      )}

                      {/* Complementos (Añadir a la frase) */}
                      {quickReasons.filter((r) => r.type === 'append').length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <span className={`${isCompactHeight ? 'text-[10px]' : 'text-[11px]'} font-bold text-emerald-700 mr-1 select-none`}>
                            Añadir detalle:
                          </span>
                          {quickReasons
                            .filter((r) => r.type === 'append')
                            .map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                disabled={!selectedProduct}
                                onClick={() => handleApplyReason(r)}
                                className={`${isCompactHeight ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'} rounded-lg font-medium transition-all ${
                                  !selectedProduct
                                    ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed border border-slate-200/50'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 cursor-pointer'
                                }`}
                                title="Añade esta palabra/detalle a la frase con un espacio"
                              >
                                + {r.text}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Realizar ajuste de inventario */}
              <div className={`${isCompactHeight ? 'pt-1.5 pb-0 gap-1' : isMediumHeight ? 'pt-2 pb-0.5 gap-1.5' : 'pt-3 pb-1 gap-1.5'} flex flex-col items-center shrink-0`}>
                <button
                  type="button"
                  onClick={(e) => handleConfirmAdjust(e)}
                  disabled={
                    isLoading ||
                    !selectedProduct ||
                    !reason.trim() ||
                    calculateEffectiveDelta() === 0 ||
                    calculateNewStock() < 0
                  }
                  className={`${isCompactHeight ? 'px-5 py-1.5 text-xs' : 'px-7 py-2.5 text-sm'} bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-98 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed`}
                  title="Shift + Clic (o Shift+Enter) para mantener el producto tras ajustar"
                >
                  <CheckCircle2 className={isCompactHeight ? 'w-4 h-4' : 'w-5 h-5'} />
                  <span>Realizar ajuste de inventario</span>
                </button>
                <p className={`${isCompactHeight ? 'text-[10px]' : 'text-[11px]'} text-slate-400 text-center`}>
                  Consejo: Presiona <kbd className="px-1 py-0.2 bg-slate-100 rounded border border-slate-300 font-mono font-semibold text-slate-600">Shift</kbd> al hacer clic o presionar Enter para mantener el producto seleccionado tras ajustar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 2: PRODUCTOS CON STOCK BAJO                       */}
        {/* ========================================================= */}
        {activeTab === 'lowStock' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Productos con Stock Bajo o Agotado</h2>
                <p className="text-xs text-slate-500">
                  Artículos cuya existencia es menor o igual al inventario mínimo configurado.
                </p>
              </div>

              <button
                onClick={fetchLowStock}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-lilac-600' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-lilac-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">¡Inventario en orden!</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No hay productos con existencia igual o inferior al stock mínimo en este momento.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-black/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-black/60 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4 text-center">Stock Actual</th>
                        <th className="py-3 px-4 text-center">Mínimo</th>
                        <th className="py-3 px-4 text-center">Faltante</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/60">
                      {lowStockProducts.map((p) => {
                        const isZeroOrNegative = p.stock <= 0
                        const deficit = Math.max(0, p.min_stock - p.stock)

                        return (
                          <tr key={p.code} className="hover:bg-lilac-50/30 transition-colors border-b border-black/60">
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {p.code}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">
                                {getProductDisplayName(p.name, p.parent_name)}
                              </div>
                              {p.product_type === 'variation' && (
                                <span className="inline-block text-[10px] text-lilac-600 bg-lilac-50 px-1.5 py-0.2 rounded font-medium mt-0.5">
                                  Variación
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {p.parent_category_name
                                ? `${p.parent_category_name}${p.category_name ? ' > ' + p.category_name : ''}`
                                : p.category_name || '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                                  isZeroOrNegative
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {p.stock}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-600">
                              {p.min_stock}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-extrabold text-rose-600">+{deficit}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDirectAdjust(p)}
                                className="px-3 py-1.5 bg-lilac-50 hover:bg-lilac-600 hover:text-white text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Ajustar</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 3: MOVIMIENTOS POR DÍA                            */}
        {/* ========================================================= */}
        {activeTab === 'movements' && (() => {
          const filteredMovements = movements.filter((m) => {
            if (!movementSearchQuery.trim()) return true
            const q = movementSearchQuery.trim().toLowerCase()
            const pName = getProductDisplayName(m.product_name, m.parent_name).toLowerCase()
            const pCode = (m.product_code || '').toLowerCase()
            const reason = (m.reason || '').toLowerCase()
            const folio = m.sale_folio ? `venta #${m.sale_folio}`.toLowerCase() : ''
            const type = m.type.toLowerCase()
            return (
              pName.includes(q) ||
              pCode.includes(q) ||
              reason.includes(q) ||
              folio.includes(q) ||
              type.includes(q)
            )
          })

          return (
            <div className="max-w-5xl mx-auto flex flex-col gap-4">
              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Date Selector */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-lilac-600" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-lilac-500"
                    />
                    <button
                      onClick={() => setSelectedDate(getTodayLocalDate())}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hoy
                    </button>
                  </div>

                  {/* Movement Type Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Tipo:</span>
                    <select
                      value={selectedMovementType}
                      onChange={(e) => setSelectedMovementType(e.target.value as MovementType | 'all')}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-lilac-500"
                    >
                      <option value="all">Todos los movimientos</option>
                      <option value="venta">Ventas</option>
                      <option value="devolucion">Devoluciones</option>
                      <option value="ajuste">Ajustes</option>
                      <option value="importacion">Importaciones</option>
                      <option value="inicial">Stock Inicial</option>
                    </select>
                  </div>

                  {/* Barra de Búsqueda de Movimientos */}
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={movementSearchQuery}
                      onChange={(e) => setMovementSearchQuery(e.target.value)}
                      placeholder="Buscar por producto, código, motivo o folio..."
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-lilac-500"
                    />
                    {movementSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMovementSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => fetchMovements()}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-lilac-600' : ''}`} />
                  <span>Refrescar</span>
                </button>
              </div>

              {/* Daily Summary Cards */}
              {filteredMovements.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-lilac-100 shadow-sm flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">Total Movimientos</span>
                    <span className="text-lg font-black text-slate-800">{filteredMovements.length}</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <ArrowUpRight className="w-4 h-4" />
                      <span className="text-xs font-bold">Unidades Ingresadas</span>
                    </div>
                    <span className="text-lg font-black text-emerald-600">
                      +
                      {filteredMovements
                        .filter((m) => m.delta > 0)
                        .reduce((sum, m) => sum + m.delta, 0)}
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-600">
                      <ArrowDownRight className="w-4 h-4" />
                      <span className="text-xs font-bold">Unidades Salidas</span>
                    </div>
                    <span className="text-lg font-black text-rose-600">
                      {filteredMovements
                        .filter((m) => m.delta < 0)
                        .reduce((sum, m) => sum + m.delta, 0)}
                    </span>
                  </div>
                </div>
              )}

              {/* Table */}
              {filteredMovements.length === 0 ? (
                <div className="bg-white rounded-3xl border border-lilac-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-lilac-50 text-lilac-400 flex items-center justify-center mb-3">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    {movements.length === 0 ? 'Sin movimientos registrados' : 'Sin coincidencias en la búsqueda'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {movements.length === 0
                      ? `No hay movimientos de inventario registrados para la fecha (${selectedDate}).`
                      : `Ningún movimiento coincide con "${movementSearchQuery}".`}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-black/60 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-black/60 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Hora</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Producto</th>
                          <th className="py-3 px-4 text-center">Stock Anterior</th>
                          <th className="py-3 px-4 text-center">Movimiento</th>
                          <th className="py-3 px-4 text-center">Stock Resultante</th>
                          <th className="py-3 px-4">Motivo / Referencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/60">
                        {filteredMovements.map((m) => {
                          const badge = getMovementBadge(m.type)
                          const isPositive = m.delta > 0

                          return (
                            <tr key={m.id} className="hover:bg-lilac-50/30 transition-colors border-b border-black/60">
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {formatTime(m.created_at)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${badge.bg} ${badge.text}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                {m.product_code}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800">
                                {getProductDisplayName(m.product_name, m.parent_name)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-mono font-semibold text-slate-600 text-xs">
                                  {m.stock_before !== undefined ? m.stock_before : '—'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-0.5 font-black text-xs ${
                                    isPositive ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                  {isPositive ? `+${m.delta}` : m.delta}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100/80 px-2 py-0.5 rounded-md">
                                  {m.stock_after !== undefined ? m.stock_after : '—'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {m.type === 'venta' && m.sale_folio
                                  ? `Venta #${m.sale_folio}`
                                  : m.reason || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ========================================================= */}
        {/* SUBTAB 4: KARDEX DE PRODUCTO                             */}
        {/* ========================================================= */}
        {activeTab === 'kardex' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            {/* Search Bar Unificada */}
            <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={kardexCodeInputRef}
                  type="text"
                  value={kardexCodeInput}
                  onChange={(e) => setKardexCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCodeSearch('kardex')
                  }}
                  placeholder="Escanear o ingresar código de producto y presionar Enter..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-sm font-mono outline-none transition-all uppercase shadow-2xs"
                />
                {kardexCodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setKardexCodeInput('')
                      kardexCodeInputRef.current?.focus()
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Limpiar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleOpenSearchModal('kardex')}
                  className="w-full sm:w-auto px-4 py-2 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  title="Buscar en el catálogo de productos (F10)"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar en Catálogo (F10)</span>
                </button>
              </div>
            </div>

            {!kardexProduct ? (
              <div className="bg-white rounded-3xl border border-dashed border-lilac-200 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-lilac-50 text-lilac-400 flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-1">Kardex Histórico</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6">
                  Selecciona un producto para auditar cronológicamente todas sus entradas, salidas, ventas y ajustes de stock.
                </p>
                <button
                  onClick={() => handleOpenSearchModal('kardex')}
                  className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Seleccionar Producto</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Selected Product Banner */}
                <div className="bg-white rounded-3xl border border-lilac-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {kardexProduct.code}
                      </span>
                      {(kardexProduct.parent_category_name || kardexProduct.category_name) && (
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-lilac-50 text-lilac-700 border border-lilac-100">
                          {kardexProduct.parent_category_name
                            ? `${kardexProduct.parent_category_name}${kardexProduct.category_name ? ' > ' + kardexProduct.category_name : ''}`
                            : kardexProduct.category_name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {getProductDisplayName(kardexProduct.name, kardexProduct.parent_name)}
                    </h2>
                    <div className="text-xs text-slate-500">
                      Precio de venta: <strong className="text-slate-700">{formatCLP(kardexProduct.sale_price)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Stock Actual</span>
                      <span className="text-2xl font-black text-slate-800">{kardexProduct.stock}</span>
                    </div>

                    <button
                      onClick={() => setKardexProduct(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                      title="Cambiar producto"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Kardex Movements Table */}
                {kardexMovements.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-lilac-100 p-8 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-500">
                      Este producto aún no registra movimientos de inventario en el historial.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-black/60 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-black/60 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Fecha y Hora</th>
                            <th className="py-3 px-4">Tipo</th>
                            <th className="py-3 px-4 text-center">Stock Anterior</th>
                            <th className="py-3 px-4 text-center">Variación (Delta)</th>
                            <th className="py-3 px-4 text-center">Stock Resultante</th>
                            <th className="py-3 px-4">Motivo / Referencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/60">
                          {kardexMovements.map((m) => {
                            const badge = getMovementBadge(m.type)
                            const isPositive = m.delta > 0

                            return (
                              <tr key={m.id} className="hover:bg-lilac-50/30 transition-colors border-b border-black/60">
                                <td className="py-3 px-4 font-mono text-slate-600">
                                  {formatDateTime(m.created_at)}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${badge.bg} ${badge.text}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-mono font-semibold text-slate-600 text-xs">
                                    {m.stock_before !== undefined ? m.stock_before : '—'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`inline-flex items-center gap-0.5 font-black text-xs ${
                                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                    {isPositive ? `+${m.delta}` : m.delta}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100/80 px-2 py-0.5 rounded-md">
                                    {m.stock_after !== undefined ? m.stock_after : '—'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {m.type === 'venta' && m.sale_folio
                                    ? `Venta #${m.sale_folio}`
                                    : m.reason || '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shared ProductSearch Modal */}
      <ProductSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectProduct={handleModalSelect}
        title={modalTarget === 'adjust' ? 'Seleccionar Producto para Ajuste' : 'Seleccionar Producto para Kardex'}
        placeholder="Escribe el nombre o fragmento con % (ej: algod, %negro)..."
        footerText="Haz clic en cualquier producto para seleccionarlo."
      />
    </div>
  )
}
