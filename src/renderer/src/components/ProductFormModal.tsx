import React, { useState, useEffect } from 'react'
import {
  X,
  Save,
  Package,
  Layers,
  DollarSign,
  Boxes,
  GitBranch,
  Plus,
  Trash2
} from 'lucide-react'
import { ProductInput, ProductSearchResult, ProductType } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { parseCLP } from '../utils/formatters'

interface VariationRow {
  id?: number
  attributeValue: string
  code: string
  salePrice: string
  costPrice: string
  stock: string
  minStock: string
}

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
  const { categories, saveProduct, saveVariableProduct, getVariations } = useCatalogStore()

  const [productType, setProductType] = useState<ProductType>('simple')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [selectedDeptoId, setSelectedDeptoId] = useState<number | null>(null)
  const [selectedSubcatId, setSelectedSubcatId] = useState<number | null>(null)
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('5')

  // Variable product fields
  const [attributeName, setAttributeName] = useState('Color')
  const [variations, setVariations] = useState<VariationRow[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Categorías de nivel 1 (Departamentos)
  const departments = categories.filter((c) => c.parent_id === null)
  // Subcategorías del departamento seleccionado
  const subcategories = categories.filter((c) => c.parent_id === selectedDeptoId)

  useEffect(() => {
    if (product) {
      setProductType(product.product_type || 'simple')
      setCode(product.code || '')
      setName(product.name)
      setSalePrice(product.sale_price ? product.sale_price.toLocaleString('es-CL') : '')
      setCostPrice(product.cost_price ? product.cost_price.toLocaleString('es-CL') : '')
      setAttributeName(product.attribute_name || 'Color')
      setStock(product.stock !== undefined ? product.stock.toString() : '0')
      setMinStock(product.min_stock !== undefined ? product.min_stock.toString() : '5')

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

      // If variable product, fetch its variations
      if (product.product_type === 'variable' && product.id) {
        getVariations(product.id).then((vars) => {
          setVariations(
            vars.map((v) => ({
              id: v.id,
              attributeValue: v.attribute_value || '',
              code: v.code || '',
              salePrice: v.sale_price ? v.sale_price.toLocaleString('es-CL') : '',
              costPrice: v.cost_price ? v.cost_price.toLocaleString('es-CL') : '',
              stock: v.stock.toString(),
              minStock: v.min_stock.toString()
            }))
          )
        })
      } else {
        setVariations([])
      }
    } else {
      // Clear form for new product
      setProductType('simple')
      setCode('')
      setName('')
      setSalePrice('')
      setCostPrice('')
      setSelectedDeptoId(null)
      setSelectedSubcatId(null)
      setAttributeName('Color')
      setStock('0')
      setMinStock('5')
      setVariations([
        {
          attributeValue: '',
          code: '',
          salePrice: '',
          costPrice: '',
          stock: '0',
          minStock: '5'
        }
      ])
    }
    setError(null)
  }, [product, categories, isOpen, getVariations])

  if (!isOpen) return null

  const handleDeptoChange = (id: number | null): void => {
    setSelectedDeptoId(id)
    setSelectedSubcatId(null)
  }

  const handleAddVariation = (): void => {
    setVariations([
      ...variations,
      {
        attributeValue: '',
        code: '',
        salePrice: salePrice || '',
        costPrice: costPrice || '',
        stock: '0',
        minStock: '5'
      }
    ])
  }

  const handleRemoveVariation = (index: number): void => {
    setVariations(variations.filter((_, i) => i !== index))
  }

  const handleVariationChange = (index: number, field: keyof VariationRow, value: string): void => {
    const updated = [...variations]
    updated[index] = { ...updated[index], [field]: value }
    setVariations(updated)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }

    const finalCategoryId = selectedSubcatId || selectedDeptoId || null

    if (productType === 'simple') {
      if (!code.trim()) {
        setError('El código de barras / SKU es obligatorio para productos simples.')
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

      const input: ProductInput = {
        id: product?.id,
        code: code.trim(),
        name: name.trim(),
        product_type: 'simple',
        sale_price: parsedSalePrice,
        cost_price: parsedCostPrice,
        category_id: finalCategoryId,
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
    } else {
      // Variable Product with variations
      if (variations.length === 0) {
        setError('Un producto variable debe tener al menos una variación.')
        return
      }

      // Validate each variation row
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]
        if (!v.attributeValue.trim()) {
          setError(`La variación #${i + 1} requiere un valor de atributo (ej: "Negro", "Azul").`)
          return
        }
        if (!v.code.trim()) {
          setError(`La variación "${v.attributeValue}" requiere un código de barras / SKU único.`)
          return
        }
        const vPrice = parseCLP(v.salePrice)
        if (vPrice <= 0) {
          setError(`El precio de venta de la variación "${v.attributeValue}" debe ser mayor a 0.`)
          return
        }
      }

      const parentInput: ProductInput = {
        id: product?.id,
        name: name.trim(),
        product_type: 'variable',
        category_id: finalCategoryId,
        attribute_name: attributeName.trim() || 'Color',
        sale_price: 0,
        stock: 0
      }

      const variationsInput: ProductInput[] = variations.map((v) => ({
        id: v.id,
        code: v.code.trim(),
        name: `${name.trim()} ${v.attributeValue.trim()}`,
        product_type: 'variation',
        attribute_name: attributeName.trim() || 'Color',
        attribute_value: v.attributeValue.trim(),
        sale_price: parseCLP(v.salePrice),
        cost_price: v.costPrice.trim() ? parseCLP(v.costPrice) : null,
        stock: parseInt(v.stock, 10) || 0,
        min_stock: parseInt(v.minStock, 10) || 0,
        category_id: finalCategoryId
      }))

      setIsSubmitting(true)
      try {
        await saveVariableProduct(parentInput, variationsInput)
        onClose()
      } catch (err: any) {
        console.error('Error guardando producto variable:', err)
        setError(err.message || 'Error al guardar producto variable.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
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

          {/* Selector de Tipo (Simple vs Variable) - Solo editable al crear nuevo */}
          {!product && (
            <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setProductType('simple')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  productType === 'simple'
                    ? 'bg-white text-lilac-700 shadow-sm border border-lilac-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Producto Simple (SKU único)</span>
              </button>
              <button
                type="button"
                onClick={() => setProductType('variable')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  productType === 'variable'
                    ? 'bg-white text-lilac-700 shadow-sm border border-lilac-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Producto Variable (con Variaciones)</span>
              </button>
            </div>
          )}

          {/* Nombre General y Categorías */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {productType === 'variable' ? 'Nombre General del Producto *' : 'Nombre del Producto *'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={productType === 'variable' ? 'Ej: Algodón Rústico' : 'Ej: Crochet Aluminio 4.0mm'}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
              />
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
          </div>

          {/* VISTA ESPECÍFICA: PRODUCTO SIMPLE */}
          {productType === 'simple' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Código */}
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
            </div>
          )}

          {/* VISTA ESPECÍFICA: PRODUCTO VARIABLE (CON TABLA DE VARIACIONES) */}
          {productType === 'variable' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="w-1/2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre del Atributo de Variación
                  </label>
                  <input
                    type="text"
                    value={attributeName}
                    onChange={(e) => setAttributeName(e.target.value)}
                    placeholder="Ej: Color, Talla, Grosor"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddVariation}
                  className="px-3 py-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Variación</span>
                </button>
              </div>

              {/* Tabla de Variaciones */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Valor ({attributeName || 'Atributo'}) *</th>
                      <th className="p-2.5">Código / SKU *</th>
                      <th className="p-2.5">Precio Venta (CLP) *</th>
                      <th className="p-2.5">Stock *</th>
                      <th className="p-2.5">Mínimo</th>
                      <th className="p-2.5 text-center w-12">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {variations.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.attributeValue}
                            onChange={(e) => handleVariationChange(idx, 'attributeValue', e.target.value)}
                            placeholder="Ej: Negro, Azul"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-lilac-500 font-medium"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.code}
                            onChange={(e) => handleVariationChange(idx, 'code', e.target.value)}
                            placeholder="Ej: 7801001"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-lilac-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={v.salePrice}
                            onChange={(e) => {
                              const val = parseCLP(e.target.value)
                              handleVariationChange(
                                idx,
                                'salePrice',
                                val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL')
                              )
                            }}
                            placeholder="0"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-bold focus:outline-none focus:border-lilac-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={v.stock}
                            onChange={(e) => handleVariationChange(idx, 'stock', e.target.value)}
                            min="0"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-lilac-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={v.minStock}
                            onChange={(e) => handleVariationChange(idx, 'minStock', e.target.value)}
                            min="0"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-lilac-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariation(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Eliminar variación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
