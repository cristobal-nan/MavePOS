import React, { useState } from 'react'
import { X, FolderInput, FolderPlus, Plus, CheckCircle2, Layers } from 'lucide-react'
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
  const { categories, saveCategory, bulkUpdateCategory } = useCatalogStore()

  const [selectedDeptoId, setSelectedDeptoId] = useState<number | null>(null)
  const [selectedSubcatId, setSelectedSubcatId] = useState<number | null>(null)
  const [isCreatingSubcat, setIsCreatingSubcat] = useState(false)
  const [newSubcatName, setNewSubcatName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const departments = categories.filter((c) => c.parent_id === null)
  const subcategories = categories.filter((c) => c.parent_id === selectedDeptoId)

  const handleCreateSubcategory = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!selectedDeptoId) {
      setError('Selecciona primero un departamento para crear la subcategoría.')
      return
    }

    const trimmed = newSubcatName.trim()
    if (!trimmed) {
      setError('El nombre de la subcategoría no puede estar vacío.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await saveCategory(trimmed, selectedDeptoId)
      setSelectedSubcatId(created.id)
      setNewSubcatName('')
      setIsCreatingSubcat(false)
    } catch (err: any) {
      setError(err.message || 'Error al crear la subcategoría.')
    } finally {
      setIsSubmitting(false)
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

    // Determine target category id: either chosen subcategory, or department if no subcat selected
    const targetCategoryId = selectedSubcatId !== null ? selectedSubcatId : selectedDeptoId

    setIsSubmitting(true)
    try {
      await bulkUpdateCategory(productIds, targetCategoryId)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al reasignar categorías.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <span>Mover a Categoría en Lote</span>
              <p className="text-xs font-normal text-slate-500">
                Reasignar categoría a {selectedProducts.length} producto(s) seleccionado(s)
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
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Department Selector (Level 1) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-lilac-600" />
              <span>1. Departamento (Nivel 1)</span>
            </label>
            <select
              value={selectedDeptoId || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                setSelectedDeptoId(val)
                setSelectedSubcatId(null)
                setIsCreatingSubcat(false)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-lilac-500 cursor-pointer"
            >
              <option value="">-- Sin departamento / Desasignar categoría --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Selector (Level 2) */}
          {selectedDeptoId && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5 text-lilac-600" />
                  <span>2. Subcategoría (Opcional, Nivel 2)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingSubcat(!isCreatingSubcat)}
                  className="text-xs font-semibold text-lilac-700 hover:text-lilac-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCreatingSubcat ? 'Cancelar' : 'Nueva Subcategoría'}</span>
                </button>
              </div>

              {/* Inline Subcategory Creator */}
              {isCreatingSubcat ? (
                <div className="p-3 bg-lilac-50/70 border border-lilac-200 rounded-xl space-y-2 animate-in fade-in duration-100">
                  <p className="text-[11px] text-slate-600">
                    Crea una nueva subcategoría bajo el departamento seleccionado:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubcatName}
                      onChange={(e) => setNewSubcatName(e.target.value)}
                      placeholder="Ej: Algodón Rústico, Crochet, Lana Gruesa..."
                      className="flex-1 px-3 py-1.5 bg-white border border-lilac-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-lilac-500"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting || !newSubcatName.trim()}
                      onClick={handleCreateSubcategory}
                      className="px-3 py-1.5 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedSubcatId || ''}
                  onChange={(e) => setSelectedSubcatId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-lilac-500 cursor-pointer"
                >
                  <option value="">-- Dejar solo a nivel de Departamento --</option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      ↳ {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Selected Products Preview summary */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Productos a actualizar: </span>
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
            <span>Mover {selectedProducts.length} producto(s)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
