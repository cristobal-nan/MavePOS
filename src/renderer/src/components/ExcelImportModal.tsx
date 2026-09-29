import React, { useState } from 'react'
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  PlusCircle,
  HelpCircle,
  FolderPlus
} from 'lucide-react'
import { ExcelParsePreview, ImportReportResult } from '@shared/types'

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (report: ImportReportResult) => void
}

type ImportStep = 'select' | 'preview' | 'importing' | 'result'

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<ImportStep>('select')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [previewData, setPreviewData] = useState<ExcelParsePreview | null>(null)
  const [reportResult, setReportResult] = useState<ImportReportResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  if (!isOpen) return null

  const resetState = (): void => {
    setStep('select')
    setFilePath(null)
    setFileName('')
    setPreviewData(null)
    setReportResult(null)
    setError(null)
    setIsParsing(false)
    setIsImporting(false)
  }

  const handleClose = (): void => {
    resetState()
    onClose()
  }

  const handleProcessFile = async (path: string, name: string): Promise<void> => {
    setIsParsing(true)
    setError(null)
    try {
      setFilePath(path)
      setFileName(name)
      const preview = await window.api.parseExcelFile(path)
      setPreviewData(preview)
      setStep('preview')
    } catch (err: any) {
      console.error('Error al analizar archivo Excel:', err)
      setError(err.message || 'No se pudo leer el archivo Excel.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleSelectFile = async (): Promise<void> => {
    try {
      const selectedPath = await window.api.selectExcelFile()
      if (selectedPath) {
        const name = selectedPath.split(/[\\/]/).pop() || 'archivo.xlsx'
        await handleProcessFile(selectedPath, name)
      }
    } catch (err: any) {
      console.error('Error seleccionando archivo:', err)
      setError(err.message || 'Error al abrir el diálogo de selección de archivo.')
    }
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setIsDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // In electron renderer, File objects have a 'path' property
        const electronFile = file as any
        if (electronFile.path) {
          await handleProcessFile(electronFile.path, file.name)
        } else {
          setError('No se pudo obtener la ruta local del archivo arrastrado. Usa el botón para seleccionarlo.')
        }
      } else {
        setError('El archivo debe tener formato Excel (.xlsx o .xls).')
      }
    }
  }

  const handleStartImport = async (): Promise<void> => {
    if (!filePath) return

    setIsImporting(true)
    setStep('importing')
    setError(null)

    try {
      const report = await window.api.importExcelFile(filePath)
      setReportResult(report)
      setStep('result')
      onSuccess(report)
    } catch (err: any) {
      console.error('Error durante la importación:', err)
      setError(err.message || 'Error al importar productos.')
      setStep('preview')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-lilac-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Importación de Catálogo desde Excel
              </h2>
              <p className="text-xs text-slate-500">
                Carga masiva, upsert por código, reemplazo de existencia y auditoría de inventario
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isImporting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* ---------------- STEP 1: Select File ---------------- */}
          {step === 'select' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                  isDragOver
                    ? 'border-lilac-500 bg-lilac-50/70 scale-[0.99]'
                    : 'border-slate-200 hover:border-lilac-300 bg-slate-50/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-lilac-100 text-lilac-600 flex items-center justify-center mb-3.5 shadow-sm">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <h3 className="text-base font-bold text-slate-800 mb-1">
                  Arrastra tu archivo Excel aquí
                </h3>
                <p className="text-xs text-slate-500 mb-5 max-w-sm">
                  Soporta formatos <span className="font-semibold text-slate-700">.xlsx</span> y{' '}
                  <span className="font-semibold text-slate-700">.xls</span> con más de 10.000 productos.
                </p>

                <button
                  type="button"
                  onClick={handleSelectFile}
                  disabled={isParsing}
                  className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-lilac-500/20 cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isParsing ? 'Analizando archivo...' : 'Seleccionar archivo desde el equipo'}</span>
                </button>
              </div>

              {/* Information Box */}
              <div className="bg-lilac-50/60 border border-lilac-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-lilac-900 mb-2">
                  <HelpCircle className="w-4 h-4 text-lilac-600" />
                  <span>Estructura de Columnas Reconocida</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-lilac-700 block">Código *</span>
                    Identificador único (upsert)
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-lilac-700 block">Producto *</span>
                    Nombre del artículo
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-lilac-700 block">P. Venta *</span>
                    Precio de venta CLP
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-lilac-700 block">Existencia *</span>
                    Reemplaza el stock actual
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-slate-700 block">P. Costo</span>
                    Costo de compra (opcional)
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-slate-700 block">Inv. Mínimo</span>
                    Alerta de stock bajo (opcional)
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-lilac-100">
                    <span className="font-bold text-slate-700 block">Departamento</span>
                    Crea categoría si no existe
                  </div>
                  <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-slate-400">
                    <span className="font-bold text-slate-500 block">P. Mayoreo / Máx.</span>
                    Ignoradas automáticamente
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 2: Preview & Confirmation ---------------- */}
          {step === 'preview' && previewData && (
            <div className="flex flex-col gap-4">
              {/* File Summary Header */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{fileName}</h4>
                    <span className="text-[11px] text-slate-500">
                      Hoja: <span className="font-semibold text-slate-700">"{previewData.sheetName}"</span> · Total detectado:{' '}
                      <span className="font-bold text-lilac-700">{previewData.totalRows.toLocaleString('es-CL')} productos</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Mapping Status */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Mapeo de Columnas Detectadas
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl border bg-emerald-50/60 border-emerald-200 text-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Código</span>
                    <span className="font-semibold text-emerald-900 truncate block">
                      ✓ {previewData.detectedMapping.code || 'No detectado'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-emerald-50/60 border-emerald-200 text-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Producto (Nombre)</span>
                    <span className="font-semibold text-emerald-900 truncate block">
                      ✓ {previewData.detectedMapping.name || 'No detectado'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-emerald-50/60 border-emerald-200 text-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">P. Venta</span>
                    <span className="font-semibold text-emerald-900 truncate block">
                      ✓ {previewData.detectedMapping.sale_price || 'No detectado'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-emerald-50/60 border-emerald-200 text-xs">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Existencia (Stock)</span>
                    <span className="font-semibold text-emerald-900 truncate block">
                      ✓ {previewData.detectedMapping.stock || 'No detectado'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">P. Costo</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {previewData.detectedMapping.cost_price ? `✓ ${previewData.detectedMapping.cost_price}` : 'Sin mapear (opcional)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Inv. Mínimo</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {previewData.detectedMapping.min_stock ? `✓ ${previewData.detectedMapping.min_stock}` : 'Sin mapear (opcional)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Departamento</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {previewData.detectedMapping.department ? `✓ ${previewData.detectedMapping.department}` : 'Sin mapear (opcional)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border bg-slate-100 border-slate-200 text-xs opacity-60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">P. Mayoreo / Máx.</span>
                    <span className="font-medium text-slate-500 truncate block">Descartadas</span>
                  </div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Vista Previa (Primeras {previewData.previewRows.length} filas)
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3">P. Venta</th>
                        <th className="py-2 px-3">P. Costo</th>
                        <th className="py-2 px-3">Stock</th>
                        <th className="py-2 px-3">Inv. Mín</th>
                        <th className="py-2 px-3">Departamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewData.previewRows.map((row, idx) => {
                        const m = previewData.detectedMapping
                        const code = m.code ? row[m.code] : '-'
                        const name = m.name ? row[m.name] : '-'
                        const salePrice = m.sale_price ? row[m.sale_price] : '-'
                        const costPrice = m.cost_price ? row[m.cost_price] : '-'
                        const stock = m.stock ? row[m.stock] : '-'
                        const minStock = m.min_stock ? row[m.min_stock] : '-'
                        const dept = m.department ? row[m.department] : '-'

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-medium text-slate-800">{code}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-xs">{name}</td>
                            <td className="py-2 px-3 font-bold text-lilac-700">{salePrice}</td>
                            <td className="py-2 px-3 text-slate-500">{costPrice || '-'}</td>
                            <td className="py-2 px-3 font-bold text-slate-700">{stock}</td>
                            <td className="py-2 px-3 text-slate-500">{minStock || '0'}</td>
                            <td className="py-2 px-3 text-slate-600">{dept || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 3: Importing in progress ---------------- */}
          {step === 'importing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full border-4 border-lilac-200 border-t-lilac-600 animate-spin mb-4" />
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Importando productos al catálogo...
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Procesando en una transacción ultrarrápida. Por favor, no cierres la ventana.
              </p>
            </div>
          )}

          {/* ---------------- STEP 4: Results Report ---------------- */}
          {step === 'result' && reportResult && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">
                    ¡Importación completada con éxito!
                  </h3>
                  <p className="text-xs text-emerald-700">
                    Se procesaron {reportResult.totalRows.toLocaleString('es-CL')} productos del archivo Excel en la base de datos.
                  </p>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nuevos Creados</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600">
                    +{reportResult.createdCount.toLocaleString('es-CL')}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Actualizados</span>
                  </div>
                  <div className="text-2xl font-black text-blue-600">
                    ↻ {reportResult.updatedCount.toLocaleString('es-CL')}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <FolderPlus className="w-3.5 h-3.5 text-lilac-600" />
                    <span>Deptos. Creados</span>
                  </div>
                  <div className="text-2xl font-black text-lilac-600">
                    {reportResult.departmentsCreated.toLocaleString('es-CL')}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Omitidos / Error</span>
                  </div>
                  <div className="text-2xl font-black text-amber-600">
                    {reportResult.skippedCount.toLocaleString('es-CL')}
                  </div>
                </div>
              </div>

              {/* Warning/Errors list if any */}
              {reportResult.errors && reportResult.errors.length > 0 && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Filas omitidas durante la importación ({reportResult.errors.length})</span>
                  </h4>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {reportResult.errors.map((err, i) => (
                      <li key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="font-bold">Fila #{err.row}:</span>
                        <span>{err.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          {step === 'select' && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={resetState}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={isImporting}
                className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-lilac-500/25 flex items-center gap-2 cursor-pointer"
              >
                <span>Iniciar Importación</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-lilac-500/25 cursor-pointer"
            >
              Aceptar y ver en Catálogo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
