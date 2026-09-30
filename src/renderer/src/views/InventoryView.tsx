import React, { useState, useEffect, useRef } from 'react'
import {
  SlidersHorizontal,
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Search,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle2,
  Package,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  X,
  AlertCircle
} from 'lucide-react'
import { useInventoryStore } from '../store/inventoryStore'
import { ProductSearchResult, MovementType } from '@shared/types'
import { ProductSearchModal } from '../components/ProductSearchModal'
import { formatCLP } from '../utils/formatters'

const QUICK_REASONS = [
  'Conteo físico / Arqueo',
  'Merma por daño o rotura',
  'Devolución a proveedor',
  'Ingreso de mercadería / Ajuste',
  'Pérdida / Descuadre',
  'Corrección de inventario'
]

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

  // Estado del formulario de ajuste
  const [adjustMode, setAdjustMode] = useState<'relative' | 'replace'>('relative')
  const [relativeDelta, setRelativeDelta] = useState<number>(1)
  const [replaceQuantity, setReplaceQuantity] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const codeInputRef = useRef<HTMLInputElement>(null)

  // Cargar datos al montar y al cambiar de tab
  useEffect(() => {
    fetchLowStock()
  }, [fetchLowStock])

  useEffect(() => {
    if (activeTab === 'adjust' && !selectedProduct) {
      codeInputRef.current?.focus()
    }
  }, [activeTab, selectedProduct])

  // Al seleccionar un producto en 'adjust', inicializar la cantidad de reemplazo con su stock actual
  useEffect(() => {
    if (selectedProduct) {
      setReplaceQuantity(selectedProduct.stock)
      setRelativeDelta(1)
      setReason('')
      setFeedbackMessage(null)
    }
  }, [selectedProduct])

  // Calcular nuevo stock según el modo
  const calculateNewStock = (): number => {
    if (!selectedProduct) return 0
    if (adjustMode === 'relative') {
      return selectedProduct.stock + relativeDelta
    }
    return replaceQuantity
  }

  // Calcular delta real
  const calculateEffectiveDelta = (): number => {
    if (!selectedProduct) return 0
    if (adjustMode === 'relative') {
      return relativeDelta
    }
    return replaceQuantity - selectedProduct.stock
  }

  // Buscar producto por código digitado / escaneado
  const handleCodeSearch = async (target: 'adjust' | 'kardex'): Promise<void> => {
    const raw = target === 'adjust' ? codeInput.trim() : kardexCodeInput.trim()
    if (!raw) return

    try {
      const results = await window.api.searchProducts({ query: raw, onlySellable: true })
      const exactMatch = results.find((p) => p.code && p.code.toLowerCase() === raw.toLowerCase()) || results[0]

      if (exactMatch) {
        if (target === 'adjust') {
          setSelectedProduct(exactMatch)
          setCodeInput('')
        } else {
          setKardexProduct(exactMatch)
          setKardexCodeInput('')
        }
      } else {
        // Si no se encuentra exactamente, abrir el modal con el texto
        setModalTarget(target)
        setIsSearchModalOpen(true)
      }
    } catch (err: any) {
      console.error('Error buscando producto:', err)
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al buscar el producto' })
    }
  }

  // Enviar formulario de ajuste
  const handleConfirmAdjust = async (): Promise<void> => {
    if (!selectedProduct || !selectedProduct.code) return

    const effDelta = calculateEffectiveDelta()
    const newStock = calculateNewStock()

    if (effDelta === 0) {
      setFeedbackMessage({ type: 'error', text: 'El ajuste no modifica la existencia (delta = 0).' })
      return
    }

    if (newStock < 0) {
      setFeedbackMessage({ type: 'error', text: 'El stock resultante no puede ser negativo.' })
      return
    }

    if (!reason.trim()) {
      setFeedbackMessage({ type: 'error', text: 'El motivo del ajuste es obligatorio.' })
      return
    }

    try {
      if (adjustMode === 'relative') {
        await adjustStock({
          product_code: selectedProduct.code,
          delta: relativeDelta,
          reason: reason.trim()
        })
      } else {
        await adjustStock({
          product_code: selectedProduct.code,
          new_stock: replaceQuantity,
          reason: reason.trim()
        })
      }

      setFeedbackMessage({
        type: 'success',
        text: `¡Ajuste guardado con éxito! Nuevo stock de ${selectedProduct.name}: ${newStock} unidades.`
      })
      setReason('')
      // Actualizar conteo de stock bajo en segundo plano
      fetchLowStock()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al procesar el ajuste.' })
    }
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
    } else {
      setKardexProduct(product)
      setKardexCodeInput('')
    }
  }

  // Acceso directo desde Stock Bajo para ajustar
  const handleDirectAdjust = (product: ProductSearchResult): void => {
    setSelectedProduct(product)
    setActiveTab('adjust')
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
      <div className="bg-white border-b border-lilac-100 px-6 pt-4 pb-0 flex flex-col gap-3 shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-600 flex items-center justify-center shadow-inner">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Control de Inventario</h1>
              <p className="text-xs text-slate-500">
                Ajustes físicos, alertas de stock mínimo, auditoría diaria y kardex por producto.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-transparent -mb-px">
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
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
      <div className="flex-1 p-6 overflow-y-auto">
        {/* ========================================================= */}
        {/* SUBTAB 1: AJUSTAR EXISTENCIA                             */}
        {/* ========================================================= */}
        {activeTab === 'adjust' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            {/* Top Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCodeSearch('adjust')
                  }}
                  placeholder="Escanear código de barras o escribir código..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-sm font-mono outline-none transition-all uppercase"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleCodeSearch('adjust')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Buscar Código
                </button>
                <button
                  onClick={() => handleOpenSearchModal('adjust')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Catálogo Completo</span>
                </button>
              </div>
            </div>

            {/* Notification / Feedback Banner */}
            {feedbackMessage && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {feedbackMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedbackMessage.text}</span>
                </div>
                <button
                  onClick={() => setFeedbackMessage(null)}
                  className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!selectedProduct ? (
              <div className="bg-white rounded-3xl border border-dashed border-lilac-200 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-lilac-50 text-lilac-400 flex items-center justify-center mb-4">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-1">Ningún producto seleccionado</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6">
                  Pistolea el código de barras con tu lector o pulsa &ldquo;Catálogo Completo&rdquo; para buscarlo por nombre.
                </p>
                <button
                  onClick={() => handleOpenSearchModal('adjust')}
                  className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Explorar Catálogo</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Product Info Card */}
                <div className="bg-white rounded-3xl border border-lilac-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {selectedProduct.code}
                      </span>
                      {(selectedProduct.parent_category_name || selectedProduct.category_name) && (
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-lilac-50 text-lilac-700 border border-lilac-100">
                          {selectedProduct.parent_category_name
                            ? `${selectedProduct.parent_category_name}${selectedProduct.category_name ? ' > ' + selectedProduct.category_name : ''}`
                            : selectedProduct.category_name}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-600">
                        {selectedProduct.product_type === 'variation' ? 'Variación' : 'Producto Simple'}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-800">
                      {selectedProduct.parent_name
                        ? `${selectedProduct.parent_name} ${selectedProduct.name}`
                        : selectedProduct.name}
                    </h2>

                    <div className="text-xs text-slate-500 font-medium">
                      Precio de venta: <span className="font-bold text-slate-800">{formatCLP(selectedProduct.sale_price)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-600">Existencia Actual</span>
                      <span className="text-2xl font-black text-slate-800">{selectedProduct.stock}</span>
                      <span className="text-[11px] text-slate-500">unidades</span>
                    </div>

                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                      title="Cambiar producto"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Adjustment Controls Form */}
                <div className="bg-white rounded-3xl border border-lilac-100 p-6 shadow-sm flex flex-col gap-6">
                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                      onClick={() => setAdjustMode('relative')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        adjustMode === 'relative'
                          ? 'bg-white text-lilac-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ajuste Relativo (+ / −)
                    </button>
                    <button
                      onClick={() => setAdjustMode('replace')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        adjustMode === 'replace'
                          ? 'bg-white text-lilac-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Reemplazar Existencia
                    </button>
                  </div>

                  {/* Quantity Input Area */}
                  {adjustMode === 'relative' ? (
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-slate-700">
                        Cantidad a sumar (+) o restar (−):
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5">
                          {[-10, -5, -1].map((val) => (
                            <button
                              key={val}
                              onClick={() => setRelativeDelta((prev) => prev + val)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                            >
                              {val}
                            </button>
                          ))}
                        </div>

                        {/* Number Input with +/- buttons */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setRelativeDelta((prev) => prev - 1)}
                            className="p-2.5 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={relativeDelta}
                            onChange={(e) => setRelativeDelta(parseInt(e.target.value, 10) || 0)}
                            className="w-24 text-center font-bold text-slate-800 bg-transparent text-sm outline-none"
                          />
                          <button
                            onClick={() => setRelativeDelta((prev) => prev + 1)}
                            className="p-2.5 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {[+1, +5, +10].map((val) => (
                            <button
                              key={val}
                              onClick={() => setRelativeDelta((prev) => prev + val)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                            >
                              +{val}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setRelativeDelta(0)}
                          className="text-xs text-slate-400 hover:text-slate-600 underline ml-2"
                        >
                          Restablecer a 0
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-slate-700">
                        Nueva existencia física total (conteo real en bodega/tienda):
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setReplaceQuantity((prev) => Math.max(0, prev - 1))}
                            className="p-2.5 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={replaceQuantity}
                            onChange={(e) => setReplaceQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-28 text-center font-bold text-slate-800 bg-transparent text-base outline-none"
                          />
                          <button
                            onClick={() => setReplaceQuantity((prev) => prev + 1)}
                            className="p-2.5 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-500">
                          Existencia anterior: <strong className="text-slate-700">{selectedProduct.stock}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Result Preview Card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-600">Stock Actual</span>
                        <span className="text-sm font-extrabold text-slate-700">{selectedProduct.stock}</span>
                      </div>

                      <div className="text-slate-300 font-bold">➔</div>

                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-600">Diferencia</span>
                        <span
                          className={`text-sm font-extrabold ${
                            calculateEffectiveDelta() > 0
                              ? 'text-emerald-600'
                              : calculateEffectiveDelta() < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {calculateEffectiveDelta() > 0 ? `+${calculateEffectiveDelta()}` : calculateEffectiveDelta()}
                        </span>
                      </div>

                      <div className="text-slate-300 font-bold">➔</div>

                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-600">Nuevo Stock</span>
                        <span
                          className={`text-base font-black ${
                            calculateNewStock() < 0
                              ? 'text-rose-600'
                              : calculateNewStock() === 0
                              ? 'text-amber-600'
                              : 'text-lilac-700'
                          }`}
                        >
                          {calculateNewStock()} unidades
                        </span>
                      </div>
                    </div>

                    {calculateNewStock() < 0 && (
                      <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        No puede ser negativo
                      </span>
                    )}
                  </div>

                  {/* Required Reason Input */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Motivo del ajuste <span className="text-rose-500">*</span>:
                      </label>
                      <span className="text-[11px] text-slate-400">Requerido para auditoría y kardex</span>
                    </div>

                    {/* Quick Reason Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {QUICK_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            reason === r
                              ? 'bg-lilac-600 text-white shadow-sm'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Escribe el motivo del ajuste (ej: Conteo físico, Merma por daño)..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                    />
                  </div>

                  {/* Submit Action Button */}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={handleConfirmAdjust}
                      disabled={
                        isLoading ||
                        !reason.trim() ||
                        calculateEffectiveDelta() === 0 ||
                        calculateNewStock() < 0
                      }
                      className="px-6 py-2.5 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar y Guardar Ajuste</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
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
              <div className="bg-white rounded-3xl border border-lilac-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-lilac-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-slate-100">
                      {lowStockProducts.map((p) => {
                        const isZeroOrNegative = p.stock <= 0
                        const deficit = Math.max(0, p.min_stock - p.stock)

                        return (
                          <tr key={p.code} className="hover:bg-lilac-50/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {p.code}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">
                                {p.parent_name ? `${p.parent_name} ${p.name}` : p.name}
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
        {activeTab === 'movements' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
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
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
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
              </div>

              <button
                onClick={() => fetchMovements()}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-lilac-600' : ''}`} />
                <span>Refrescar</span>
              </button>
            </div>

            {/* Daily Summary Cards */}
            {movements.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-lilac-100 shadow-sm flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Movimientos</span>
                  <span className="text-lg font-black text-slate-800">{movements.length}</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-xs font-bold">Unidades Ingresadas</span>
                  </div>
                  <span className="text-lg font-black text-emerald-600">
                    +
                    {movements
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
                    {movements
                      .filter((m) => m.delta < 0)
                      .reduce((sum, m) => sum + m.delta, 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Table */}
            {movements.length === 0 ? (
              <div className="bg-white rounded-3xl border border-lilac-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-lilac-50 text-lilac-400 flex items-center justify-center mb-3">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Sin movimientos registrados</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No hay movimientos de inventario que coincidan con la fecha ({selectedDate}) y el filtro seleccionado.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-lilac-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-lilac-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Hora</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4 text-center">Movimiento</th>
                        <th className="py-3 px-4">Motivo / Referencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.map((m) => {
                        const badge = getMovementBadge(m.type)
                        const isPositive = m.delta > 0

                        return (
                          <tr key={m.id} className="hover:bg-lilac-50/30 transition-colors">
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
                              {m.parent_name ? `${m.parent_name} ${m.product_name}` : m.product_name}
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

        {/* ========================================================= */}
        {/* SUBTAB 4: KARDEX DE PRODUCTO                             */}
        {/* ========================================================= */}
        {activeTab === 'kardex' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-lilac-100 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={kardexCodeInput}
                  onChange={(e) => setKardexCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCodeSearch('kardex')
                  }}
                  placeholder="Escanear o escribir código de producto para ver su Kardex..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-sm font-mono outline-none transition-all uppercase"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleCodeSearch('kardex')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Buscar Código
                </button>
                <button
                  onClick={() => handleOpenSearchModal('kardex')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Explorar Catálogo</span>
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
                      {kardexProduct.parent_name
                        ? `${kardexProduct.parent_name} ${kardexProduct.name}`
                        : kardexProduct.name}
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
                  <div className="bg-white rounded-3xl border border-lilac-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-lilac-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Fecha y Hora</th>
                            <th className="py-3 px-4">Tipo</th>
                            <th className="py-3 px-4 text-center">Cantidad (Delta)</th>
                            <th className="py-3 px-4">Motivo / Referencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {kardexMovements.map((m) => {
                            const badge = getMovementBadge(m.type)
                            const isPositive = m.delta > 0

                            return (
                              <tr key={m.id} className="hover:bg-lilac-50/30 transition-colors">
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
                                  <span
                                    className={`inline-flex items-center gap-0.5 font-black text-xs ${
                                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                    {isPositive ? `+${m.delta}` : m.delta}
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
