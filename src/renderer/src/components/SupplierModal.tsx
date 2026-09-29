import React, { useState } from 'react'
import { X, Plus, Trash2, Truck, Edit2, Check } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'
import { Supplier } from '@shared/types'

interface SupplierModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose }) => {
  const { suppliers, saveSupplier, deleteSupplier } = useCatalogStore()

  const [newSupplierName, setNewSupplierName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const trimmed = newSupplierName.trim()
    if (!trimmed) {
      setError('Ingresa el nombre del proveedor.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveSupplier(trimmed)
      setNewSupplierName('')
    } catch (err: any) {
      setError(err.message || 'Error al guardar proveedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (supplier: Supplier): void => {
    setEditingId(supplier.id)
    setEditingName(supplier.name)
    setError(null)
  }

  const handleSaveEdit = async (id: number): Promise<void> => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setError('El nombre del proveedor no puede estar vacío.')
      return
    }

    setIsSubmitting(true)
    try {
      await saveSupplier(trimmed, id)
      setEditingId(null)
      setEditingName('')
    } catch (err: any) {
      setError(err.message || 'Error al actualizar proveedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (confirm(`¿Estás seguro de eliminar el proveedor "${name}"?`)) {
      try {
        await deleteSupplier(id)
        if (editingId === id) {
          setEditingId(null)
        }
      } catch (err: any) {
        setError(err.message || 'Error al eliminar proveedor.')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <span>Administrar Proveedores</span>
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

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Form to add Supplier */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Nombre del nuevo proveedor (ej. Revesderecho)..."
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 shadow-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </form>

          {/* List of Suppliers */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col max-h-80 overflow-y-auto space-y-1.5">
            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay proveedores registrados aún. Agrega uno arriba.
              </p>
            ) : (
              suppliers.map((s) => {
                const isEditing = editingId === s.id
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-lg text-sm bg-white border border-slate-200 shadow-sm group hover:border-lilac-200 transition-all"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-lilac-400 rounded focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(s.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(s.id)}
                          disabled={isSubmitting}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Guardar cambios"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-800">{s.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(s)}
                            className="p-1 text-slate-400 hover:text-lilac-600 hover:bg-lilac-50 rounded transition-colors"
                            title="Editar nombre"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Eliminar proveedor"
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>{suppliers.length} proveedor(es) en total</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
