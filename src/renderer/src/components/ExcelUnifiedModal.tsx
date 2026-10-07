import React, { useState } from 'react'
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Layers,
  FileDown,
  Info
} from 'lucide-react'
import { ExcelParsePreview, ImportReportResult } from '@shared/types'
import { useModalStack } from '../utils/modalStack'

interface ExcelUnifiedModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (report: ImportReportResult) => void
  selectedCount?: number
  onExportAll: () => Promise<void>
  onExportSelected?: () => Promise<void>
  isExporting: boolean
  exportSuccessInfo: { filePath: string; totalExported: number } | null
  exportError: string | null
  onClearExportFeedback?: () => void
}

type TabMode = 'import' | 'export'
type ImportStep = 'select' | 'preview' | 'importing' | 'result'

export const ExcelUnifiedModal: React.FC<ExcelUnifiedModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedCount = 0,
  onExportAll,
  onExportSelected,
  isExporting,
  exportSuccessInfo,
  exportError,
  onClearExportFeedback
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('import')
  const [step, setStep] = useState<ImportStep>('select')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [previewData, setPreviewData] = useState<ExcelParsePreview | null>(null)
  const [reportResult, setReportResult] = useState<ImportReportResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const resetImportState = (): void => {
    setStep('select')
    setFilePath(null)
    setFileName('')
    setPreviewData(null)
    setReportResult(null)
    setImportError(null)
    setIsParsing(false)
    setIsImporting(false)
  }

  const handleClose = (): void => {
    resetImportState()
    onClearExportFeedback?.()
    onClose()
  }

  const { handleBackdropClick } = useModalStack({
    id: 'excel-unified-modal',
    isOpen,
    onClose: handleClose,
    closeOnBackdrop: true
  })

  if (!isOpen) return null

  const handleProcessFile = async (path: string, name: string): Promise<void> => {
    setIsParsing(true)
    setImportError(null)
    try {
      const data = await window.api.catalog.parseExcelFile(path)
      setFilePath(path)
      setFileName(name)
      setPreviewData(data)
      setStep('preview')
    } catch (err: any) {
      console.error('Error al analizar archivo Excel:', err)
      setImportError(err.message || 'Error al leer el archivo Excel seleccionado.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleSelectFile = async (): Promise<void> => {
    try {
      const selected = await window.api.catalog.selectExcelFile()
      if (selected) {
        const name = selected.split(/[\\/]/).pop() || 'archivo.xlsx'
        await handleProcessFile(selected, name)
      }
    } catch (err: any) {
      console.error('Error seleccionando archivo:', err)
      setImportError(err.message || 'Error al abrir el selector de archivos.')
    }
  }

  const handleConfirmImport = async (): Promise<void> => {
    if (!filePath) return
    setStep('importing')
    setIsImporting(true)
    setImportError(null)

    try {
      const result = await window.api.catalog.importExcelFile(filePath)
      setReportResult(result)
      setStep('result')
      onSuccess(result)
    } catch (err: any) {
      console.error('Error durante la importación:', err)
      setImportError(err.message || 'Ocurrió un error inesperado al importar los productos.')
      setStep('preview')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Mode Switcher */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Gestión de Catálogo en Excel</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Importa o exporta productos en formato compatible (.xlsx)</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('import')
                onClearExportFeedback?.()
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 shadow-xs border-slate-200 dark:border-slate-600'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Importar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('export')
                onClearExportFeedback?.()
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 shadow-xs border-slate-200 dark:border-slate-600'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'export' ? (
          /* =================== EXPORT TAB =================== */
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
            <div className="bg-lilac-50/60 dark:bg-slate-800/80 border border-lilac-200 dark:border-slate-700 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-lilac-600 dark:text-lilac-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1">
                <p className="font-semibold text-lilac-900 dark:text-lilac-200">Exportación estructurada de productos</p>
                <p>
                  El archivo generado conserva la estructura completa del catálogo: Código, Nombre, Tipo,
                  Producto Padre, Atributo, Valor Atributo, Precios de Costo y Venta, Existencia actual y Proveedores.
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  La columna de códigos se almacena como texto para conservar siempre los ceros iniciales.
                </p>
              </div>
            </div>

            {/* Export Success Message */}
            {exportSuccessInfo && (
              <div className="bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      ¡Exportación completada exitosamente!
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Se exportaron <strong>{exportSuccessInfo.totalExported}</strong> productos a:{' '}
                      <span className="font-mono">{exportSuccessInfo.filePath}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.api.catalog.openContainingFolder(exportSuccessInfo.filePath)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  Abrir carpeta
                </button>
              </div>
            )}

            {/* Export Error */}
            {exportError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Export Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Export Complete Catalog */}
              <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-lilac-300 dark:hover:border-slate-600 transition-all flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-lilac-100 dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 flex items-center justify-center mb-3">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Exportar Catálogo Completo</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Descarga todos los productos activos (simples y variaciones) registrados en el sistema.
                  </p>
                </div>
                <div className="mt-5">
                  <button
                    onClick={onExportAll}
                    disabled={isExporting}
                    className="w-full py-2.5 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>{isExporting ? 'Exportando catálogo...' : 'Exportar Todo a Excel'}</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Export Selected Products */}
              <div
                className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between shadow-xs ${
                  selectedCount > 0
                    ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/20 dark:bg-slate-800 hover:border-indigo-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 opacity-75'
                }`}
              >
                <div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      selectedCount > 0
                        ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Exportar Productos Seleccionados</h3>
                    {selectedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {selectedCount} seleccionados
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Exporta únicamente los productos marcados con casillas en la tabla de Catálogo para
                    editarlos o reimportarlos posteriormente.
                  </p>
                </div>
                <div className="mt-5">
                  <button
                    onClick={onExportSelected}
                    disabled={isExporting || selectedCount === 0 || !onExportSelected}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>
                      {selectedCount > 0
                        ? `Exportar Seleccionados (${selectedCount})`
                        : 'No hay productos seleccionados'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =================== IMPORT TAB =================== */
          <div className="flex-1 p-6 overflow-y-auto flex flex-col">
            {/* Informational Callout on SKU / Duplicate handling */}
            <div className="mb-4 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-snug">
                <strong>Lógica de importación por SKU/Código:</strong> Si un producto del archivo Excel ya
                existe en el sistema, <u>actualiza sus datos</u> (nombre, precios, categoría, proveedores) y
                reemplaza su stock registrando el movimiento de auditoría. Si el código no existe, <u>lo crea nuevo</u>.
                Los productos existentes que no estén en el archivo <strong>no se eliminan ni modifican</strong>.
              </div>
            </div>

            {importError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{importError}</span>
              </div>
            )}

            {/* Step 1: Select File */}
            {step === 'select' && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault()
                    setIsDragOver(false)
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0]
                      const path = (file as any).path
                      if (path) {
                        await handleProcessFile(path, file.name)
                      }
                    }
                  }}
                  onClick={handleSelectFile}
                  className={`w-full max-w-lg border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-lilac-500 bg-lilac-50/50 scale-[1.01]'
                      : 'border-slate-200 dark:border-slate-700 hover:border-lilac-400 dark:hover:border-lilac-500 bg-white dark:bg-slate-800/40 hover:bg-lilac-50/20'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-4 shadow-sm">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Arrastra aquí tu archivo Excel o haz clic para buscar
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Formatos soportados: <strong>.xlsx</strong> y <strong>.xls</strong>.
                  </p>
                  <button
                    type="button"
                    disabled={isParsing}
                    className="mt-6 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    {isParsing ? 'Analizando archivo...' : 'Seleccionar Archivo'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Preview & Confirm */}
            {step === 'preview' && previewData && (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Archivo seleccionado:</span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">{fileName}</h4>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-lilac-100 dark:bg-slate-700 text-lilac-800 dark:text-lilac-300 border border-lilac-200 dark:border-slate-600">
                    {previewData.totalRows} filas detectadas
                  </span>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {previewData.headers.map((h, i) => (
                          <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {previewData.previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          {previewData.headers.map((h, cIdx) => (
                            <td key={cIdx} className="py-2 px-3 truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                              {row[h] !== undefined ? String(row[h]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={resetImportState}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Elegir otro archivo
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>Confirmar e Importar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Importing */}
            {step === 'importing' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-4 animate-spin">
                  <RotateCcw className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Procesando catálogo...</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Actualizando productos existentes y agregando nuevos en la base de datos.
                </p>
              </div>
            )}

            {/* Step 4: Result */}
            {step === 'result' && reportResult && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">¡Importación completada!</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 w-full max-w-md">
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs text-slate-400 dark:text-slate-400 block font-medium">Nuevos Creados</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{reportResult.createdCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs text-slate-400 dark:text-slate-400 block font-medium">Actualizados</span>
                    <span className="text-xl font-bold text-lilac-600 dark:text-lilac-400">{reportResult.updatedCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-xs text-slate-400 dark:text-slate-400 block font-medium">Total Filas</span>
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{reportResult.totalRows}</span>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="mt-6 px-6 py-2.5 bg-slate-900 hover:bg-black dark:bg-lilac-600 dark:hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Cerrar Ventana
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
