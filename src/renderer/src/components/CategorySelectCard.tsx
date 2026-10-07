import React, { useState, useRef } from 'react'
import { Layers, Plus, CheckCircle2, X, Search, ChevronDown } from 'lucide-react'
import { useCatalogStore } from '../store/catalogStore'
import { capitalizeWords } from '../utils/formatters'

interface CategorySelectCardProps {
  selectedCategoryId: number | null | string
  onSelectCategory: (id: any) => void
  title?: string
  className?: string
  maxHeight?: string
  allowKeepCurrent?: boolean
  defaultExpanded?: boolean
}

export const CategorySelectCard: React.FC<CategorySelectCardProps> = ({
  selectedCategoryId,
  onSelectCategory,
  title = 'Categoría',
  className = '',
  maxHeight = 'max-h-32',
  allowKeepCurrent = false,
  defaultExpanded = false
}) => {
  const { categories, saveCategory } = useCatalogStore()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isCreatingInline, setIsCreatingInline] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const newCatInputRef = useRef<HTMLInputElement>(null)

  const isKeep = selectedCategoryId === 'KEEP'
  const isNone = selectedCategoryId === 'NONE' || selectedCategoryId === null

  const numId =
    typeof selectedCategoryId === 'number'
      ? selectedCategoryId
      : selectedCategoryId && selectedCategoryId !== 'KEEP' && selectedCategoryId !== 'NONE'
      ? Number(selectedCategoryId)
      : null

  // Find selected category name for header badge
  const selectedCat = numId ? categories.find((c) => c.id === numId) : null
  const selectedCatParent = selectedCat?.parent_id
    ? categories.find((p) => p.id === selectedCat.parent_id)
    : null
  const selectedCatDisplayName = isKeep
    ? '(Mantener actual)'
    : selectedCat
    ? selectedCatParent
      ? `${selectedCatParent.name} > ${selectedCat.name}`
      : selectedCat.name
    : null

  const handleCreateCategory = async (): Promise<void> => {
    const trimmed = newCatName.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError(null)
    try {
      const newCat = await saveCategory(trimmed)
      onSelectCategory(allowKeepCurrent ? newCat.id.toString() : newCat.id)
      setNewCatName('')
      setIsCreatingInline(false)
    } catch (err: any) {
      setError(err.message || 'Error al crear la categoría.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter categories by query
  const filteredCategories = categories.filter((c) => {
    if (!filterQuery.trim()) return true
    const q = filterQuery.toLowerCase()
    const nameMatch = c.name.toLowerCase().includes(q)
    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
    const parentMatch = parent ? parent.name.toLowerCase().includes(q) : false
    return nameMatch || parentMatch
  })

  return (
    <div
      className={`${className.includes('bg-') ? '' : 'bg-white dark:bg-slate-800'} border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 flex flex-col gap-2.5 shadow-2xs transition-all ${className}`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between gap-2 min-h-[26px] cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-lilac-600 dark:text-lilac-400 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{title}:</span>
          {isKeep ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 leading-tight">
              (Mantener actual)
            </span>
          ) : selectedCatDisplayName ? (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-lilac-100 dark:bg-slate-700 text-lilac-800 dark:text-lilac-300 border border-lilac-200 dark:border-slate-600 truncate max-w-[200px] leading-tight"
              title={selectedCatDisplayName}
            >
              {selectedCatDisplayName}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] text-slate-400 dark:text-slate-500 italic font-medium border border-transparent leading-tight">
              (Sin categoría)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCreatingInline && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(true)
                setIsCreatingInline(true)
                setError(null)
                setTimeout(() => newCatInputRef.current?.focus(), 50)
              }}
              className="text-xs text-lilac-600 hover:text-lilac-700 dark:text-lilac-400 dark:hover:text-lilac-300 font-bold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Categoría</span>
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
          {isCreatingInline && (
            <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-slate-800 border border-lilac-200 dark:border-slate-700 rounded-lg shadow-xs animate-in fade-in duration-100">
              {error && <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{error}</span>}
              <div className="flex items-center gap-2">
                <input
                  ref={newCatInputRef}
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(capitalizeWords(e.target.value))}
                  placeholder="Nombre de la nueva categoría..."
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 focus:bg-white dark:focus:bg-slate-900 rounded outline-none text-slate-900 dark:text-white font-medium"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreateCategory()
                    }
                    if (e.key === 'Escape') {
                      setIsCreatingInline(false)
                      setNewCatName('')
                      setError(null)
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!newCatName.trim() || isSubmitting}
                  onClick={handleCreateCategory}
                  className="px-3 py-1 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingInline(false)
                    setNewCatName('')
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

          {/* Quick Search filter if many categories */}
          {categories.length > 6 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filtrar categorías..."
                className="w-full pl-8 pr-7 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-400 rounded-lg outline-none text-slate-800 dark:text-white"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Preloaded Scrolleable Category List */}
          <div className={`${maxHeight} overflow-y-auto space-y-0.5 pr-1 select-none`}>
            {/* Option: Mantener categoría actual (if allowKeepCurrent) */}
            {allowKeepCurrent && (
              <div
                onClick={() => {
                  onSelectCategory('KEEP')
                  setIsExpanded(false)
                }}
                className={`pt-1.5 pb-1 px-2.5 flex items-center justify-between rounded-lg cursor-pointer transition-colors text-[11px] border-l-2 ${
                  isKeep
                    ? 'bg-lilac-100 dark:bg-slate-750 text-lilac-900 dark:text-lilac-300 font-bold border-lilac-600 dark:border-lilac-400 shadow-2xs'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 italic font-medium border-transparent'
                }`}
              >
                <span>(Mantener categoría actual de cada producto)</span>
                {isKeep && <CheckCircle2 className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400 shrink-0" />}
              </div>
            )}

            {/* Option: Sin Categoría */}
            <div
              onClick={() => {
                onSelectCategory(allowKeepCurrent ? 'NONE' : null)
                setIsExpanded(false)
              }}
              className={`pt-1.5 pb-1 px-2.5 flex items-center justify-between rounded-lg cursor-pointer transition-colors text-[11px] border-l-2 ${
                !isKeep && isNone
                  ? 'bg-lilac-100 dark:bg-slate-750 text-lilac-900 dark:text-lilac-300 font-bold border-lilac-600 dark:border-lilac-400 shadow-2xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 italic border-transparent'
              }`}
            >
              <span>{allowKeepCurrent ? '-- Sin categoría / Quitar categoría actual --' : '-- Sin categoría --'}</span>
              {!isKeep && isNone && (
                <CheckCircle2 className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400 shrink-0" />
              )}
            </div>

            {/* Categories */}
            {filteredCategories.map((c) => {
              const isSelected = numId === c.id
              const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
              const displayName = parent ? `${parent.name} > ${c.name}` : c.name

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectCategory(allowKeepCurrent ? c.id.toString() : c.id)
                    setIsExpanded(false)
                  }}
                  className={`pt-1.5 pb-1 px-2.5 flex items-center justify-between rounded-lg cursor-pointer transition-colors text-[11px] border-l-2 ${
                    isSelected
                      ? 'bg-lilac-100 dark:bg-slate-750 text-lilac-900 dark:text-lilac-300 font-bold border-lilac-600 dark:border-lilac-400 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 font-medium border-transparent'
                  }`}
                >
                  <span className="truncate pr-2" title={displayName}>
                    {displayName}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400 shrink-0" />
                  )}
                </div>
              )
            })}

            {filteredCategories.length === 0 && (
              <div className="py-2.5 text-center text-slate-400 dark:text-slate-500 italic text-[11px]">
                No se encontraron categorías.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

