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
  Barcode
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

  // Estado del formulario de ajuste
  const [deltaInput, setDeltaInput] = useState('')
  const [newStockInput, setNewStockInput] = useState('')
  const [reason, setReason] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [quickReasons, setQuickReasons] = useState<QuickAdjustmentReason[]>([...DEFAULT_QUICK_REASONS])

  const codeInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (activeTab === 'adjust' && !selectedProduct) {
      codeInputRef.current?.focus()
    }
  }, [activeTab, selectedProduct])

  // Al seleccionar un producto en 'adjust', inicializar inputs con su stock actual
  useEffect(() => {
    if (selectedProduct) {
      setCodeInput(selectedProduct.code || '')
      setNewStockInput(String(selectedProduct.stock))
      setDeltaInput('')
      setReason('')
      setFeedbackMessage(null)
    } else {
      setCodeInput('')
      setNewStockInput('')
      setDeltaInput('')
      setReason('')
    }
  }, [selectedProduct])

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
      const results = await window.api.searchProducts({ query: raw, onlySellable: true })
      const exactMatch = results.find((p) => p.code && p.code.toLowerCase() === raw.toLowerCase()) || results[0]

      if (exactMatch) {
        if (target === 'adjust') {
          setSelectedProduct(exactMatch)
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
    if (!selectedProduct || !selectedProduct.code) {
      setFeedbackMessage({ type: 'error', text: 'Debe seleccionar un producto para ajustar.' })
      return
    }

    const effDelta = calculateEffectiveDelta()
    const newStock = calculateNewStock()

    if (effDelta === 0) {
      setFeedbackMessage({ type: 'error', text: 'El ajuste no modifica la existencia (diferencia = 0).' })
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
      await adjustStock({
        product_code: selectedProduct.code,
        new_stock: newStock,
        reason: reason.trim()
      })

      setFeedbackMessage({
        type: 'success',
        text: `¡Ajuste guardado con éxito! Nuevo stock de ${selectedProduct.name}: ${newStock} unidades.`
      })
      setDeltaInput('')
      setNewStockInput(String(newStock))
      setReason('')
      // Actualizar conteo de stock bajo en segundo plano
      fetchLowStock()
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al procesar el ajuste.' })
    }
  }

  // Aplicar motivo rápido (reemplazar o añadir a la frase)
  const handleApplyReason = (item: QuickAdjustmentReason): void => {
    if (item.type === 'replace') {
      setReason(item.text)
    } else {
      setReason((prev) => (prev.trim() ? `${prev.trim()} ${item.text}` : item.text))
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
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl border border-lilac-100 p-8 shadow-sm flex flex-col gap-6">
              {/* Encabezado al estilo de la captura */}
              <div className="flex items-center justify-between border-b border-lilac-50 pb-4">
                <h2 className="text-xl font-black text-lilac-800 uppercase tracking-wide">
                  AJUSTAR INVENTARIO
                </h2>
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null)
                      setCodeInput('')
                      codeInputRef.current?.focus()
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cambiar producto</span>
                  </button>
                )}
              </div>

              {/* Mensaje de feedback / notificación */}
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
                    type="button"
                    onClick={() => setFeedbackMessage(null)}
                    className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Formulario alineado al estilo de la captura */}
              <div className="flex flex-col gap-4">
                {/* 1. Código del Producto */}
                <div className="flex items-center">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    Código del Producto
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1">
                      <Barcode className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCodeSearch('adjust')
                        }}
                        placeholder="Escanear o ingresar código..."
                        className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-300 focus:border-lilac-500 focus:bg-white rounded-lg text-sm font-mono outline-none transition-all uppercase"
                      />
                      {codeInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setCodeInput('')
                            setSelectedProduct(null)
                            codeInputRef.current?.focus()
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          title="Limpiar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCodeSearch('adjust')}
                      className="px-3 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-sm"
                    >
                      Buscar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSearchModal('adjust')}
                      className="px-3 py-2 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                      title="Explorar catálogo completo"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Catálogo</span>
                    </button>
                  </div>
                </div>

                {/* 2. Nombre */}
                <div className="flex items-center min-h-[36px]">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    Nombre
                  </label>
                  <div className="flex-1 text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {selectedProduct ? (
                      <span>
                        {selectedProduct.parent_name
                          ? `${selectedProduct.parent_name} ${selectedProduct.name}`
                          : selectedProduct.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal italic text-xs sm:text-sm">
                        Ningún producto seleccionado
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Precio Venta (impreso en texto, justo debajo de Nombre) */}
                <div className="flex items-center min-h-[36px]">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    Precio Venta
                  </label>
                  <div className="flex-1 text-sm sm:text-base font-bold text-slate-800">
                    {selectedProduct ? (
                      <span>{formatCLP(selectedProduct.sale_price)}</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic text-xs sm:text-sm">—</span>
                    )}
                  </div>
                </div>

                {/* 4. Cantidad Actual */}
                <div className="flex items-center min-h-[36px]">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    Cantidad Actual
                  </label>
                  <div className="flex-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-800">
                      {selectedProduct ? selectedProduct.stock : '—'}
                    </span>
                    {selectedProduct && (
                      <span className="text-xs text-slate-500 font-medium">unidades</span>
                    )}
                  </div>
                </div>

                {/* 5. + / - */}
                <div className="flex items-center">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    + / -
                  </label>
                  <div className="w-36 sm:w-44">
                    <input
                      type="text"
                      disabled={!selectedProduct}
                      value={deltaInput}
                      onChange={handleDeltaChange}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-lilac-500 rounded-lg text-sm font-bold text-slate-800 text-right outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {/* 6. Nueva Cantidad */}
                <div className="flex items-center">
                  <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                    Nueva Cantidad
                  </label>
                  <div className="w-36 sm:w-44">
                    <input
                      type="text"
                      disabled={!selectedProduct}
                      value={newStockInput}
                      onChange={handleNewStockChange}
                      placeholder="0"
                      className={`w-full px-3 py-1.5 bg-white border rounded-lg text-sm font-bold text-right outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-400 ${
                        calculateNewStock() < 0
                          ? 'border-rose-400 text-rose-600 focus:border-rose-500'
                          : 'border-slate-300 text-slate-800 focus:border-lilac-500'
                      }`}
                    />
                  </div>
                  {calculateNewStock() < 0 && (
                    <span className="ml-3 text-xs font-semibold text-rose-600">
                      No puede ser negativo
                    </span>
                  )}
                </div>

                {/* 7. Motivo del ajuste */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center">
                    <label className="w-36 sm:w-44 text-right pr-4 text-xs sm:text-sm font-bold text-slate-700 shrink-0">
                      Motivo del ajuste
                    </label>
                    <input
                      type="text"
                      disabled={!selectedProduct}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo del ajuste..."
                      className="flex-1 py-2 px-3 bg-white border border-slate-300 focus:border-lilac-500 rounded-lg text-sm outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Chips de motivos configurables agrupados */}
                  {selectedProduct && (
                    <div className="ml-36 sm:ml-44 flex flex-col gap-2 pt-1">
                      {/* Motivos principales (Reemplazar) */}
                      {quickReasons.filter((r) => r.type === 'replace').length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-lilac-700 mr-1 select-none">
                            Principal:
                          </span>
                          {quickReasons
                            .filter((r) => r.type === 'replace')
                            .map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleApplyReason(r)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                  reason === r.text
                                    ? 'bg-lilac-600 text-white shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-emerald-700 mr-1 select-none">
                            Añadir detalle:
                          </span>
                          {quickReasons
                            .filter((r) => r.type === 'append')
                            .map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleApplyReason(r)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60"
                                title="Añade esta palabra/detalle a la frase con un espacio"
                              >
                                + {r.text}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botón centrado al estilo de la captura */}
              <div className="pt-6 flex justify-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleConfirmAdjust}
                  disabled={
                    isLoading ||
                    !selectedProduct ||
                    !reason.trim() ||
                    calculateEffectiveDelta() === 0 ||
                    calculateNewStock() < 0
                  }
                  className="px-8 py-3 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed hover:shadow-lg active:scale-98"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Realizar ajuste de inventario</span>
                </button>
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
