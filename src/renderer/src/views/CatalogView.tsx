import React, { useState, useEffect } from 'react'
import { Plus, Layers, Filter, RefreshCw, Sparkles, Box } from 'lucide-react'
import { ProductSearchResult, ProductType } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { ProductSearch } from '../components/ProductSearch'
import { ProductFormModal } from '../components/ProductFormModal'
import { CategoryModal } from '../components/CategoryModal'

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
    seedSampleData
  } = useCatalogStore()

  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductSearchResult | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

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
              onChange={(e) => setSelectedProductType(e.target.value as ProductType | 'all')}
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los tipos</option>
              <option value="simple">Solo Simples</option>
              <option value="variable">Solo Variables (Padres)</option>
              <option value="variation">Solo Variaciones</option>
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

      {/* Main Content: Reusable ProductSearch Table */}
      <div className="flex-1 overflow-hidden">
        <ProductSearch
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          showActions={true}
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
    </div>
  )
}
