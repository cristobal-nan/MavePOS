import React, { useState, useEffect } from 'react'
import {
  Boxes,
  Save,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  Info,
  Layers,
  FileText,
  FileSpreadsheet
} from 'lucide-react'
import { QuickAdjustmentReason, DEFAULT_QUICK_REASONS } from '@shared/types'

export const InventorySettingsTab: React.FC = () => {
  const [reasons, setReasons] = useState<QuickAdjustmentReason[]>([...DEFAULT_QUICK_REASONS])
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'replace' | 'append'>('replace')
  const [exportPrefix, setExportPrefix] = useState('Productos')
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((settings) => {
        if (!isMounted) return
        if (settings?.inventory_quick_reasons) {
          try {
            const parsed = JSON.parse(settings.inventory_quick_reasons)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setReasons(parsed)
            }
          } catch (e) {
            console.error('Error parseando inventory_quick_reasons:', e)
          }
        }
        if (settings?.excel_export_prefix) {
          setExportPrefix(settings.excel_export_prefix)
        }
      })
      .catch((err) => {
        console.error('Error al cargar configuración de inventario:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleAddReason = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = newText.trim()
    if (!trimmed) return

    const newReason: QuickAdjustmentReason = {
      id: Date.now().toString(),
      text: trimmed,
      type: newType
    }

    setReasons((prev) => [...prev, newReason])
    setNewText('')
    setSavedMessage(null)
  }

  const handleDeleteReason = (id: string): void => {
    setReasons((prev) => prev.filter((r) => r.id !== id))
    setSavedMessage(null)
  }

  const handleToggleType = (id: string): void => {
    setReasons((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type: r.type === 'replace' ? 'append' : 'replace' } : r))
    )
    setSavedMessage(null)
  }

  const handleRestoreDefaults = (): void => {
    setReasons([...DEFAULT_QUICK_REASONS])
    setSavedMessage(null)
  }

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    setSavedMessage(null)

    try {
      await window.api.setSetting('inventory_quick_reasons', JSON.stringify(reasons))
      await window.api.setSetting('excel_export_prefix', exportPrefix.trim() || 'Productos')
      setSavedMessage('Configuración de inventario y exportación guardada correctamente.')
    } catch (err: any) {
      console.error('Error al guardar configuración de inventario:', err)
      alert('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const mainReasons = reasons.filter((r) => r.type === 'replace')
  const complementReasons = reasons.filter((r) => r.type === 'append')

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Intro Header */}
      <div className="bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-50 text-lilac-600 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Motivos Rápidos de Ajuste de Inventario
            </h2>
            <p className="text-xs text-slate-500">
              Configura los botones de acceso rápido que aparecen al ajustar existencias. Puedes
              definir motivos que reemplazan el texto y complementos que se van añadiendo para
              formar una frase.
            </p>
          </div>
        </div>

        <div className="mt-3 p-3.5 bg-lilac-50/60 border border-lilac-100 rounded-2xl flex items-start gap-3">
          <Info className="w-4 h-4 text-lilac-600 shrink-0 mt-0.5" />
          <div className="text-xs text-lilac-900 leading-relaxed">
            <span className="font-bold">Comportamiento:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-lilac-800">
              <li>
                <strong>Motivo Principal (Reemplazar):</strong> Al hacer clic en la pantalla de
                ajuste, sustituye todo lo escrito por ese motivo.
              </li>
              <li>
                <strong>Complemento (Añadir a la frase):</strong> Al hacer clic, se agrega la
                palabra o detalle al texto actual separado por un espacio, permitiendo armar
                frases detalladas con varios clics.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add New Reason Card */}
      <div className="bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-lilac-600" />
          <span>Agregar Nuevo Motivo o Complemento</span>
        </h3>

        <form onSubmit={handleAddReason} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Texto del motivo (ej: Merma por rotura, en bodega)..."
            className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
          />

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setNewType('replace')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                newType === 'replace'
                  ? 'bg-lilac-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Principal (Reemplaza)
            </button>
            <button
              type="button"
              onClick={() => setNewType('append')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                newType === 'append'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Complemento (Añade)
            </button>
          </div>

          <button
            type="submit"
            disabled={!newText.trim()}
            className="w-full sm:w-auto px-4 py-2.5 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        </form>
      </div>

      {/* List of Configured Reasons */}
      <div className="bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-lilac-600" />
            <span>Motivos Configurados ({reasons.length})</span>
          </h3>

          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"
            title="Restablecer motivos a los valores iniciales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer por Defecto</span>
          </button>
        </div>

        {/* 1. Motivos Principales */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-lilac-700 uppercase tracking-wider">
              Motivos Principales (Reemplazan todo)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lilac-100 text-lilac-800">
              {mainReasons.length}
            </span>
          </div>

          {mainReasons.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No hay motivos principales configurados.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mainReasons.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-lilac-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 truncate">{r.text}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleType(r.id)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-lilac-100 hover:bg-lilac-200 text-lilac-700 transition-colors"
                      title="Cambiar a Complemento"
                    >
                      Reemplaza
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReason(r.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Complementos / Detalles (Se van añadiendo con espacio)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {complementReasons.length}
            </span>
          </div>

          {complementReasons.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No hay complementos configurados aún. ¡Agrega algunos arriba para armar frases (ej:
              &quot;en bodega&quot;, &quot;por vencimiento&quot;)!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {complementReasons.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50/50 border border-emerald-200/60 rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 truncate">{r.text}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleType(r.id)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                      title="Cambiar a Principal"
                    >
                      Añade
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReason(r.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

        {/* Success Message Banner */}
        {savedMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedMessage}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Configuración de Inventario'}</span>
          </button>
        </div>
      </div>

      {/* Excel Export Configuration Card */}
      <div className="bg-white p-6 rounded-3xl border border-lilac-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Exportación de Productos a Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-500">
              Configura el prefijo de archivo sugerido al exportar el catálogo completo de productos.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <label className="text-xs font-bold text-slate-700 sm:w-48 shrink-0">
            Prefijo de archivo por defecto:
          </label>
          <input
            type="text"
            value={exportPrefix}
            onChange={(e) => setExportPrefix(e.target.value)}
            placeholder="Productos"
            className="w-full sm:w-64 px-4 py-2 bg-slate-50 border border-slate-200 focus:border-lilac-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all"
          />
        </div>

        <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center gap-2">
          <span className="font-semibold text-slate-700">Nombre sugerido en Windows:</span>
          <span className="font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
            {exportPrefix.trim() || 'Productos'}_{new Date().toISOString().slice(0, 10)}.xlsx
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-lilac-600 hover:bg-lilac-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Prefijo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
