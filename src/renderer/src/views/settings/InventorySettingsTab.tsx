import React, { useState, useEffect, useCallback } from 'react'
import {
  Boxes,
  RotateCcw,
  Plus,
  Trash2,
  FileText,
  FileSpreadsheet,
  Gauge,
  Search,
  Keyboard,
  X
} from 'lucide-react'
import { QuickAdjustmentReason, DEFAULT_QUICK_REASONS, CatalogConfig, DEFAULT_CATALOG_CONFIG } from '@shared/types'
import { eventToShortcut } from '../../utils/keyboardShortcut'
import { useCatalogStore } from '../../store/catalogStore'
import { useSettingsStore, DirtyFieldChange } from '../../store/settingsStore'

export const InventorySettingsTab: React.FC = () => {
  const [initialReasons, setInitialReasons] = useState<QuickAdjustmentReason[]>([...DEFAULT_QUICK_REASONS])
  const [reasons, setReasons] = useState<QuickAdjustmentReason[]>([...DEFAULT_QUICK_REASONS])
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'replace' | 'append'>('replace')
  const [newShortcut, setNewShortcut] = useState('')
  const [isRecordingNewShortcut, setIsRecordingNewShortcut] = useState(false)
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null)

  const [initialExportPrefix, setInitialExportPrefix] = useState('Productos')
  const [exportPrefix, setExportPrefix] = useState('Productos')

  // Opciones de Carga y Rendimiento de Catálogo
  const [initialCatalogAutoLoad, setInitialCatalogAutoLoad] = useState(DEFAULT_CATALOG_CONFIG.catalogAutoLoad)
  const [catalogAutoLoad, setCatalogAutoLoad] = useState(DEFAULT_CATALOG_CONFIG.catalogAutoLoad)

  const [initialCatalogInitialLimit, setInitialCatalogInitialLimit] = useState(DEFAULT_CATALOG_CONFIG.catalogInitialLimit)
  const [catalogInitialLimit, setCatalogInitialLimit] = useState(DEFAULT_CATALOG_CONFIG.catalogInitialLimit)

  const [initialCatalogScrollBatch, setInitialCatalogScrollBatch] = useState(DEFAULT_CATALOG_CONFIG.catalogScrollBatch)
  const [catalogScrollBatch, setCatalogScrollBatch] = useState(DEFAULT_CATALOG_CONFIG.catalogScrollBatch)

  const [initialModalAutoLoad, setInitialModalAutoLoad] = useState(DEFAULT_CATALOG_CONFIG.modalAutoLoad)
  const [modalAutoLoad, setModalAutoLoad] = useState(DEFAULT_CATALOG_CONFIG.modalAutoLoad)

  const [initialModalInitialLimit, setInitialModalInitialLimit] = useState(DEFAULT_CATALOG_CONFIG.modalInitialLimit)
  const [modalInitialLimit, setModalInitialLimit] = useState(DEFAULT_CATALOG_CONFIG.modalInitialLimit)

  const [initialModalScrollBatch, setInitialModalScrollBatch] = useState(DEFAULT_CATALOG_CONFIG.modalScrollBatch)
  const [modalScrollBatch, setModalScrollBatch] = useState(DEFAULT_CATALOG_CONFIG.modalScrollBatch)

  const [isLoaded, setIsLoaded] = useState(false)

  const registerSubTabState = useSettingsStore((s) => s.registerSubTabState)
  const clearSubTabState = useSettingsStore((s) => s.clearSubTabState)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((settings) => {
        if (!isMounted) return
        let loadedReasons = [...DEFAULT_QUICK_REASONS]
        if (settings?.inventory_quick_reasons) {
          try {
            const parsed = JSON.parse(settings.inventory_quick_reasons)
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedReasons = parsed
            }
          } catch (e) {
            console.error('Error parseando inventory_quick_reasons:', e)
          }
        }
        setInitialReasons(loadedReasons)
        setReasons(loadedReasons)

        const loadedPrefix = settings?.excel_export_prefix || 'Productos'
        setInitialExportPrefix(loadedPrefix)
        setExportPrefix(loadedPrefix)

        const autoLoad =
          settings?.catalog_autoload !== undefined
            ? settings.catalog_autoload === 'true'
            : DEFAULT_CATALOG_CONFIG.catalogAutoLoad
        setInitialCatalogAutoLoad(autoLoad)
        setCatalogAutoLoad(autoLoad)

        const catInit = settings?.catalog_initial_limit
          ? parseInt(settings.catalog_initial_limit, 10) || 150
          : DEFAULT_CATALOG_CONFIG.catalogInitialLimit
        setInitialCatalogInitialLimit(catInit)
        setCatalogInitialLimit(catInit)

        const catBatch = settings?.catalog_scroll_batch
          ? parseInt(settings.catalog_scroll_batch, 10) || 150
          : DEFAULT_CATALOG_CONFIG.catalogScrollBatch
        setInitialCatalogScrollBatch(catBatch)
        setCatalogScrollBatch(catBatch)

        const mAutoLoad =
          settings?.modal_autoload !== undefined
            ? settings.modal_autoload === 'true'
            : DEFAULT_CATALOG_CONFIG.modalAutoLoad
        setInitialModalAutoLoad(mAutoLoad)
        setModalAutoLoad(mAutoLoad)

        const mInit = settings?.modal_initial_limit
          ? parseInt(settings.modal_initial_limit, 10) || 150
          : DEFAULT_CATALOG_CONFIG.modalInitialLimit
        setInitialModalInitialLimit(mInit)
        setModalInitialLimit(mInit)

        const mBatch = settings?.modal_scroll_batch
          ? parseInt(settings.modal_scroll_batch, 10) || 150
          : DEFAULT_CATALOG_CONFIG.modalScrollBatch
        setInitialModalScrollBatch(mBatch)
        setModalScrollBatch(mBatch)

        setIsLoaded(true)
      })
      .catch((err) => {
        console.error('Error al cargar configuración de inventario:', err)
      })

    return () => {
      isMounted = false
      clearSubTabState()
    }
  }, [clearSubTabState])

  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await window.api.setSetting('inventory_quick_reasons', JSON.stringify(reasons))
      const safePrefix = exportPrefix.trim() || 'Productos'
      await window.api.setSetting('excel_export_prefix', safePrefix)

      const safeCatInit = Math.max(10, catalogInitialLimit || 150)
      const safeCatBatch = Math.max(10, catalogScrollBatch || 150)
      const safeModalInit = Math.max(10, modalInitialLimit || 150)
      const safeModalBatch = Math.max(10, modalScrollBatch || 150)

      const newConfig: CatalogConfig = {
        catalogAutoLoad,
        catalogInitialLimit: safeCatInit,
        catalogScrollBatch: safeCatBatch,
        modalAutoLoad,
        modalInitialLimit: safeModalInit,
        modalScrollBatch: safeModalBatch
      }
      await useCatalogStore.getState().updateConfig(newConfig)

      setInitialReasons([...reasons])
      setInitialExportPrefix(safePrefix)
      setExportPrefix(safePrefix)
      setInitialCatalogAutoLoad(catalogAutoLoad)
      setInitialCatalogInitialLimit(safeCatInit)
      setCatalogInitialLimit(safeCatInit)
      setInitialCatalogScrollBatch(safeCatBatch)
      setCatalogScrollBatch(safeCatBatch)
      setInitialModalAutoLoad(modalAutoLoad)
      setInitialModalInitialLimit(safeModalInit)
      setModalInitialLimit(safeModalInit)
      setInitialModalScrollBatch(safeModalBatch)
      setModalScrollBatch(safeModalBatch)

      return true
    } catch (err: any) {
      console.error('Error al guardar configuración de inventario:', err)
      return false
    }
  }, [
    reasons,
    exportPrefix,
    catalogAutoLoad,
    catalogInitialLimit,
    catalogScrollBatch,
    modalAutoLoad,
    modalInitialLimit,
    modalScrollBatch
  ])

  const handleDiscard = useCallback((): void => {
    setReasons([...initialReasons])
    setExportPrefix(initialExportPrefix)
    setCatalogAutoLoad(initialCatalogAutoLoad)
    setCatalogInitialLimit(initialCatalogInitialLimit)
    setCatalogScrollBatch(initialCatalogScrollBatch)
    setModalAutoLoad(initialModalAutoLoad)
    setModalInitialLimit(initialModalInitialLimit)
    setModalScrollBatch(initialModalScrollBatch)
  }, [
    initialReasons,
    initialExportPrefix,
    initialCatalogAutoLoad,
    initialCatalogInitialLimit,
    initialCatalogScrollBatch,
    initialModalAutoLoad,
    initialModalInitialLimit,
    initialModalScrollBatch
  ])

  // Track dirty changes
  useEffect(() => {
    if (!isLoaded) return

    const changes: DirtyFieldChange[] = []

    if (JSON.stringify(reasons) !== JSON.stringify(initialReasons)) {
      changes.push({
        field: 'Motivos Rápidos de Ajuste',
        value: `${reasons.length} motivos configurados`
      })
    }

    if (exportPrefix.trim() !== initialExportPrefix.trim()) {
      changes.push({
        field: 'Prefijo Exportación Excel',
        value: exportPrefix.trim() || 'Productos'
      })
    }

    if (catalogAutoLoad !== initialCatalogAutoLoad) {
      changes.push({
        field: 'Carga automática catálogo (F2)',
        value: catalogAutoLoad ? 'Activada' : 'Desactivada'
      })
    }

    if (catalogInitialLimit !== initialCatalogInitialLimit) {
      changes.push({
        field: 'Productos iniciales catálogo (F2)',
        value: `${catalogInitialLimit} unid.`
      })
    }

    if (catalogScrollBatch !== initialCatalogScrollBatch) {
      changes.push({
        field: 'Lote scroll catálogo (F2)',
        value: `${catalogScrollBatch} unid.`
      })
    }

    if (modalAutoLoad !== initialModalAutoLoad) {
      changes.push({
        field: 'Carga automática búsqueda modal (F10)',
        value: modalAutoLoad ? 'Activada' : 'Desactivada'
      })
    }

    if (modalInitialLimit !== initialModalInitialLimit) {
      changes.push({
        field: 'Resultados iniciales modal (F10)',
        value: `${modalInitialLimit} unid.`
      })
    }

    if (modalScrollBatch !== initialModalScrollBatch) {
      changes.push({
        field: 'Lote scroll modal (F10)',
        value: `${modalScrollBatch} unid.`
      })
    }

    const isDirty = changes.length > 0
    registerSubTabState(isDirty, changes, handleSave, handleDiscard)
  }, [
    isLoaded,
    reasons,
    initialReasons,
    exportPrefix,
    initialExportPrefix,
    catalogAutoLoad,
    initialCatalogAutoLoad,
    catalogInitialLimit,
    initialCatalogInitialLimit,
    catalogScrollBatch,
    initialCatalogScrollBatch,
    modalAutoLoad,
    initialModalAutoLoad,
    modalInitialLimit,
    initialModalInitialLimit,
    modalScrollBatch,
    initialModalScrollBatch,
    handleSave,
    handleDiscard,
    registerSubTabState
  ])

  const handleAddReason = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = newText.trim()
    if (!trimmed) return

    const trimmedShortcut = newShortcut.trim().toUpperCase()

    // Si asignó atajo, removerlo de otros motivos para evitar duplicados
    let updatedReasons = [...reasons]
    if (trimmedShortcut) {
      updatedReasons = updatedReasons.map((r) =>
        r.shortcut?.toUpperCase() === trimmedShortcut ? { ...r, shortcut: undefined } : r
      )
    }

    const newReason: QuickAdjustmentReason = {
      id: Date.now().toString(),
      text: trimmed,
      type: newType,
      ...(trimmedShortcut ? { shortcut: trimmedShortcut } : {})
    }

    setReasons([...updatedReasons, newReason])
    setNewText('')
    setNewShortcut('')
    setIsRecordingNewShortcut(false)
  }

  const handleDeleteReason = (id: string): void => {
    setReasons((prev) => prev.filter((r) => r.id !== id))
  }

  const handleToggleType = (id: string): void => {
    setReasons((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type: r.type === 'replace' ? 'append' : 'replace' } : r))
    )
  }

  const handleSetReasonShortcut = (id: string, shortcut: string | undefined): void => {
    const formatted = shortcut?.trim().toUpperCase()
    setReasons((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, shortcut: formatted || undefined }
        }
        // Desasignar si ya existía en otro motivo
        if (formatted && r.shortcut?.toUpperCase() === formatted) {
          return { ...r, shortcut: undefined }
        }
        return r
      })
    )
    setEditingShortcutId(null)
  }

  const handleRestoreDefaults = (): void => {
    setReasons([...DEFAULT_QUICK_REASONS])
  }

  const handleRestorePerformanceDefaults = (): void => {
    setCatalogAutoLoad(DEFAULT_CATALOG_CONFIG.catalogAutoLoad)
    setCatalogInitialLimit(DEFAULT_CATALOG_CONFIG.catalogInitialLimit)
    setCatalogScrollBatch(DEFAULT_CATALOG_CONFIG.catalogScrollBatch)
    setModalAutoLoad(DEFAULT_CATALOG_CONFIG.modalAutoLoad)
    setModalInitialLimit(DEFAULT_CATALOG_CONFIG.modalInitialLimit)
    setModalScrollBatch(DEFAULT_CATALOG_CONFIG.modalScrollBatch)
  }

  const mainReasons = reasons.filter((r) => r.type === 'replace')
  const complementReasons = reasons.filter((r) => r.type === 'append')

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Tarjeta Única: Motivos Rápidos de Ajuste de Inventario */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-lilac-100 dark:border-slate-700 p-6 shadow-sm space-y-5">
        {/* Cabecera compacta con título, subtítulo conciso y botón restablecer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-lilac-950/60 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Motivos Rápidos de Ajuste de Inventario
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-400">
                Botones de acceso rápido para ajuste de existencias con asignación de teclas de atajo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
            title="Restablecer motivos a los valores iniciales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer por Defecto</span>
          </button>
        </div>

        {/* Barra compacta para agregar nuevo motivo o complemento */}
        <form
          onSubmit={handleAddReason}
          className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-700/80"
        >
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Texto del motivo (ej: Merma por rotura, en bodega)..."
            className="flex-1 w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Grabador de tecla rápida */}
            <div className="relative shrink-0">
              {isRecordingNewShortcut ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-slate-800 border-2 border-amber-400 rounded-xl animate-pulse">
                  <Keyboard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Presiona tecla..."
                    onKeyDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (e.key === 'Escape') {
                        setIsRecordingNewShortcut(false)
                        return
                      }
                      const sc = eventToShortcut(e)
                      if (sc) {
                        setNewShortcut(sc)
                        setIsRecordingNewShortcut(false)
                      }
                    }}
                    onBlur={() => setIsRecordingNewShortcut(false)}
                    className="w-24 text-[11px] font-bold font-mono bg-transparent outline-none text-amber-900 dark:text-amber-200 placeholder:text-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsRecordingNewShortcut(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : newShortcut ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-semibold">Tecla:</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-xs text-lilac-700 dark:text-lilac-300">
                    {newShortcut}
                  </kbd>
                  <button
                    type="button"
                    onClick={() => setNewShortcut('')}
                    className="text-slate-400 hover:text-rose-500 ml-0.5 cursor-pointer"
                    title="Quitar tecla"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRecordingNewShortcut(true)}
                  className="px-2.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Asignar una tecla rápida a este motivo"
                >
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>+ Tecla</span>
                </button>
              )}
            </div>

            {/* Selector Tipo */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setNewType('replace')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  newType === 'replace'
                    ? 'bg-lilac-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Principal
              </button>
              <button
                type="button"
                onClick={() => setNewType('append')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  newType === 'append'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Añade
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!newText.trim()}
            className="w-full sm:w-auto px-4 py-2 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </form>

        {/* 1. Motivos Principales */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-lilac-700 dark:text-lilac-400 uppercase tracking-wider">
              Motivos Principales (Reemplazan todo)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 dark:bg-lilac-950/60 text-lilac-800 dark:text-lilac-300 border border-lilac-200/80 dark:border-lilac-800">
              {mainReasons.length}
            </span>
          </div>

          {mainReasons.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No hay motivos principales configurados.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mainReasons.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-lilac-50 hover:bg-lilac-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-lilac-900 dark:text-lilac-200 border border-lilac-200/80 dark:border-lilac-700/80 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{r.text}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botón / Grabador de Atajo de Teclado */}
                    {editingShortcutId === r.id ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg animate-pulse">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Presiona..."
                          onKeyDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (e.key === 'Escape') {
                              setEditingShortcutId(null)
                              return
                            }
                            const sc = eventToShortcut(e)
                            if (sc) {
                              handleSetReasonShortcut(r.id, sc)
                            }
                          }}
                          onBlur={() => setEditingShortcutId(null)}
                          className="w-16 text-[10px] font-mono font-bold bg-transparent outline-none text-amber-900 dark:text-amber-200 placeholder:text-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingShortcutId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : r.shortcut ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingShortcutId(r.id)}
                          className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-white dark:bg-slate-900 border border-lilac-300 dark:border-lilac-700 text-lilac-800 dark:text-lilac-200 hover:border-lilac-500 transition-colors shadow-2xs cursor-pointer"
                          title="Clic para cambiar tecla asignada"
                        >
                          {r.shortcut}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetReasonShortcut(r.id, undefined)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                          title="Quitar tecla asignada"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingShortcutId(r.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded-lg text-slate-400 hover:text-lilac-600 hover:bg-white/80 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Asignar tecla rápida"
                      >
                        + Tecla
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleType(r.id)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-lilac-100 dark:bg-lilac-950/70 hover:bg-lilac-200 dark:hover:bg-lilac-900 text-lilac-700 dark:text-lilac-300 border border-lilac-200 dark:border-lilac-800 transition-colors cursor-pointer"
                      title="Cambiar a Complemento"
                    >
                      Reemplaza
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReason(r.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Eliminar motivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Complementos */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Complementos / Detalles (Se van añadiendo con espacio)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
              {complementReasons.length}
            </span>
          </div>

          {complementReasons.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              No hay complementos configurados aún. ¡Agrega algunos arriba para armar frases (ej:
              &quot;en bodega&quot;, &quot;por vencimiento&quot;)!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {complementReasons.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-700/80 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{r.text}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botón / Grabador de Atajo de Teclado */}
                    {editingShortcutId === r.id ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg animate-pulse">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Presiona..."
                          onKeyDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (e.key === 'Escape') {
                              setEditingShortcutId(null)
                              return
                            }
                            const sc = eventToShortcut(e)
                            if (sc) {
                              handleSetReasonShortcut(r.id, sc)
                            }
                          }}
                          onBlur={() => setEditingShortcutId(null)}
                          className="w-16 text-[10px] font-mono font-bold bg-transparent outline-none text-amber-900 dark:text-amber-200 placeholder:text-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingShortcutId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : r.shortcut ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingShortcutId(r.id)}
                          className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
                          title="Clic para cambiar tecla asignada"
                        >
                          {r.shortcut}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetReasonShortcut(r.id, undefined)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                          title="Quitar tecla asignada"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingShortcutId(r.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-white/80 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Asignar tecla rápida"
                      >
                        + Tecla
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleType(r.id)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                      title="Cambiar a Principal"
                    >
                      Añade
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReason(r.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Eliminar complemento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Excel Export Configuration Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Exportación de Productos a Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configura el prefijo de archivo sugerido al exportar el catálogo completo de productos.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 sm:w-48 shrink-0">
            Prefijo de archivo por defecto:
          </label>
          <input
            type="text"
            value={exportPrefix}
            onChange={(e) => setExportPrefix(e.target.value)}
            placeholder="Productos"
            className="w-full sm:w-64 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all"
          />
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Nombre sugerido en Windows:</span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
            {exportPrefix.trim() || 'Productos'}_{new Date().toISOString().slice(0, 10)}.xlsx
          </span>
        </div>
      </div>

      {/* Performance & Pagination Configuration Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-lilac-100 dark:border-slate-700 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lilac-50 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Rendimiento y Carga de Productos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optimiza la fluidez y velocidad en computadores de menores recursos configurando la carga automática y el tamaño de los lotes de productos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRestorePerformanceDefaults}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Restablecer valores recomendados de rendimiento"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer por Defecto</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Card: Catálogo en Pestaña Productos (F2) */}
          <div className="bg-slate-50/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-700 pb-2.5">
              <Boxes className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Catálogo de Productos (Pestaña F2)
              </h4>
            </div>

            {/* Checkbox AutoLoad */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={catalogAutoLoad}
                onChange={(e) => setCatalogAutoLoad(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-lilac-600 focus:ring-lilac-500 accent-lilac-600 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Cargar productos automáticamente al entrar al catálogo
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Si se desactiva, el catálogo no cargará la lista completa al entrar, abriendo de inmediato y esperando a que busques, filtres o presiones "Cargar".
                </span>
              </div>
            </label>

            {/* Initial Limit */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Productos a cargar por defecto (inicial):</span>
                <span className="font-mono font-bold text-lilac-700 dark:text-lilac-300 text-xs">{catalogInitialLimit} unid.</span>
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={catalogInitialLimit}
                onChange={(e) => setCatalogInitialLimit(Math.max(10, parseInt(e.target.value, 10) || 10))}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Cantidad de productos que se muestran inicialmente en el catálogo (por defecto 150).
              </span>
            </div>

            {/* Scroll Batch */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Cargar al scrollear hacia abajo (lote):</span>
                <span className="font-mono font-bold text-lilac-700 dark:text-lilac-300 text-xs">{catalogScrollBatch} unid.</span>
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={catalogScrollBatch}
                onChange={(e) => setCatalogScrollBatch(Math.max(10, parseInt(e.target.value, 10) || 10))}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                De cuánto en cuánto se van cargando más productos al llegar al final del scroll (por defecto 150).
              </span>
            </div>
          </div>

          {/* Card: Modal Emergente de Búsqueda (F10) */}
          <div className="bg-slate-50/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-700 pb-2.5">
              <Search className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Ventana de Búsqueda (F10 / Modales)
              </h4>
            </div>

            {/* Checkbox AutoLoad */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={modalAutoLoad}
                onChange={(e) => setModalAutoLoad(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-lilac-600 focus:ring-lilac-500 accent-lilac-600 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Cargar productos automáticamente al abrir la ventana
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Si se desactiva, la ventana de búsqueda abre al instante sin demora, realizando la consulta únicamente cuando comiences a escribir.
                </span>
              </div>
            </label>

            {/* Initial Limit */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Productos a cargar por defecto (inicial):</span>
                <span className="font-mono font-bold text-lilac-700 dark:text-lilac-300 text-xs">{modalInitialLimit} unid.</span>
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={modalInitialLimit}
                onChange={(e) => setModalInitialLimit(Math.max(10, parseInt(e.target.value, 10) || 10))}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Cantidad máxima de resultados mostrados inicialmente al abrir o al buscar (por defecto 150).
              </span>
            </div>

            {/* Scroll Batch */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Cargar al scrollear hacia abajo (lote):</span>
                <span className="font-mono font-bold text-lilac-700 dark:text-lilac-300 text-xs">{modalScrollBatch} unid.</span>
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={modalScrollBatch}
                onChange={(e) => setModalScrollBatch(Math.max(10, parseInt(e.target.value, 10) || 10))}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-lilac-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                De cuánto en cuánto se van cargando más resultados al deslizar hacia abajo (por defecto 150).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
