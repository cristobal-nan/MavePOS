import React, { useRef, useState, useEffect } from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  AlertTriangle,
  GitBranch,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Boxes
} from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { formatCLP } from '../utils/formatters'
import { useCatalogStore } from '../store/catalogStore'

interface ProductSearchProps {
  onSelectProduct?: (product: ProductSearchResult) => void
  onEditProduct?: (product: ProductSearchResult) => void
  onDeleteProduct?: (product: ProductSearchResult) => void
  showActions?: boolean
  selectedProductCode?: string | null
  placeholder?: string
  autoFocus?: boolean
  enableMultiSelect?: boolean
  selectedIds?: Set<number>
  onToggleSelect?: (product: ProductSearchResult) => void
  onToggleParentWithVariations?: (parent: ProductSearchResult, variations: ProductSearchResult[]) => void
  onSelectAllVisible?: () => void
  isAllVisibleSelected?: boolean
  context?: 'catalog' | 'modal'
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  onSelectProduct,
  onEditProduct,
  onDeleteProduct,
  showActions = true,
  selectedProductCode = null,
  placeholder = 'Buscar por nombre (ej: algod, %algod, algod%negro) o código exacto...',
  autoFocus = true,
  enableMultiSelect = false,
  selectedIds,
  onToggleSelect,
  onToggleParentWithVariations,
  onSelectAllVisible,
  isAllVisibleSelected = false,
  context = 'catalog'
}) => {
  const {
    products: catalogProducts,
    modalProducts,
    searchQuery: catalogSearchQuery,
    modalSearchQuery,
    setSearchQuery,
    orderBy,
    orderDir,
    toggleSort,
    columnWidths: catalogColumnWidths,
    modalColumnWidths,
    setColumnWidth,
    isLoading: catalogIsLoading,
    modalIsLoading,
    isLoadingMore: catalogIsLoadingMore,
    modalIsLoadingMore,
    hasMore: catalogHasMore,
    modalHasMore,
    loadMoreProducts,
    fetchProducts,
    config
  } = useCatalogStore()

  const products = context === 'modal' ? modalProducts : catalogProducts
  const searchQuery = context === 'modal' ? modalSearchQuery : catalogSearchQuery
  const isLoading = context === 'modal' ? modalIsLoading : catalogIsLoading
  const isLoadingMore = context === 'modal' ? modalIsLoadingMore : catalogIsLoadingMore
  const hasMore = context === 'modal' ? modalHasMore : catalogHasMore

  // Seleccionar conjunto de anchos según contexto (pestaña vs ventana emergente)
  const columnWidths = context === 'modal' ? modalColumnWidths : catalogColumnWidths

  // Infinite scroll refs
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Default column widths for double click reset
  const DEFAULT_COLUMN_WIDTHS: Record<string, number> =
    context === 'modal'
      ? {
          code: 120,
          name: 260,
          type: 130,
          category: 150,
          price: 100,
          stock: 80,
          actions: 0
        }
      : {
          code: 130,
          name: 270,
          type: 140,
          category: 160,
          price: 110,
          stock: 90,
          actions: 100
        }

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)
  const hasDraggedRef = useRef<boolean>(false)

  // Highlighted index for modal keyboard navigation (single click / arrow keys)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0)
  // Set of collapsed parent IDs (default empty => everything expanded)
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(new Set())
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter visible products according to collapsed parent variable products in catalog
  const visibleProducts = products.filter((p) => {
    if (context === 'catalog' && p.parent_id && collapsedParentIds.has(p.parent_id)) {
      return false
    }
    return true
  })

  // Reset highlighted row to 0 on new query or product list change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [products, searchQuery])

  // Scroll highlighted row into view smoothly
  useEffect(() => {
    if (rowRefs.current[highlightedIndex]) {
      rowRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const toggleParentCollapse = (parentId: number, e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setCollapsedParentIds((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      return next
    })
  }

  const handleToggleParentCheckbox = (parent: ProductSearchResult): void => {
    const parentId = parent.id
    if (!parentId) return
    const childVariations = products.filter((p) => p.parent_id === parentId)
    if (onToggleParentWithVariations) {
      onToggleParentWithVariations(parent, childVariations)
    } else if (onToggleSelect) {
      onToggleSelect(parent)
      childVariations.forEach((v) => onToggleSelect(v))
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setHighlightedIndex((prev) => Math.min(visibleProducts.length - 1, prev + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setHighlightedIndex((prev) => Math.max(0, prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const target = visibleProducts[highlightedIndex]
      if (target) {
        if (context === 'modal') {
          onSelectProduct?.(target)
        } else if (onEditProduct) {
          onEditProduct(target)
        }
      }
    }
  }

  // Navegación estricta con flechas (modal y catálogo): jamás scrollear la vista con flechas, siempre navegar producto
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      // 1. En catálogo: ignorar si hay cualquier modal abierto encima (z-50 o z-60)
      if (context === 'catalog') {
        if (document.querySelector('.fixed.z-50') || document.querySelector('.fixed.z-60')) {
          return
        }
      }

      // 2. En modal: ignorar si hay un modal superior apilado encima (z-60)
      if (context === 'modal') {
        if (document.querySelector('.fixed.z-60')) {
          return
        }
      }

      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT'
      const isOurSearchInput = activeEl === searchInputRef.current

      // Si el foco está en un input ajeno (no el buscador ni la tabla de este componente), no interceptar
      if (isInput && !isOurSearchInput) {
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightedIndex((prev) => Math.min(visibleProducts.length - 1, prev + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'Enter') {
        // En modal, Enter siempre selecciona el producto actual (incluso si perdió el foco el input)
        if (context === 'modal') {
          e.preventDefault()
          e.stopPropagation()
          const target = visibleProducts[highlightedIndex]
          if (target) {
            onSelectProduct?.(target)
          }
        } else if (context === 'catalog' && !isOurSearchInput) {
          // En catálogo, Enter abre edición si el foco no está escribiendo en el buscador
          e.preventDefault()
          e.stopPropagation()
          const target = visibleProducts[highlightedIndex]
          if (target && onEditProduct) {
            onEditProduct(target)
          }
        }
      } else if (e.key === ' ' && context === 'catalog' && enableMultiSelect && !isOurSearchInput) {
        e.preventDefault()
        e.stopPropagation()
        const target = visibleProducts[highlightedIndex]
        if (target) {
          if (target.product_type === 'variable') {
            handleToggleParentCheckbox(target)
          } else {
            onToggleSelect?.(target)
          }
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [context, visibleProducts, highlightedIndex, enableMultiSelect, onToggleSelect, onSelectProduct, onEditProduct])

  const handleMouseDownResize = (col: string, e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setResizingCol(col)
    hasDraggedRef.current = false
    resizeStartX.current = e.clientX

    // Usar el ancho físico real del <th> para evitar saltos o discrepancias
    const thElement = e.currentTarget.closest('th') as HTMLElement | null
    const initialWidth = thElement
      ? Math.round(thElement.getBoundingClientRect().width)
      : columnWidths[col as keyof typeof columnWidths] || 120
    resizeStartWidth.current = initialWidth

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaX = moveEvent.clientX - resizeStartX.current
      if (Math.abs(deltaX) > 2) {
        hasDraggedRef.current = true
      }
      const newWidth = Math.max(60, Math.round(resizeStartWidth.current + deltaX))
      setColumnWidth(col, newWidth, context)
    }

    const handleMouseUp = (): void => {
      setResizingCol(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setTimeout(() => {
        hasDraggedRef.current = false
      }, 100)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const renderResizeHandle = (col: string): React.ReactNode => (
    <div
      onMouseDown={(e) => handleMouseDownResize(col, e)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setColumnWidth(col, DEFAULT_COLUMN_WIDTHS[col] || 120, context)
      }}
      className="absolute -right-1 top-0 bottom-0 w-2.5 z-20 cursor-col-resize flex items-center justify-center group/resizer select-none"
      title="Arrastra para redimensionar (doble clic para restablecer)"
    >
      <div
        className={`w-0.5 h-full transition-colors ${
          resizingCol === col ? 'bg-lilac-600' : 'group-hover/resizer:bg-lilac-400 bg-transparent'
        }`}
      />
    </div>
  )

  // Set up IntersectionObserver for progressive / infinite scrolling
  useEffect(() => {
    const container = containerRef.current
    const sentinel = sentinelRef.current
    if (!container || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMoreProducts(context)
        }
      },
      {
        root: container,
        rootMargin: '300px',
        threshold: 0
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, isLoadingMore, loadMoreProducts, context])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreProducts(context)
      }
    }
  }

  const renderSortIcon = (column: 'name' | 'stock' | 'sale_price'): React.ReactNode => {
    if (orderBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    }
    return orderDir === 'ASC' ? (
      <ArrowUp className="w-3.5 h-3.5 text-lilac-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-lilac-600" />
    )
  }

  const isModal = context === 'modal'
  const showTypeCol = context !== 'modal'

  const totalColumnsWidth =
    (enableMultiSelect ? 40 : 0) +
    columnWidths.code +
    columnWidths.name +
    (showTypeCol ? columnWidths.type : 0) +
    columnWidths.category +
    columnWidths.price +
    columnWidths.stock +
    (showActions ? columnWidths.actions : 0)

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-2xl border border-black/60 shadow-sm overflow-hidden select-none">
      {/* Search Input Bar */}
      <div className={`${isModal ? 'p-2' : 'p-2.5'} border-b border-black/60 bg-white flex items-center gap-2.5`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value, context)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onKeyDown={handleInputKeyDown}
            className={`w-full pl-9 pr-4 ${isModal ? 'py-1.5 text-sm' : 'py-1.5 text-xs'} bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('', context)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 whitespace-nowrap hidden sm:flex items-center gap-1.5 font-medium">
          <span>Mostrando:</span>
          <span className="font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-full">
            {products.length}{hasMore ? '+' : ''}
          </span>
          {hasMore && (
            <span className="text-[11px] text-slate-400 italic">(baja para ver más)</span>
          )}
        </div>
      </div>

      {/* Table Container with persistent resizable headers */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault()
          }
        }}
        className="flex-1 overflow-auto bg-slate-50/50"
      >
        <table
          style={{
            width: `max(100%, ${totalColumnsWidth}px)`,
            minWidth: `${totalColumnsWidth}px`
          }}
          className="text-left border-collapse table-fixed"
        >
          <colgroup>
            {enableMultiSelect && <col style={{ width: '40px', minWidth: '40px' }} />}
            <col style={{ width: `${columnWidths.code}px`, minWidth: `${columnWidths.code}px` }} />
            <col style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }} />
            {showTypeCol && <col style={{ width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }} />}
            <col style={{ width: `${columnWidths.category}px`, minWidth: `${columnWidths.category}px` }} />
            <col style={{ width: `${columnWidths.price}px`, minWidth: `${columnWidths.price}px` }} />
            <col style={{ width: `${columnWidths.stock}px`, minWidth: `${columnWidths.stock}px` }} />
            {showActions && <col style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px` }} />}
            <col style={{ width: 'auto' }} />
          </colgroup>
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-black/60 text-xs font-semibold text-slate-600 shadow-sm">
            <tr>
              {enableMultiSelect && (
                <th
                  style={{ width: '40px', minWidth: '40px' }}
                  className="py-1 px-1 text-center border-r border-black/60 cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      onSelectAllVisible?.()
                    }
                  }}
                  title="Seleccionar / deseleccionar todos los visibles"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected && products.length > 0}
                      onChange={onSelectAllVisible}
                      className="w-4 h-4 rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer accent-lilac-600"
                      title="Seleccionar / deseleccionar todos los visibles"
                    />
                  </div>
                </th>
              )}

              {/* Código */}
              <th
                style={{ width: `${columnWidths.code}px`, minWidth: `${columnWidths.code}px` }}
                className="py-1 px-2.5 relative border-r border-black/60"
              >
                <span>Código</span>
                {renderResizeHandle('code')}
              </th>

              {/* Nombre (Ordenable) */}
              <th
                style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}
                className="py-1 px-2.5 relative border-r border-black/60 group cursor-pointer hover:bg-lilac-50"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('name', context)
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Producto / Nombre</span>
                  {renderSortIcon('name')}
                </div>
                {renderResizeHandle('name')}
              </th>

              {/* Tipo de Producto (Oculto en modal emergente) */}
              {showTypeCol && (
                <th
                  style={{ width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }}
                  className="py-1 px-2.5 relative border-r border-black/60"
                >
                  <span>Tipo / Variación</span>
                  {renderResizeHandle('type')}
                </th>
              )}

              {/* Categoría */}
              <th
                style={{ width: `${columnWidths.category}px`, minWidth: `${columnWidths.category}px` }}
                className="py-1 px-2.5 relative border-r border-black/60"
              >
                <span>Categoría</span>
                {renderResizeHandle('category')}
              </th>

              {/* Precio (Ordenable) */}
              <th
                style={{ width: `${columnWidths.price}px`, minWidth: `${columnWidths.price}px` }}
                className="py-1 px-2.5 relative border-r border-black/60 group cursor-pointer hover:bg-lilac-50 text-right"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('sale_price', context)
                }}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Precio</span>
                  {renderSortIcon('sale_price')}
                </div>
                {renderResizeHandle('price')}
              </th>

              {/* Existencia (Ordenable) */}
              <th
                style={{ width: `${columnWidths.stock}px`, minWidth: `${columnWidths.stock}px` }}
                className="py-1 px-2.5 relative border-r border-black/60 group cursor-pointer hover:bg-lilac-50 text-right"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('stock', context)
                }}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Stock</span>
                  {renderSortIcon('stock')}
                </div>
                {renderResizeHandle('stock')}
              </th>

              {/* Acciones */}
              {showActions && (
                <th
                  style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px` }}
                  className="py-1 px-2 text-center relative border-r border-black/60"
                >
                  <span>Acciones</span>
                  {renderResizeHandle('actions')}
                </th>
              )}

              {/* Columna de relleno elástica (absorbe el espacio sobrante en pantallas anchas sin alterar las demás) */}
              <th className="p-0 border-0 pointer-events-none" />
            </tr>
          </thead>

          <tbody className={`divide-y divide-black/60 ${isModal ? 'text-sm' : 'text-xs'}`}>
            {isLoading ? (
              <tr>
                <td colSpan={(showActions ? 6 : 5) + (showTypeCol ? 1 : 0) + (enableMultiSelect ? 1 : 0) + 1} className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-lilac-600" />
                  Buscando en catálogo...
                </td>
              </tr>
            ) : visibleProducts.length === 0 ? (
              <tr>
                <td colSpan={(showActions ? 6 : 5) + (showTypeCol ? 1 : 0) + (enableMultiSelect ? 1 : 0) + 1} className="py-12 text-center text-slate-400">
                  {searchQuery.trim() ? (
                    <span>No se encontraron productos coincidentes para "{searchQuery}".</span>
                  ) : context === 'modal' && !config.modalAutoLoad ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                      <Search className="w-6 h-6 text-lilac-400" />
                      <span className="text-slate-700 font-bold text-xs">Escribe en el buscador para ver productos</span>
                      <span className="text-slate-400 text-[11px]">Carga automática desactivada para mayor velocidad en equipos de bajos recursos.</span>
                    </div>
                  ) : context === 'catalog' && !config.catalogAutoLoad ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <Boxes className="w-7 h-7 text-lilac-400" />
                      <span className="text-slate-800 font-bold text-xs">Carga automática desactivada</span>
                      <span className="text-slate-500 text-[11px] max-w-sm">Escribe un término en el buscador, filtra por categoría o presiona el botón para cargar los productos.</span>
                      <button
                        type="button"
                        onClick={() => fetchProducts(undefined, 'catalog')}
                        className="mt-1 px-4 py-1.5 bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Cargar productos ahora</span>
                      </button>
                    </div>
                  ) : (
                    <span>No se encontraron productos coincidentes.</span>
                  )}
                </td>
              </tr>
            ) : (
              visibleProducts.map((p, idx) => {
                const isSelected = selectedProductCode === p.code
                const isChecked = p.id ? selectedIds?.has(p.id) : false
                const isLowStock = p.stock <= p.min_stock
                const isVariable = p.product_type === 'variable'
                const isVariation = p.product_type === 'variation'
                const isCollapsed = isVariable && p.id ? collapsedParentIds.has(p.id) : false
                const isHighlighted = highlightedIndex === idx
                const rowPadding = isModal ? 'py-1 px-2.5' : 'py-0.5 px-2'

                return (
                  <tr
                    key={p.id || p.code || Math.random()}
                    ref={(el) => {
                      rowRefs.current[idx] = el
                    }}
                    onClick={() => {
                      setHighlightedIndex(idx)
                    }}
                    onDoubleClick={() => {
                      if (context === 'modal' || onSelectProduct) {
                        onSelectProduct?.(p)
                      } else if (onEditProduct) {
                        onEditProduct(p)
                      }
                    }}
                    className={`transition-colors cursor-pointer border-b border-black/60 ${
                      isHighlighted
                        ? 'product-row-highlighted bg-lilac-200/95 text-lilac-950 font-bold'
                        : isChecked
                        ? 'bg-lilac-100/70 font-semibold'
                        : isSelected
                        ? 'bg-lilac-100 font-semibold'
                        : isVariable
                        ? 'bg-slate-50/80 hover:bg-slate-100/90'
                        : isVariation
                        ? 'bg-white hover:bg-lilac-50/70'
                        : 'hover:bg-lilac-50/70'
                    }`}
                  >
                    {enableMultiSelect && (
                      <td
                        className="p-0 text-center border-r border-black/60 cursor-pointer select-none"
                        onClick={(e) => {
                          e.stopPropagation()
                          if ((e.target as HTMLElement).tagName !== 'INPUT') {
                            if (isVariable) {
                              handleToggleParentCheckbox(p)
                            } else {
                              onToggleSelect?.(p)
                            }
                          }
                        }}
                      >
                        <div className={`w-full h-full flex items-center justify-center ${rowPadding}`}>
                          <input
                            type="checkbox"
                            checked={isChecked || false}
                            onChange={() => {
                              if (isVariable) {
                                handleToggleParentCheckbox(p)
                              } else {
                                onToggleSelect?.(p)
                              }
                            }}
                            className="w-4 h-4 rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer accent-lilac-600"
                          />
                        </div>
                      </td>
                    )}
                    {/* Código */}
                    <td className={`${rowPadding} font-mono text-slate-700 truncate border-r border-black/60`}>
                      {p.code ? (
                        p.code
                      ) : (
                        <span className="text-slate-400 italic">Padre</span>
                      )}
                    </td>

                    {/* Nombre con sangría y botón expandir/colapsar */}
                    <td className={`${rowPadding} text-slate-900 font-medium truncate border-r border-black/60`} title={p.name}>
                      <div className="flex items-center gap-1.5 truncate">
                        {isVariable && p.id && (
                          <button
                            type="button"
                            onClick={(e) => toggleParentCollapse(p.id!, e)}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
                            title={isCollapsed ? 'Desplegar variaciones' : 'Colapsar variaciones'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-lilac-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-lilac-600" />
                            )}
                          </button>
                        )}
                        {isVariation && (
                          <span className="pl-3 text-slate-300 flex items-center shrink-0">
                            <CornerDownRight className="w-3.5 h-3.5 text-lilac-400" />
                          </span>
                        )}
                        <span className={`truncate ${isVariable ? 'font-bold text-slate-900' : isVariation ? 'text-slate-800' : ''}`}>
                          {p.name}
                        </span>
                      </div>
                    </td>

                    {/* Tipo / Variación (solo si no es modal) */}
                    {showTypeCol && (
                      <td className={`${rowPadding} text-slate-600 truncate border-r border-black/60`}>
                        {isVariable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-md">
                            <GitBranch className="w-3 h-3 text-lilac-500" />
                            <span>Variable ({p.variations_count || 0})</span>
                          </span>
                        ) : isVariation ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            <span>
                              {p.attribute_name ? `${p.attribute_name}: ` : ''}
                              {p.attribute_value || 'Variación'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Simple</span>
                          </span>
                        )}
                      </td>
                    )}

                    {/* Categoría */}
                    <td className={`${rowPadding} text-slate-600 truncate border-r border-black/60`} title={p.category_display || p.category_name || 'Sin categoría'}>
                      {p.category_display ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-full">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{p.category_display}</span>
                        </span>
                      ) : p.category_name ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-full">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {p.parent_category_name ? `${p.parent_category_name} / ` : ''}
                            {p.category_name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Sin categoría</span>
                      )}
                    </td>

                    {/* Precio */}
                    <td className={`${rowPadding} text-right font-semibold text-slate-800 border-r border-black/60`}>
                      {isVariable ? (
                        <span className="text-slate-400 font-normal italic">—</span>
                      ) : (
                        formatCLP(p.sale_price)
                      )}
                    </td>

                    {/* Existencia / Stock */}
                    <td className={`${rowPadding} text-right border-r border-black/60`}>
                      {isVariable ? (
                        <span className="text-slate-400 italic">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            p.stock <= 0
                              ? 'text-rose-600'
                              : isLowStock
                              ? 'text-amber-600'
                              : 'text-slate-800'
                          }`}
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          <span>{p.stock}</span>
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    {showActions && (
                      <td className={`${rowPadding} text-center border-r border-black/60`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {onEditProduct && (
                            <button
                              onClick={() => onEditProduct(p)}
                              className="px-2 py-0.5 text-[11px] text-lilac-700 bg-lilac-50 hover:bg-lilac-100 rounded font-medium transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          )}
                          {onDeleteProduct && (
                            <button
                              onClick={() => onDeleteProduct(p)}
                              className="px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 rounded font-medium transition-colors cursor-pointer"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Celda de relleno elástica */}
                    <td className="p-0 border-0 pointer-events-none" />
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Infinite scroll sentinel & status indicators */}
        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <div className="inline-flex items-center justify-center gap-2 py-2 px-4 bg-white/90 rounded-full border border-lilac-200 text-xs font-semibold text-lilac-700 shadow-sm animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-lilac-600" />
              <span>Cargando más productos...</span>
            </div>
          )}
          {!hasMore && products.length > 0 && (
            <div className="text-[11px] text-slate-400 font-medium py-1">
              Has llegado al final del catálogo • {products.length} productos mostrados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
