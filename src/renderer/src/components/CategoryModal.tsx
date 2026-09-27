import React, { useState } from 'react'
import { X, Plus, Trash2, Layers, FolderPlus } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose }) => {
  const { categories, saveCategory, deleteCategory } = useCatalogStore()

  const [newDeptoName, setNewDeptoName] = useState('')
  const [selectedDeptoId, setSelectedDeptoId] = useState<number | null>(null)
  const [newSubcatName, setNewSubcatName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const departments = categories.filter((c) => c.parent_id === null)
  const subcategories = categories.filter((c) => c.parent_id === selectedDeptoId)

  const handleCreateDepartment = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const trimmed = newDeptoName.trim()
    if (!trimmed) {
      setError('Ingresa el nombre del departamento.')
      return
    }

    setIsSubmitting(true)
    try {
      const depto = await saveCategory(trimmed, null)
      setNewDeptoName('')
      setSelectedDeptoId(depto.id)
    } catch (err: any) {
      setError(err.message || 'Error al crear departamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateSubcategory = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!selectedDeptoId) {
      setError('Selecciona un departamento primero.')
      return
    }
    const trimmed = newSubcatName.trim()
    if (!trimmed) {
      setError('Ingresa el nombre de la subcategoría.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveCategory(trimmed, selectedDeptoId)
      setNewSubcatName('')
    } catch (err: any) {
      setError(err.message || 'Error al crear subcategoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (confirm(`¿Estás seguro de eliminar "${name}"?`)) {
      try {
        await deleteCategory(id)
        if (selectedDeptoId === id) {
          setSelectedDeptoId(null)
        }
      } catch (err: any) {
        setError(err.message || 'Error al eliminar categoría.')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span>Categorías (Exactamente 2 Niveles: Depto → Subcat)</span>
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

        {/* Modal Body: Two column split */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* Col 1: Departamentos (Nivel 1) */}
          <div className="flex flex-col border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-lilac-600" />
              <span>1. Departamentos</span>
            </h4>

            {/* Form to add Depto */}
            <form onSubmit={handleCreateDepartment} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDeptoName}
                onChange={(e) => setNewDeptoName(e.target.value)}
                placeholder="Nuevo Depto..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* List Deptos */}
            <div className="flex-1 space-y-1.5 max-h-56 overflow-y-auto">
              {departments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay departamentos aún.</p>
              ) : (
                departments.map((d) => {
                  const isSelected = selectedDeptoId === d.id
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDeptoId(d.id)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-lilac-500 text-white shadow-sm'
                          : 'bg-white hover:bg-lilac-50 text-slate-700 border border-slate-100'
                      }`}
                    >
                      <span className="truncate">{d.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(d.id, d.name)
                        }}
                        className={`p-1 rounded transition-colors ${
                          isSelected ? 'hover:bg-lilac-600 text-white' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                        }`}
                        title="Eliminar departamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Col 2: Subcategorías (Nivel 2) */}
          <div className="flex flex-col border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-lilac-600" />
              <span>
                2. Subcategorías{' '}
                {selectedDeptoId && (
                  <span className="text-lilac-600">
                    de "{departments.find((d) => d.id === selectedDeptoId)?.name}"
                  </span>
                )}
              </span>
            </h4>

            {selectedDeptoId ? (
              <>
                {/* Form to add Subcat */}
                <form onSubmit={handleCreateSubcategory} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    placeholder="Nueva subcategoría..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* List Subcats */}
                <div className="flex-1 space-y-1.5 max-h-56 overflow-y-auto">
                  {subcategories.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Este departamento no tiene subcategorías.
                    </p>
                  ) : (
                    subcategories.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded-lg text-xs font-medium bg-white border border-slate-100 text-slate-700"
                      >
                        <span className="truncate">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Eliminar subcategoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400 text-center py-8">
                Selecciona un departamento de la izquierda para ver y gestionar sus subcategorías.
              </div>
            )}
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
