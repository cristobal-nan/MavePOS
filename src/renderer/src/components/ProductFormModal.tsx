import React, { useState, useEffect } from 'react'
import { X, Save, Package, Layers, Tag, DollarSign, Boxes } from 'lucide-react'
import { ProductInput, ProductSearchResult } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { parseCLP } from '../utils/formatters'

interface ProductFormModalProps {
  product?: ProductSearchResult | null
  isOpen: boolean
  onClose: () => void
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  isOpen,
  onClose
}) => {
  const { categories, families, saveProduct } = useCatalogStore()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [selectedDeptoId, setSelectedDeptoId] = useState<number | null>(null)
  const [selectedSubcatId, setSelectedSubcatId] = useState<number | null>(null)
  const [familyId, setFamilyId] = useState<number | null>(null)
  const [variantLabel, setVariantLabel] = useState('')
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('5')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Categorías de nivel 1 (Departamentos)
  const departments = categories.filter((c) => c.parent_id === null)
  // Subcategorías del departamento seleccionado
  const subcategories = categories.filter((c) => c.parent_id === selectedDeptoId)

  useEffect(() => {
    if (product) {
      setCode(product.code)
      setName(product.name)
      setSalePrice(product.sale_price.toLocaleString('es-CL'))
      setCostPrice(product.cost_price ? product.cost_price.toLocaleString('es-CL') : '')

      // Resolve department vs subcategory
      if (product.category_id) {
        const cat = categories.find((c) => c.id === product.category_id)
        if (cat) {
          if (cat.parent_id !== null) {
            setSelectedDeptoId(cat.parent_id)
            setSelectedSubcatId(cat.id)
          } else {
            setSelectedDeptoId(cat.id)
            setSelectedSubcatId(null)
          }
        }
      } else {
        setSelectedDeptoId(null)
        setSelectedSubcatId(null)
      }

      setFamilyId(product.family_id || null)
      setVariantLabel(product.variant_label || '')
      setStock(product.stock.toString())
      setMinStock(product.min_stock.toString())
    } else {
      // Clear form
      setCode('')
      setName('')
      setSalePrice('')
      setCostPrice('')
      setSelectedDeptoId(null)
      setSelectedSubcatId(null)
      setFamilyId(null)
      setVariantLabel('')
      setStock('0')
      setMinStock('5')
    }
    setError(null)
  }, [product, categories, isOpen])

  if (!isOpen) return null

  const handleDeptoChange = (id: number | null): void => {
    setSelectedDeptoId(id)
    setSelectedSubcatId(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (!code.trim()) {
      setError('El código es obligatorio.')
      return
    }
    if (!name.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }

    const parsedSalePrice = parseCLP(salePrice)
    if (parsedSalePrice <= 0) {
      setError('El precio de venta debe ser un número entero mayor a 0.')
      return
    }

    const parsedCostPrice = costPrice.trim() ? parseCLP(costPrice) : null
    const parsedStock = parseInt(stock, 10) || 0
    const parsedMinStock = parseInt(minStock, 10) || 0

    // Final category_id: if subcat is selected use that, else use department
    const finalCategoryId = selectedSubcatId || selectedDeptoId || null

    const input: ProductInput = {
      code: code.trim(),
      name: name.trim(),
      sale_price: parsedSalePrice,
      cost_price: parsedCostPrice,
      category_id: finalCategoryId,
      family_id: familyId || null,
      variant_label: variantLabel.trim() || null,
      stock: parsedStock,
      min_stock: parsedMinStock
    }

    setIsSubmitting(true)
    try {
      await saveProduct(input)
      onClose()
    } catch (err: any) {
      console.error('Error guardando producto:', err)
      setError(err.message || 'Error al guardar producto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <span>{product ? 'Editar Producto' : 'Nuevo Producto'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Código y Nombre */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código de Barras / SKU *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={Boolean(product)}
                placeholder="Ej: 780123456"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-lilac-500 disabled:opacity-60"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Producto *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Algodón Rústico"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
          </div>

          {/* Precios (Venta y Costo en CLP) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-lilac-50/50 p-4 rounded-xl border border-lilac-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
                <span>Precio de Venta (CLP) *</span>
              </label>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => {
                  const val = parseCLP(e.target.value)
                  setSalePrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                }}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Precio de Costo (CLP opcional)</span>
              </label>
              <input
                type="text"
                value={costPrice}
                onChange={(e) => {
                  const val = parseCLP(e.target.value)
                  setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                }}
                placeholder="Opcional"
                className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
          </div>

          {/* Categoría (Cascada Depto -> Subcategoría de 2 niveles) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-lilac-600" />
                <span>Departamento (Nivel 1)</span>
              </label>
              <select
                value={selectedDeptoId || ''}
                onChange={(e) => handleDeptoChange(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              >
                <option value="">-- Sin departamento --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Subcategoría (Nivel 2)</span>
              </label>
              <select
                value={selectedSubcatId || ''}
                disabled={!selectedDeptoId || subcategories.length === 0}
                onChange={(e) => setSelectedSubcatId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 disabled:opacity-50"
              >
                <option value="">
                  {!selectedDeptoId
                    ? 'Selecciona un departamento primero'
                    : subcategories.length === 0
                    ? 'No tiene subcategorías'
                    : '-- Sin subcategoría --'}
                </option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Familia y Variante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-lilac-600" />
                <span>Familia de Variantes</span>
              </label>
              <select
                value={familyId || ''}
                onChange={(e) => setFamilyId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              >
                <option value="">-- Ninguna (Producto único) --</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Etiqueta de Variante
              </label>
              <input
                type="text"
                value={variantLabel}
                onChange={(e) => setVariantLabel(e.target.value)}
                placeholder="Ej: Azul / 100g / Grueso"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
          </div>

          {/* Stock y Stock Mínimo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-lilac-600" />
                <span>Existencia Actual (Stock)</span>
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min="0"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Inventario Mínimo (Alerta)
              </label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                min="0"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-lilac-600 hover:bg-lilac-700 rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Producto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
