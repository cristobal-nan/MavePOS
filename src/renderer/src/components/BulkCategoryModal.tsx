import React, { useState } from 'react'
import { X, FolderInput, CheckCircle2, Layers, Truck, Plus } from 'lucide-react'
import { ProductSearchResult } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'

interface BulkCategoryModalProps {
  isOpen: boolean
  selectedProducts: ProductSearchResult[]
  onClose: () => void
  onSuccess: () => void
}

export const BulkCategoryModal: React.FC<BulkCategoryModalProps> = ({
  isOpen,
  selectedProducts,
  onClose,
  onSuccess
}) => {
  const { categories, suppliers, saveSupplier, bulkUpdateCategory } = useCatalogStore()

  // Category mode: 'KEEP' (do not touch), 'NONE' (null/no category), or string representation of category id
  const [categoryChoice, setCategoryChoice] = useState<string>('KEEP')

  // Supplier mode: boolean whether to overwrite suppliers or keep existing
  const [updateSuppliers, setUpdateSuppliers] = useState<boolean>(true)
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set())

  // Inline quick create supplier
  const [isAddingSupplierInline, setIsAddingSupplierInline] = useState(false)
  const [newInlineSupplierName, setNewInlineSupplierName] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

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

  const handleApply = async (): Promise<void> => {
    setError(null)
    const productIds = selectedProducts
      .map((p) => p.id)
      .filter((id): id is number => typeof id === 'number')

    if (productIds.length === 0) {
      setError('No hay productos válidos seleccionados.')
      return
    }

    if (categoryChoice === 'KEEP' && !updateSuppliers) {
      setError('Por favor selecciona una categoría o activa la asignación de proveedores.')
      return
    }

    // Determine target category id
    let targetCategoryId: number | null | undefined = undefined
    if (categoryChoice === 'NONE') {
      targetCategoryId = null
    } else if (categoryChoice !== 'KEEP') {
      targetCategoryId = Number(categoryChoice)
    }

    // Determine target supplier ids
    const targetSupplierIds = updateSuppliers ? Array.from(selectedSupplierIds) : undefined

    setIsSubmitting(true)
    try {
      await bulkUpdateCategory(productIds, targetCategoryId, targetSupplierIds)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar productos.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <span>Asignar Categoría y Proveedores en Lote</span>
              <p className="text-xs font-normal text-slate-500">
                Actualizar para {selectedProducts.length} producto(s) seleccionado(s)
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
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* 1. Category Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-lilac-600" />
              <span>1. Categoría</span>
            </label>
            <select
              value={categoryChoice}
              onChange={(e) => setCategoryChoice(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-lilac-500 cursor-pointer font-medium"
            >
              <option value="KEEP">(Mantener categoría actual de cada producto)</option>
              <option value="NONE">-- Sin categoría / Quitar categoría actual --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Supplier Section (Multiple Choice) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSuppliers}
                  onChange={(e) => setUpdateSuppliers(e.target.checked)}
                  className="rounded text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 accent-lilac-600 cursor-pointer"
                />
                <Truck className="w-4 h-4 text-lilac-600" />
                <span>2. Proveedores (Selección Múltiple)</span>
              </label>

              {updateSuppliers && (
                <span className="text-[11px] font-semibold text-lilac-600 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-full">
                  {selectedSupplierIds.size} marcado(s)
                </span>
              )}
            </div>

            {updateSuppliers ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-600">
                    Marca los proveedores que deseas asociar a los productos seleccionados:
                  </p>
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
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    No hay proveedores registrados aún. Haz clic en "+ Nuevo Proveedor" para crear uno.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-0.5">
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
                {selectedSupplierIds.size === 0 && suppliers.length > 0 && (
                  <p className="text-[11px] text-amber-600 italic">
                    * Si no marcas ningún proveedor, los productos seleccionados quedarán sin proveedores asignados.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic pl-5">
                Los proveedores actuales de los productos seleccionados no se modificarán.
              </p>
            )}
          </div>

          {/* Selected Products Preview summary */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Productos seleccionados: </span>
            <span>{selectedProducts.length} ítem(s)</span>
            <div className="max-h-24 overflow-y-auto mt-2 space-y-1 divide-y divide-slate-100">
              {selectedProducts.slice(0, 5).map((p) => (
                <div key={p.id || p.code} className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-[280px] font-medium text-slate-800">{p.name}</span>
                  <span className="font-mono text-slate-400">{p.code || 'sin código'}</span>
                </div>
              ))}
              {selectedProducts.length > 5 && (
                <div className="pt-1 text-[11px] text-slate-400 italic">
                  ... y {selectedProducts.length - 5} producto(s) más.
                </div>
              )}
            </div>
          </div>
        </div>

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
            <span>Aplicar a {selectedProducts.length} producto(s)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
