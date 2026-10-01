import React, { useState, useEffect } from 'react'
import { X, GitBranch, CheckCircle2, Layers, Tag, Sparkles, Truck, Plus } from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { formatCLP } from '../utils/formatters'
import { useCatalogStore } from '../store/catalogStore'

interface BulkGroupVariableModalProps {
  isOpen: boolean
  selectedProducts: ProductSearchResult[]
  onClose: () => void
  onSuccess: () => void
}

interface VariationRowState {
  productId: number
  code: string | null
  originalName: string
  attributeValue: string
  salePrice: number
  stock: number
}

function findCommonPrefix(strings: string[]): string {
  if (!strings.length) return ''
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (strings[i].toLowerCase().indexOf(prefix.toLowerCase()) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1)
      if (!prefix) return ''
    }
  }
  return prefix.trim()
}

export const BulkGroupVariableModal: React.FC<BulkGroupVariableModalProps> = ({
  isOpen,
  selectedProducts,
  onClose,
  onSuccess
}) => {
  const { categories, suppliers, saveSupplier, groupProductsAsVariable } = useCatalogStore()

  const [parentName, setParentName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set())
  const [isAddingSupplierInline, setIsAddingSupplierInline] = useState(false)
  const [newInlineSupplierName, setNewInlineSupplierName] = useState('')
  const [attributeName, setAttributeName] = useState('Color')
  const [customAttrInput, setCustomAttrInput] = useState('')
  const [rows, setRows] = useState<VariationRowState[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const COMMON_ATTRIBUTES = ['Color', 'Talla', 'Grosor', 'Medida', 'Diseño', 'Presentación']

  useEffect(() => {
    if (!isOpen || selectedProducts.length === 0) return

    // Calculate common prefix for suggested parent name
    const names = selectedProducts.map((p) => p.name)
    const prefix = findCommonPrefix(names)
    const suggestedParent = prefix || names[0]
    setParentName(suggestedParent)

    // Inherit category from first product if available
    const initialCategory = selectedProducts.find((p) => p.category_id !== null)?.category_id || null
    setCategoryId(initialCategory)

    // Inherit suppliers from selected products
    const initialSuppliers = new Set<number>()
    selectedProducts.forEach((p) => {
      p.supplier_ids?.forEach((id) => initialSuppliers.add(id))
      p.suppliers?.forEach((s) => initialSuppliers.add(s.id))
    })
    setSelectedSupplierIds(initialSuppliers)
    setIsAddingSupplierInline(false)
    setNewInlineSupplierName('')

    // Build row items and infer attribute values
    const initialRows: VariationRowState[] = selectedProducts.map((p) => {
      let inferredValue = ''
      if (suggestedParent && p.name.toLowerCase().startsWith(suggestedParent.toLowerCase())) {
        inferredValue = p.name.substring(suggestedParent.length).trim()
      } else {
        const parts = p.name.trim().split(/\s+/)
        inferredValue = parts[parts.length - 1] || ''
      }

      return {
        productId: p.id!,
        code: p.code,
        originalName: p.name,
        attributeValue: inferredValue,
        salePrice: p.sale_price,
        stock: p.stock
      }
    })

    setRows(initialRows)
    setError(null)
  }, [isOpen])

  const handleAddInlineSupplier = async (): Promise<void> => {
    const trimmed = newInlineSupplierName.trim()
    if (!trimmed) return
    try {
      const newSup = await saveSupplier(trimmed)
      setSelectedSupplierIds((prev) => new Set([...prev, newSup.id]))
      setNewInlineSupplierName('')
      setIsAddingSupplierInline(false)
    } catch (err: any) {
      setError(err.message || 'Error al agregar proveedor.')
    }
  }

  if (!isOpen) return null

  const handleAttributeValueChange = (index: number, val: string): void => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], attributeValue: val }
      return next
    })
  }

  const handleApply = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const trimmedParentName = parentName.trim()
    if (!trimmedParentName) {
      setError('Debes ingresar el nombre del producto variable principal.')
      return
    }

    const currentAttribute = attributeName === 'custom' ? customAttrInput.trim() : attributeName.trim()
    if (!currentAttribute) {
      setError('Debes ingresar el nombre del atributo (ej: Color, Talla).')
      return
    }

    // Check that all variations have attribute values
    const missingAttr = rows.find((r) => !r.attributeValue.trim())
    if (missingAttr) {
      setError(`Falta especificar el valor de "${currentAttribute}" para el producto: ${missingAttr.originalName}`)
      return
    }

    setIsSubmitting(true)
    try {
      await groupProductsAsVariable({
        parentName: trimmedParentName,
        categoryId,
        supplierIds: Array.from(selectedSupplierIds),
        attributeName: currentAttribute,
        items: rows.map((r) => ({
          productId: r.productId,
          attributeValue: r.attributeValue.trim(),
          name: `${trimmedParentName} ${r.attributeValue.trim()}`
        }))
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al agrupar productos como variable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 select-text">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <span>Agrupar como Producto Variable</span>
              <p className="text-xs font-normal text-slate-500">
                Convierte {selectedProducts.length} productos simples en variaciones vendibles de un producto padre
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Notice info */}
          <div className="p-3 bg-lilac-50 border border-lilac-100 rounded-xl flex items-start gap-2 text-xs text-lilac-900">
            <Sparkles className="w-4 h-4 text-lilac-600 shrink-0 mt-0.5" />
            <span>
              <strong>Garantía de inventario:</strong> Cada producto conservará su código de barra propio,
              precio, costo, stock y todos sus movimientos previos en el kardex. Se crearán vinculados como
              variaciones del producto principal.
            </span>
          </div>

          {/* Parent Product Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Parent Name */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-lilac-600" />
                <span>Nombre del Producto Principal (Padre Contenedor) *</span>
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Ej: Algodón Rústico, Lana Merino Gruesa..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-xs text-slate-800 focus:outline-none font-semibold transition-all select-text cursor-text"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-lilac-600" />
                <span>Categoría Compartida</span>
              </label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-lilac-500 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">-- Sin categoría asignada --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Attribute Name Selector & Custom */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Atributo Diferenciador *</span>
                <span className="text-[11px] font-normal text-slate-400">Ej: Color, Talla</span>
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {COMMON_ATTRIBUTES.map((attr) => (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => {
                      setAttributeName(attr)
                      setCustomAttrInput('')
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                      attributeName === attr
                        ? 'bg-lilac-600 border-lilac-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-lilac-50 hover:text-lilac-700'
                    }`}
                  >
                    {attr}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAttributeName('custom')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                    attributeName === 'custom'
                      ? 'bg-lilac-600 border-lilac-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-lilac-50'
                  }`}
                >
                  Otro...
                </button>
              </div>

              {attributeName === 'custom' && (
                <input
                  type="text"
                  required
                  value={customAttrInput}
                  onChange={(e) => setCustomAttrInput(e.target.value)}
                  placeholder="Escribe el nombre del atributo (ej: Material, Formato)..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-lilac-500 rounded-lg text-xs text-slate-800 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Proveedores Compartidos (Selección Múltiple) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-lilac-600" />
                <span>Proveedores Compartidos (Selecciona uno o más)</span>
              </label>

              <div className="flex items-center gap-2">
                {selectedSupplierIds.size > 0 && (
                  <span className="text-[11px] font-semibold text-lilac-600 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-full">
                    {selectedSupplierIds.size} seleccionado(s)
                  </span>
                )}
                {!isAddingSupplierInline && (
                  <button
                    type="button"
                    onClick={() => setIsAddingSupplierInline(true)}
                    className="text-xs text-lilac-600 hover:text-lilac-700 font-bold flex items-center gap-1 hover:underline shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Nuevo Proveedor</span>
                  </button>
                )}
              </div>
            </div>

            {isAddingSupplierInline && (
              <div className="flex items-center gap-2 p-2 bg-white border border-lilac-200 rounded-lg shadow-sm">
                <input
                  type="text"
                  value={newInlineSupplierName}
                  onChange={(e) => setNewInlineSupplierName(e.target.value)}
                  placeholder="Nombre del nuevo proveedor..."
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-lilac-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddInlineSupplier()
                    }
                    if (e.key === 'Escape') {
                      setIsAddingSupplierInline(false)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddInlineSupplier}
                  className="px-2.5 py-1 bg-lilac-600 hover:bg-lilac-700 text-white rounded text-xs font-bold transition-colors"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSupplierInline(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1 text-center">
                No hay proveedores registrados aún. Haz clic en "+ Nuevo Proveedor" para crear uno.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-0.5">
                {suppliers.map((s) => {
                  const isChecked = selectedSupplierIds.has(s.id)
                  return (
                    <label
                      key={s.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-lilac-500 border-lilac-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-lilac-300 hover:bg-slate-100/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(selectedSupplierIds)
                          if (e.target.checked) {
                            next.add(s.id)
                          } else {
                            next.delete(s.id)
                          }
                          setSelectedSupplierIds(next)
                        }}
                        className="rounded text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 accent-lilac-600 cursor-pointer"
                      />
                      <span>{s.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Variations Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Variaciones a vincular ({rows.length})
              </label>
              <span className="text-[11px] text-slate-400">
                Escribe el valor de {attributeName === 'custom' ? customAttrInput || 'atributo' : attributeName} para cada una
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Producto Original</th>
                    <th className="py-2 px-3">
                      Valor {attributeName === 'custom' ? customAttrInput || 'Atributo' : attributeName} *
                    </th>
                    <th className="py-2 px-3 text-right">Precio</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row, idx) => (
                    <tr key={row.productId} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {row.code || <span className="italic text-slate-400">Sin código</span>}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800 max-w-[200px] truncate" title={row.originalName}>
                        {row.originalName}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          value={row.attributeValue}
                          onChange={(e) => handleAttributeValueChange(idx, e.target.value)}
                          placeholder="Ej: Azul, Rojo, M, 100gr..."
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-lg text-xs font-semibold text-slate-800 focus:outline-none select-text cursor-text"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        {formatCLP(row.salePrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-600">
                        {row.stock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-lilac-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleApply}
            className="px-4 py-2 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Agrupar {rows.length} variaciones</span>
          </button>
        </div>
      </div>
    </div>
  )
}
