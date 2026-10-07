import React, { useState, useRef } from 'react'
import { Truck, Plus, X, ChevronDown } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'
import { capitalizeWords } from '../utils/formatters'

interface SupplierSelectCardProps {
  selectedSupplierIds: Set<number>
  onChangeSelectedSupplierIds: (ids: Set<number>) => void
  title?: string
  className?: string
  defaultExpanded?: boolean
}

export const SupplierSelectCard: React.FC<SupplierSelectCardProps> = ({
  selectedSupplierIds,
  onChangeSelectedSupplierIds,
  title = 'Proveedor/es del producto',
  className = '',
  defaultExpanded = false
}) => {
  const { suppliers, saveSupplier } = useCatalogStore()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isAddingSupplierInline, setIsAddingSupplierInline] = useState(false)
  const [newInlineSupplierName, setNewInlineSupplierName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAddInlineSupplier = async (): Promise<void> => {
    const trimmed = newInlineSupplierName.trim()
    if (!trimmed) return
    setIsSubmitting(true)
    setError(null)
    try {
      const newSup = await saveSupplier(trimmed)
      const next = new Set(selectedSupplierIds)
      next.add(newSup.id)
      onChangeSelectedSupplierIds(next)
      setNewInlineSupplierName('')
      setIsAddingSupplierInline(false)
    } catch (err: any) {
      setError(err.message || 'Error al guardar proveedor')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Find selected supplier names for display
  const selectedSuppliers = Array.from(selectedSupplierIds)
    .map((id) => suppliers.find((s) => s.id === id))
    .filter(Boolean)

  return (
    <div
      className={`${className.includes('bg-') ? '' : 'bg-white dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 flex flex-col gap-2.5 shadow-2xs transition-all ${className}`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between gap-2 min-h-[26px] cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Truck className="w-4 h-4 text-lilac-600 dark:text-lilac-400 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{title}:</span>

          {selectedSuppliers.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {selectedSuppliers.map((sup) => (
                <span
                  key={sup!.id}
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-lilac-100 dark:bg-slate-700 text-lilac-800 dark:text-lilac-300 border border-lilac-200 dark:border-slate-600 truncate max-w-[150px] leading-tight"
                  title={sup!.name}
                >
                  {sup!.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] text-slate-400 dark:text-slate-500 italic font-medium border border-transparent leading-tight">
              (Sin proveedores)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isAddingSupplierInline && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(true)
                setIsAddingSupplierInline(true)
                setError(null)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
              className="text-xs text-lilac-600 hover:text-lilac-700 dark:text-lilac-400 dark:hover:text-lilac-300 font-bold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Proveedor</span>
            </button>
          )}

          <div
            className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? 'Contraer' : 'Expandir'}
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-700 animate-in fade-in duration-100">
          {/* Inline Create Form */}
          {isAddingSupplierInline && (
            <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-slate-800 border border-lilac-200 dark:border-slate-700 rounded-lg shadow-xs animate-in fade-in duration-100">
              {error && <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{error}</span>}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newInlineSupplierName}
                  onChange={(e) => setNewInlineSupplierName(capitalizeWords(e.target.value))}
                  placeholder="Nombre del nuevo proveedor..."
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 focus:bg-white dark:focus:bg-slate-900 rounded outline-none text-slate-900 dark:text-white font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddInlineSupplier()
                    }
                    if (e.key === 'Escape') {
                      setIsAddingSupplierInline(false)
                      setNewInlineSupplierName('')
                      setError(null)
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!newInlineSupplierName.trim() || isSubmitting}
                  onClick={handleAddInlineSupplier}
                  className="px-3 py-1 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSupplierInline(false)
                    setNewInlineSupplierName('')
                    setError(null)
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Suppliers Checkboxes List */}
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-0.5">
            {suppliers.map((sup) => {
              const isChecked = selectedSupplierIds.has(sup.id)
              return (
                <label
                  key={sup.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-lilac-600 border-lilac-700 dark:bg-lilac-700 dark:border-lilac-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = new Set(selectedSupplierIds)
                      if (e.target.checked) next.add(sup.id)
                      else next.delete(sup.id)
                      onChangeSelectedSupplierIds(next)
                    }}
                    className="rounded text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 accent-lilac-600 cursor-pointer"
                  />
                  <span>{sup.name}</span>
                </label>
              )
            })}
            {suppliers.length === 0 && (
              <div className="py-2 text-center text-slate-400 dark:text-slate-500 italic text-[11px] w-full">
                No hay proveedores registrados aún.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
