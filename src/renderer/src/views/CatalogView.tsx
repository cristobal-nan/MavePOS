import React, { useState, useEffect } from 'react'
import {
  Plus,
  Layers,
  Filter,
  RefreshCw,
  Sparkles,
  Box,
  FileSpreadsheet,
  FolderInput,
  GitBranch,
  Trash2,
  X,
  Truck,
  Download,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { ProductSearch } from '../components/ProductSearch'
import { ProductFormModal } from '../components/ProductFormModal'
import { CategoryModal } from '../components/CategoryModal'
import { SupplierModal } from '../components/SupplierModal'
import { ExcelUnifiedModal } from '../components/ExcelUnifiedModal'
import { BulkCategoryModal } from '../components/BulkCategoryModal'
import { BulkGroupVariableModal } from '../components/BulkGroupVariableModal'
import { useModalStack } from '../utils/modalStack'

export const CatalogView: React.FC = () => {
  const {
    products,
    categories,
    suppliers,
    selectedCategory,
    setSelectedCategory,
    selectedSupplier,
    setSelectedSupplier,
    selectedProductType,
    setSelectedProductType,
    loadMetadata,
    fetchProducts,
    deleteProduct,
    bulkDeleteProducts,
    seedSampleData
  } = useCatalogStore()

  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductSearchResult | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false)
  const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{ filePath: string; totalExported: number } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Modales de confirmación para eliminar productos
  const [productToDelete, setProductToDelete] = useState<ProductSearchResult | null>(null)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)

  const { handleBackdropClick: handleBackdropDeleteSingle } = useModalStack({
    id: 'catalog-delete-single-modal',
    isOpen: !!productToDelete,
    onClose: () => setProductToDelete(null),
    closeOnBackdrop: true
  })

  const { handleBackdropClick: handleBackdropDeleteBulk } = useModalStack({
    id: 'catalog-delete-bulk-modal',
    isOpen: isBulkDeleteModalOpen,
    onClose: () => setIsBulkDeleteModalOpen(false),
    closeOnBackdrop: true
  })

  useEffect(() => {
    setSelectedProductType('all')
    loadMetadata()
    fetchProducts()
  }, [setSelectedProductType, loadMetadata, fetchProducts])

  const handleExportExcel = async (): Promise<void> => {
    setIsExporting(true)
    setExportSuccessInfo(null)
    setExportError(null)
    try {
      const prefix = await window.api.getSetting('excel_export_prefix', 'Productos')
      const res = await window.api.exportExcel(prefix || 'Productos')
      if (res && res.filePath) {
        setExportSuccessInfo(res)
      }
    } catch (err: any) {
      console.error('Error exportando Excel:', err)
      setExportError(err.message || 'Error al exportar catálogo')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportSelected = async (): Promise<void> => {
    if (selectedProductIds.size === 0) return
    setIsExporting(true)
    setExportSuccessInfo(null)
    setExportError(null)
    try {
      const prefix = await window.api.getSetting('excel_export_prefix', 'Productos')
      const ids = Array.from(selectedProductIds)
      const res = await window.api.exportExcel(prefix || 'Productos', ids)
      if (res && res.filePath) {
        setExportSuccessInfo(res)
      }
    } catch (err: any) {
      console.error('Error exportando productos seleccionados:', err)
      setExportError(err.message || 'Error al exportar productos seleccionados')
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenNewProduct = (): void => {
    setSelectedProductForEdit(null)
    setIsProductModalOpen(true)
  }

  const handleEditProduct = (product: ProductSearchResult): void => {
    setSelectedProductForEdit(product)
    setIsProductModalOpen(true)
  }

  const handleDeleteProduct = (product: ProductSearchResult): void => {
    setProductToDelete(product)
  }

  const handleConfirmDeleteProduct = async (): Promise<void> => {
    if (!productToDelete) return
    const p = productToDelete
    setProductToDelete(null)
    await deleteProduct(p.id || p.code!)
  }

  const handleToggleSelect = (product: ProductSearchResult): void => {
    if (!product.id) return
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(product.id!)) {
        next.delete(product.id!)
      } else {
        next.add(product.id!)
      }
      return next
    })
  }

  const handleToggleParentWithVariations = (
    parent: ProductSearchResult,
    variations: ProductSearchResult[]
  ): void => {
    const parentId = parent.id
    if (!parentId) return

    const variationIds = variations.map((v) => v.id).filter((id): id is number => typeof id === 'number')
    const allIds = [parentId, ...variationIds]
    const allSelected = allIds.every((id) => selectedProductIds.has(id))

    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        allIds.forEach((id) => next.delete(id))
      } else {
        allIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleSelectAllVisible = (): void => {
    const visibleIds = products.map((p) => p.id).filter((id): id is number => typeof id === 'number')
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.has(id))

    if (allSelected) {
      setSelectedProductIds(new Set())
    } else {
      setSelectedProductIds(new Set(visibleIds))
    }
  }

  const handleDeselectAll = (): void => {
    setSelectedProductIds(new Set())
  }

  const handleBulkDelete = (): void => {
    if (selectedProductIds.size === 0) return
    setIsBulkDeleteModalOpen(true)
  }

  const handleConfirmBulkDelete = async (): Promise<void> => {
    setIsBulkDeleteModalOpen(false)
    if (selectedProductIds.size === 0) return
    await bulkDeleteProducts(Array.from(selectedProductIds))
    setSelectedProductIds(new Set())
  }

  const selectedProductsList = products.filter((p) => p.id && selectedProductIds.has(p.id))
  const isAllVisibleSelected = products.length > 0 && products.every((p) => p.id && selectedProductIds.has(p.id))

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 p-4 gap-3 select-none overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-lilac-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Create & Manage Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewProduct}
            className="px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-lilac-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-lilac-50 text-slate-700 hover:text-lilac-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-200/60"
          >
            <Layers className="w-3.5 h-3.5 text-lilac-600" />
            <span>Categorías</span>
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-lilac-50 text-slate-700 hover:text-lilac-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-200/60"
          >
            <Truck className="w-3.5 h-3.5 text-lilac-600" />
            <span>Proveedores</span>
          </button>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-emerald-200/60"
            title="Importar o exportar productos en formato Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importar / Exportar</span>
          </button>

          {products.length === 0 && (
            <button
              onClick={() => seedSampleData()}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 animate-pulse"
              title="Carga el catálogo de muestra con departamentos, subcategorías, productos simples y variables con variaciones"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cargar datos de prueba</span>
            </button>
          )}
        </div>

        {/* Right: Filters & Refresh */}
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <Truck className="w-3 h-3 text-slate-400" />
            <select
              value={selectedSupplier || ''}
              onChange={(e) => setSelectedSupplier(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <Box className="w-3 h-3 text-slate-400" />
            <select
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value as any)}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="sellable">Productos vendibles (Simples y Variaciones)</option>
              <option value="simple">Solo Simples</option>
              <option value="variation">Solo Variaciones</option>
              <option value="variable">Solo Variables (Padres)</option>
              <option value="all">Ver todo el catálogo (incluyendo padres)</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchProducts()}
            title="Recargar catálogo"
            className="p-2 text-slate-400 hover:text-lilac-600 hover:bg-lilac-50 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Export Success Notification Banner */}
      {exportSuccessInfo && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ¡Catálogo exportado con éxito! Se exportaron{' '}
              <strong>{exportSuccessInfo.totalExported} productos</strong> en{' '}
              <code className="bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px] font-mono">
                {exportSuccessInfo.filePath}
              </code>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.api.openContainingFolder(exportSuccessInfo.filePath)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <FolderInput className="w-3 h-3 text-emerald-600" />
              <span>Abrir carpeta</span>
            </button>
            <button
              type="button"
              onClick={() => setExportSuccessInfo(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Export Error Notification Banner */}
      {exportError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bulk Selection Floating Action Bar */}
      {selectedProductIds.size > 0 && (
        <div className="bg-lilac-600 text-white px-4 py-2.5 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-white/20 px-2.5 py-1 rounded-full text-white font-extrabold">
              {selectedProductIds.size}
            </span>
            <span>producto(s) seleccionado(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkCategoryModalOpen(true)}
              className="px-3 py-1.5 bg-white text-lilac-800 hover:bg-lilac-50 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              title="Asignar Categoría y/o Proveedores a los productos seleccionados"
            >
              <FolderInput className="w-3.5 h-3.5 text-lilac-600" />
              <span>Categoría y Proveedores...</span>
            </button>

            <button
              onClick={() => setIsBulkGroupModalOpen(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20"
              title="Agrupar productos seleccionados bajo un producto variable con variaciones"
            >
              <GitBranch className="w-3.5 h-3.5 text-lilac-200" />
              <span>Agrupar como Variable...</span>
            </button>

            <button
              onClick={handleExportSelected}
              disabled={isExporting}
              className="px-3 py-1.5 bg-emerald-500/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Exportar únicamente los productos seleccionados a un archivo Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exportando...' : 'Exportar Seleccionados'}</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Eliminar (soft delete) los productos seleccionados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>

            <div className="h-4 w-px bg-white/20 mx-1" />

            <button
              onClick={handleDeselectAll}
              className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
              title="Deseleccionar todos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Reusable ProductSearch Table with multi-select */}
      <div className="flex-1 overflow-hidden">
        <ProductSearch
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          showActions={true}
          enableMultiSelect={true}
          selectedIds={selectedProductIds}
          onToggleSelect={handleToggleSelect}
          onToggleParentWithVariations={handleToggleParentWithVariations}
          onSelectAllVisible={handleSelectAllVisible}
          isAllVisibleSelected={isAllVisibleSelected}
          context="catalog"
        />
      </div>

      {/* Modals */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        product={selectedProductForEdit}
        onClose={() => setIsProductModalOpen(false)}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
      />

      <ExcelUnifiedModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        selectedCount={selectedProductIds.size}
        onExportAll={handleExportExcel}
        onExportSelected={handleExportSelected}
        isExporting={isExporting}
        exportSuccessInfo={exportSuccessInfo}
        exportError={exportError}
        onClearExportFeedback={() => {
          setExportSuccessInfo(null)
          setExportError(null)
        }}
        onSuccess={() => {
          loadMetadata()
          fetchProducts()
        }}
      />

      <BulkCategoryModal
        isOpen={isBulkCategoryModalOpen}
        selectedProducts={selectedProductsList}
        onClose={() => setIsBulkCategoryModalOpen(false)}
        onSuccess={() => {
          setSelectedProductIds(new Set())
          fetchProducts()
          loadMetadata()
        }}
      />

      <BulkGroupVariableModal
        isOpen={isBulkGroupModalOpen}
        selectedProducts={selectedProductsList}
        onClose={() => setIsBulkGroupModalOpen(false)}
        onSuccess={() => {
          setSelectedProductIds(new Set())
          fetchProducts()
          loadMetadata()
        }}
      />
      {/* Modal de confirmación para eliminar un producto individual */}
      {productToDelete && (
        <div
          onClick={handleBackdropDeleteSingle}
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {productToDelete.product_type === 'variable'
                      ? '¿Eliminar producto variable?'
                      : '¿Eliminar producto?'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {productToDelete.code || 'Sin código'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                <span className="font-bold text-rose-900">
                  {productToDelete.name}
                </span>
                <span className="text-rose-700 text-[11px]">
                  {productToDelete.product_type === 'variable'
                    ? 'Se desactivarán tanto el producto padre como todas sus variaciones asociadas.'
                    : 'Se realizará un soft delete (se mantendrá en el historial/kardex pero no estará en ventas).'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Confirmas que deseas desactivar este producto del catálogo activo?
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar (Esc)
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminación masiva */}
      {isBulkDeleteModalOpen && (
        <div
          onClick={handleBackdropDeleteBulk}
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Eliminar productos seleccionados
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedProductIds.size} producto(s) marcados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                <span className="font-bold text-rose-900">
                  ¿Estás seguro de eliminar los {selectedProductIds.size} productos seleccionados?
                </span>
                <span className="text-rose-700 text-[11px]">
                  Se realizará un soft delete (se mantendrán en kardex/historial, pero no en ventas). Si incluiste productos padre, también se desactivarán sus variaciones.
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta acción afectará a todos los productos actualmente seleccionados en la lista.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar (Esc)
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar {selectedProductIds.size} productos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
