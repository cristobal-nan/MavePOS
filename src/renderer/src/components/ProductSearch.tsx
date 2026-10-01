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
  RefreshCw
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
  onSelectAllVisible,
  isAllVisibleSelected = false,
  context = 'catalog'
}) => {
  const {
    products,
    searchQuery,
    setSearchQuery,
    orderBy,
    orderDir,
    toggleSort,
    columnWidths: catalogColumnWidths,
    modalColumnWidths,
    setColumnWidth,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreProducts
  } = useCatalogStore()

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
          loadMoreProducts()
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
  }, [hasMore, isLoading, isLoadingMore, loadMoreProducts])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreProducts()
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

  const totalColumnsWidth =
    (enableMultiSelect ? 40 : 0) +
    columnWidths.code +
    columnWidths.name +
    columnWidths.type +
    columnWidths.category +
    columnWidths.price +
    columnWidths.stock +
    (showActions ? columnWidths.actions : 0)

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-2xl border border-lilac-100 shadow-sm overflow-hidden select-none">
      {/* Search Input Bar */}
      <div className="p-3 border-b border-lilac-100 bg-white flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
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
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-auto bg-slate-50/50">
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
            <col style={{ width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }} />
            <col style={{ width: `${columnWidths.category}px`, minWidth: `${columnWidths.category}px` }} />
            <col style={{ width: `${columnWidths.price}px`, minWidth: `${columnWidths.price}px` }} />
            <col style={{ width: `${columnWidths.stock}px`, minWidth: `${columnWidths.stock}px` }} />
            {showActions && <col style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px` }} />}
            <col style={{ width: 'auto' }} />
          </colgroup>
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
            <tr>
              {enableMultiSelect && (
                <th style={{ width: '40px', minWidth: '40px' }} className="py-2.5 px-3 text-center border-r border-slate-200/60">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected && products.length > 0}
                    onChange={onSelectAllVisible}
                    className="w-3.5 h-3.5 rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer accent-lilac-600"
                    title="Seleccionar / deseleccionar todos los visibles"
                  />
                </th>
              )}

              {/* Código */}
              <th
                style={{ width: `${columnWidths.code}px`, minWidth: `${columnWidths.code}px` }}
                className="py-2.5 px-3 relative border-r border-slate-200/60"
              >
                <span>Código</span>
                {renderResizeHandle('code')}
              </th>

              {/* Nombre (Ordenable) */}
              <th
                style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}
                className="py-2.5 px-3 relative border-r border-slate-200/60 group cursor-pointer hover:bg-lilac-50"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('name')
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Producto / Nombre</span>
                  {renderSortIcon('name')}
                </div>
                {renderResizeHandle('name')}
              </th>

              {/* Tipo de Producto */}
              <th
                style={{ width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }}
                className="py-2.5 px-3 relative border-r border-slate-200/60"
              >
                <span>Tipo / Variación</span>
                {renderResizeHandle('type')}
              </th>

              {/* Categoría */}
              <th
                style={{ width: `${columnWidths.category}px`, minWidth: `${columnWidths.category}px` }}
                className="py-2.5 px-3 relative border-r border-slate-200/60"
              >
                <span>Categoría</span>
                {renderResizeHandle('category')}
              </th>

              {/* Precio (Ordenable) */}
              <th
                style={{ width: `${columnWidths.price}px`, minWidth: `${columnWidths.price}px` }}
                className="py-2.5 px-3 relative border-r border-slate-200/60 group cursor-pointer hover:bg-lilac-50 text-right"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('sale_price')
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
                className="py-2.5 px-3 relative border-r border-slate-200/60 group cursor-pointer hover:bg-lilac-50 text-right"
                onClick={() => {
                  if (hasDraggedRef.current) return
                  toggleSort('stock')
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
                  className="py-2.5 px-3 text-center relative border-r border-slate-200/60"
                >
                  <span>Acciones</span>
                  {renderResizeHandle('actions')}
                </th>
              )}

              {/* Columna de relleno elástica (absorbe el espacio sobrante en pantallas anchas sin alterar las demás) */}
              <th className="p-0 border-0 pointer-events-none" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={(showActions ? 7 : 6) + (enableMultiSelect ? 1 : 0) + 1} className="py-12 text-center text-slate-400">
                  Buscando en catálogo...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={(showActions ? 7 : 6) + (enableMultiSelect ? 1 : 0) + 1} className="py-12 text-center text-slate-400">
                  No se encontraron productos coincidentes.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isSelected = selectedProductCode === p.code
                const isChecked = p.id ? selectedIds?.has(p.id) : false
                const isLowStock = p.stock <= p.min_stock
                const isVariable = p.product_type === 'variable'
                const isVariation = p.product_type === 'variation'

                return (
                  <tr
                    key={p.id || p.code || Math.random()}
                    onClick={() => {
                      if (enableMultiSelect && onToggleSelect) {
                        onToggleSelect(p)
                      } else {
                        onSelectProduct?.(p)
                      }
                    }}
                    className={`hover:bg-lilac-50/70 transition-colors cursor-pointer ${
                      isChecked ? 'bg-lilac-100/60 font-semibold' : isSelected ? 'bg-lilac-100 font-semibold' : ''
                    } ${isVariable ? 'bg-slate-50/70' : ''}`}
                  >
                    {enableMultiSelect && (
                      <td
                        className="py-2.5 px-3 text-center border-r border-slate-200/40"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleSelect?.(p)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => onToggleSelect?.(p)}
                          className="w-3.5 h-3.5 rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer accent-lilac-600"
                        />
                      </td>
                    )}
                    {/* Código */}
                    <td className="py-2.5 px-3 font-mono text-slate-700 truncate border-r border-slate-100">
                      {p.code ? (
                        p.code
                      ) : (
                        <span className="text-slate-400 italic">Padre</span>
                      )}
                    </td>

                    {/* Nombre */}
                    <td className="py-2.5 px-3 text-slate-900 font-medium truncate border-r border-slate-100" title={p.name}>
                      <span className="truncate">{p.name}</span>
                    </td>

                    {/* Tipo / Variación */}
                    <td className="py-2.5 px-3 text-slate-600 truncate border-r border-slate-100">
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

                    {/* Categoría */}
                    <td className="py-2.5 px-3 text-slate-600 truncate border-r border-slate-100" title={p.category_display || p.category_name || 'Sin categoría'}>
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
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800 border-r border-slate-100">
                      {isVariable ? (
                        <span className="text-slate-400 font-normal italic">—</span>
                      ) : (
                        formatCLP(p.sale_price)
                      )}
                    </td>

                    {/* Existencia / Stock */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-100">
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
                      <td className="py-2.5 px-3 text-center border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {onEditProduct && (
                            <button
                              onClick={() => onEditProduct(p)}
                              className="px-2 py-1 text-[11px] text-lilac-700 bg-lilac-50 hover:bg-lilac-100 rounded font-medium transition-colors"
                            >
                              Editar
                            </button>
                          )}
                          {onDeleteProduct && (
                            <button
                              onClick={() => onDeleteProduct(p)}
                              className="px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50 rounded font-medium transition-colors"
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
