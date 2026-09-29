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
  X
} from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { ProductSearch } from '../components/ProductSearch'
import { ProductFormModal } from '../components/ProductFormModal'
import { CategoryModal } from '../components/CategoryModal'
import { ExcelImportModal } from '../components/ExcelImportModal'
import { BulkCategoryModal } from '../components/BulkCategoryModal'
import { BulkGroupVariableModal } from '../components/BulkGroupVariableModal'

export const CatalogView: React.FC = () => {
  const {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
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
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false)
  const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadMetadata()
    fetchProducts()
  }, [loadMetadata, fetchProducts])

  const handleOpenNewProduct = (): void => {
    setSelectedProductForEdit(null)
    setIsProductModalOpen(true)
  }

  const handleEditProduct = (product: ProductSearchResult): void => {
    setSelectedProductForEdit(product)
    setIsProductModalOpen(true)
  }

  const handleDeleteProduct = async (product: ProductSearchResult): Promise<void> => {
    const isVariable = product.product_type === 'variable'
    const promptMsg = isVariable
      ? `¿Estás seguro de eliminar el producto variable "${product.name}"?\n\nSe eliminarán lógicamente (soft delete) tanto el producto principal como todas sus variaciones asociadas.`
      : `¿Estás seguro de eliminar el producto "${product.name}" (${product.code || 'sin código'})?\n\nSe realizará un soft delete (se mantendrá en el historial pero no estará disponible para nuevas ventas).`

    if (confirm(promptMsg)) {
      await deleteProduct(product.id || product.code!)
    }
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

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedProductIds.size === 0) return
    const count = selectedProductIds.size
    const promptMsg = `¿Estás seguro de eliminar los ${count} productos seleccionados?\n\nSe realizará un soft delete (se mantendrán en el historial y kardex, pero no estarán disponibles para ventas). Si seleccionaste productos variables padre, también se desactivarán sus variaciones.`

    if (confirm(promptMsg)) {
      await bulkDeleteProducts(Array.from(selectedProductIds))
      setSelectedProductIds(new Set())
    }
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
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-emerald-200/60"
            title="Importar catálogo masivo desde archivo Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importar Excel</span>
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
                  {c.parent_id !== null ? `↳ ${c.name}` : c.name}
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
              title="Asignar Departamento / Subcategoría a los productos seleccionados"
            >
              <FolderInput className="w-3.5 h-3.5 text-lilac-600" />
              <span>Mover a Categoría...</span>
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
          onSelectAllVisible={handleSelectAllVisible}
          isAllVisibleSelected={isAllVisibleSelected}
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

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
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
    </div>
  )
}
