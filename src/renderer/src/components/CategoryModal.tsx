import React, { useState } from 'react'
import { X, Plus, Trash2, Layers, Edit2, Check } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'
import { Category } from '@shared/types'
import { useModalStack } from '../utils/modalStack'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose }) => {
  const { categories, saveCategory, deleteCategory } = useCatalogStore()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: number; name: string } | null>(null)

  useModalStack({
    id: 'category-modal',
    isOpen: isOpen && !categoryToDelete,
    onClose,
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'category-confirm-delete-modal',
    isOpen: !!categoryToDelete,
    onClose: () => setCategoryToDelete(null),
    closeOnBackdrop: false
  })

  if (!isOpen) return null

  const handleCreateCategory = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setError('Ingresa el nombre de la categoría.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveCategory(trimmed)
      setNewCategoryName('')
    } catch (err: any) {
      setError(err.message || 'Error al crear categoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (category: Category): void => {
    setEditingId(category.id)
    setEditingName(category.name)
    setError(null)
  }

  const handleSaveEdit = async (id: number): Promise<void> => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setError('El nombre de la categoría no puede estar vacío.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveCategory(trimmed, null, id)
      setEditingId(null)
      setEditingName('')
    } catch (err: any) {
      setError(err.message || 'Error al actualizar categoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (id: number, name: string): void => {
    setCategoryToDelete({ id, name })
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!categoryToDelete) return
    const { id } = categoryToDelete
    setCategoryToDelete(null)
    try {
      await deleteCategory(id)
      if (editingId === id) {
        setEditingId(null)
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar categoría.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span>Administrar Categorías</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {error}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Form to add Category */}
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nueva categoría (ej: Lanas, Hilos, Accesorios)..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:border-lilac-500 shadow-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-sm font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </form>

          {/* List of Categories */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 flex flex-col max-h-80 overflow-y-auto space-y-1.5">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                No hay categorías registradas aún. Agrega una arriba.
              </p>
            ) : (
              categories.map((c) => {
                const isEditing = editingId === c.id
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-lg text-sm bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 shadow-xs group hover:border-lilac-300 dark:hover:border-slate-600 transition-all"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-lilac-400 text-slate-900 dark:text-white rounded focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(c.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={isSubmitting}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Guardar cambios"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(c)}
                            className="p-1 text-slate-400 hover:text-lilac-600 dark:hover:text-lilac-400 hover:bg-lilac-50 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Editar nombre"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>{categories.length} categoría(s) en total</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Submodal de confirmación para eliminar categoría */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 dark:bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">¿Eliminar categoría?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">"{categoryToDelete.name}"</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Los productos asociados quedarán sin categoría asignada.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/20 transition-colors cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
