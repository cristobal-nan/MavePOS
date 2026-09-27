import React, { useState } from 'react'
import { X, Plus, Trash2, Tag } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'

interface FamilyModalProps {
  isOpen: boolean
  onClose: () => void
}

export const FamilyModal: React.FC<FamilyModalProps> = ({ isOpen, onClose }) => {
  const { families, categories, saveFamily, deleteFamily } = useCatalogStore()

  const [newFamilyName, setNewFamilyName] = useState('')
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const trimmed = newFamilyName.trim()
    if (!trimmed) {
      setError('Ingresa el nombre de la familia.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveFamily(trimmed, selectedCatId)
      setNewFamilyName('')
      setSelectedCatId(null)
    } catch (err: any) {
      setError(err.message || 'Error al crear la familia.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (confirm(`¿Estás seguro de eliminar la familia "${name}"? Los productos seguirán existiendo desvinculados.`)) {
      try {
        await deleteFamily(id)
      } catch (err: any) {
        setError(err.message || 'Error al eliminar familia.')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <span>Familias de Variantes</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Las familias agrupan variantes de un mismo producto (ejemplo: "Algodón" agrupa Algodón/Azul, Algodón/Rojo). Cada producto conserva su propio código y stock independiente.
          </p>

          {/* Form to create family */}
          <form onSubmit={handleCreate} className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la Familia (ej: Lana Gruesa, Algodón Rústico)
              </label>
              <input
                type="text"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Nombre de la familia..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría Asociada (Opcional)
              </label>
              <select
                value={selectedCatId || ''}
                onChange={(e) => setSelectedCatId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
              >
                <option value="">-- Sin categoría por defecto --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id !== null ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Familia</span>
            </button>
          </form>

          {/* List existing families */}
          <div className="space-y-2 pt-2">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Familias Registradas ({families.length})
            </h5>
            <div className="max-h-52 overflow-y-auto space-y-1.5">
              {families.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay familias creadas.</p>
              ) : (
                families.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-lg text-xs bg-white border border-slate-200/80 hover:bg-lilac-50/50 transition-colors"
                  >
                    <span className="font-semibold text-slate-800">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id, f.name)}
                      className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Eliminar familia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
