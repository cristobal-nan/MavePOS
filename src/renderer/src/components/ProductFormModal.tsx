import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Save,
  Package,
  Layers,
  DollarSign,
  Boxes,
  GitBranch,
  Plus,
  Trash2,
  Truck,
  AlertTriangle
} from 'lucide-react'
import { ProductInput, ProductSearchResult, ProductType } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { parseCLP } from '../utils/formatters'
import { useModalStack } from '../utils/modalStack'

interface VariationRow {
  id?: number
  attributeValue: string
  code: string
  salePrice: string
  costPrice: string
  stock: string
  minStock: string
}

interface ProductFormModalProps {
  product?: ProductSearchResult | null
  isOpen: boolean
  onClose: () => void
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  isOpen,
  onClose
}) => {
  const { categories, suppliers, saveSupplier, saveProduct, saveVariableProduct, getVariations } = useCatalogStore()

  const [productType, setProductType] = useState<ProductType>('simple')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [parentName, setParentName] = useState('')
  const [attributeValue, setAttributeValue] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set())
  const [isAddingSupplierInline, setIsAddingSupplierInline] = useState(false)
  const [newInlineSupplierName, setNewInlineSupplierName] = useState('')
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('5')

  // Variable product fields
  const [attributeName, setAttributeName] = useState('Color')
  const [variations, setVariations] = useState<VariationRow[]>([])

  // Parent product general editable fields for variable products
  const [parentSalePrice, setParentSalePrice] = useState('')
  const [parentCostPrice, setParentCostPrice] = useState('')
  const [parentMinStock, setParentMinStock] = useState('5')

  const initialParentSnapshot = useRef<{
    parentName: string
    attributeName: string
    categoryId: number | null
    supplierIds: number[]
    salePrice: string
    costPrice: string
    minStock: string
  } | null>(null)

  const [isConfirmParentModalOpen, setIsConfirmParentModalOpen] = useState(false)
  const [detectedParentChanges, setDetectedParentChanges] = useState<{ field: string; from: string; to: string }[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditingVariation = Boolean(product && (product.product_type === 'variation' || product.parent_id))
  const isEditingSimple = Boolean(product && product.product_type === 'simple')

  useEffect(() => {
    if (product) {
      const pType = product.product_type || (product.parent_id ? 'variation' : 'simple')
      setProductType(pType)
      setCode(product.code || '')
      setName(product.name || '')
      setSalePrice(product.sale_price ? product.sale_price.toLocaleString('es-CL') : '')
      setCostPrice(product.cost_price ? product.cost_price.toLocaleString('es-CL') : '')
      setAttributeName(product.attribute_name || 'Color')
      setAttributeValue(product.attribute_value || '')
      setStock(product.stock !== undefined ? product.stock.toString() : '0')
      setMinStock(product.min_stock !== undefined ? product.min_stock.toString() : '5')
      setSelectedCategoryId(product.category_id || null)

      // Resolve suppliers
      const supIds = product.supplier_ids || product.suppliers?.map((s) => s.id) || []
      setSelectedSupplierIds(new Set(supIds))

      if (product.parent_id) {
        setParentName(product.parent_name || '')
        window.api.getProductById(product.parent_id).then((parentProd) => {
          if (parentProd) {
            const pSale = parentProd.sale_price ? parentProd.sale_price.toLocaleString('es-CL') : (product.sale_price ? product.sale_price.toLocaleString('es-CL') : '')
            const pCost = parentProd.cost_price ? parentProd.cost_price.toLocaleString('es-CL') : (product.cost_price ? product.cost_price.toLocaleString('es-CL') : '')
            const pMinStock = parentProd.min_stock !== undefined && parentProd.min_stock !== null ? parentProd.min_stock.toString() : (product.min_stock !== undefined ? product.min_stock.toString() : '5')
            const pCat = parentProd.category_id || product.category_id || null
            const pAttr = parentProd.attribute_name || 'Color'
            const pSups = parentProd.supplier_ids && parentProd.supplier_ids.length > 0 ? parentProd.supplier_ids : supIds

            setParentName(parentProd.name)
            setSelectedCategoryId(pCat)
            setAttributeName(pAttr)
            setSelectedSupplierIds(new Set(pSups))
            setParentSalePrice(pSale)
            setParentCostPrice(pCost)
            setParentMinStock(pMinStock)

            initialParentSnapshot.current = {
              parentName: parentProd.name,
              attributeName: pAttr,
              categoryId: pCat,
              supplierIds: Array.from(new Set(pSups)).sort((a, b) => a - b),
              salePrice: pSale,
              costPrice: pCost,
              minStock: pMinStock
            }
          }
        })
      } else if (product.id && supIds.length === 0) {
        window.api.getProductById(product.id).then((fullProd) => {
          if (fullProd?.supplier_ids && fullProd.supplier_ids.length > 0) {
            setSelectedSupplierIds(new Set(fullProd.supplier_ids))
          }
        })
      }

      // If variable product container
      if (product.product_type === 'variable' && product.id) {
        const pSale = product.sale_price ? product.sale_price.toLocaleString('es-CL') : ''
        const pCost = product.cost_price ? product.cost_price.toLocaleString('es-CL') : ''
        const pMinStock = product.min_stock !== undefined ? product.min_stock.toString() : '5'
        const pCat = product.category_id || null
        const pAttr = product.attribute_name || 'Color'
        const pSups = product.supplier_ids || supIds || []

        setParentName(product.name)
        setParentSalePrice(pSale)
        setParentCostPrice(pCost)
        setParentMinStock(pMinStock)

        initialParentSnapshot.current = {
          parentName: product.name,
          attributeName: pAttr,
          categoryId: pCat,
          supplierIds: Array.from(new Set(pSups)).sort((a, b) => a - b),
          salePrice: pSale,
          costPrice: pCost,
          minStock: pMinStock
        }

        getVariations(product.id).then((vars) => {
          setVariations(
            vars.map((v) => ({
              id: v.id,
              attributeValue: v.attribute_value || '',
              code: v.code || '',
              salePrice: v.sale_price ? v.sale_price.toLocaleString('es-CL') : '',
              costPrice: v.cost_price ? v.cost_price.toLocaleString('es-CL') : '',
              stock: v.stock.toString(),
              minStock: v.min_stock.toString()
            }))
          )
        })
      } else if (!product.parent_id) {
        setVariations([])
      }
    } else {
      // Clear form for new product
      setProductType('simple')
      setCode('')
      setName('')
      setParentName('')
      setAttributeValue('')
      setSalePrice('')
      setCostPrice('')
      setSelectedCategoryId(null)
      setSelectedSupplierIds(new Set())
      setAttributeName('Color')
      setStock('0')
      setMinStock('5')
      setParentSalePrice('')
      setParentCostPrice('')
      setParentMinStock('5')
      initialParentSnapshot.current = null
      setIsConfirmParentModalOpen(false)
      setDetectedParentChanges([])
      setVariations([
        {
          attributeValue: '',
          code: '',
          salePrice: '',
          costPrice: '',
          stock: '0',
          minStock: '5'
        }
      ])
    }
    setIsAddingSupplierInline(false)
    setNewInlineSupplierName('')
    setError(null)
  }, [product, categories, isOpen, getVariations])

  useModalStack({
    id: 'product-form-modal',
    isOpen: isOpen && !isConfirmParentModalOpen,
    onClose,
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'product-form-confirm-parent-modal',
    isOpen: isConfirmParentModalOpen,
    onClose: () => setIsConfirmParentModalOpen(false),
    closeOnBackdrop: false
  })

  const handleAddInlineSupplier = async (): Promise<void> => {
    const trimmed = newInlineSupplierName.trim()
    if (!trimmed) return
    try {
      const newSup = await saveSupplier(trimmed)
      setSelectedSupplierIds((prev) => new Set([...prev, newSup.id]))
      setNewInlineSupplierName('')
      setIsAddingSupplierInline(false)
    } catch (err: any) {
      setError(err.message || 'Error al agregar proveedor.')
    }
  }

  if (!isOpen) return null

  const handleAddVariation = (): void => {
    setVariations([
      ...variations,
      {
        attributeValue: '',
        code: '',
        salePrice: salePrice || '',
        costPrice: costPrice || '',
        stock: '0',
        minStock: minStock || '5'
      }
    ])
  }

  const handleRemoveVariation = (index: number): void => {
    setVariations(variations.filter((_, i) => i !== index))
  }

  const handleVariationChange = (index: number, field: keyof VariationRow, value: string): void => {
    const updated = [...variations]
    const finalValue = field === 'code' ? value.toUpperCase() : value
    updated[index] = { ...updated[index], [field]: finalValue }
    setVariations(updated)
  }

  const handleParentSalePriceChange = (valStr: string): void => {
    const val = parseCLP(valStr)
    const formatted = val === 0 && !valStr.trim() ? '' : val.toLocaleString('es-CL')
    setParentSalePrice(formatted)

    const currentVarPrice = parseCLP(salePrice)
    const initialParentPrice = initialParentSnapshot.current ? parseCLP(initialParentSnapshot.current.salePrice) : 0
    if (currentVarPrice === 0 || currentVarPrice === initialParentPrice) {
      setSalePrice(formatted)
    }
  }

  const handleParentCostPriceChange = (valStr: string): void => {
    const val = parseCLP(valStr)
    const formatted = val === 0 && !valStr.trim() ? '' : val.toLocaleString('es-CL')
    setParentCostPrice(formatted)

    const currentVarCost = costPrice.trim() ? parseCLP(costPrice) : null
    const initialParentCost = initialParentSnapshot.current && initialParentSnapshot.current.costPrice.trim()
      ? parseCLP(initialParentSnapshot.current.costPrice)
      : null
    if (currentVarCost === null || currentVarCost === initialParentCost) {
      setCostPrice(formatted)
    }
  }

  const handleParentMinStockChange = (valStr: string): void => {
    setParentMinStock(valStr)

    const currentVarMin = parseInt(minStock, 10) || 0
    const initialParentMin = initialParentSnapshot.current ? parseInt(initialParentSnapshot.current.minStock, 10) || 0 : 5
    if (currentVarMin === 0 || currentVarMin === initialParentMin) {
      setMinStock(valStr)
    }
  }

  const getParentChanges = (): { field: string; from: string; to: string }[] => {
    if (!initialParentSnapshot.current) return []
    const initial = initialParentSnapshot.current
    const changes: { field: string; from: string; to: string }[] = []

    if (parentName.trim() !== initial.parentName.trim()) {
      changes.push({
        field: 'Nombre del Padre',
        from: initial.parentName || '(Vacío)',
        to: parentName.trim()
      })
    }

    if (attributeName.trim() !== initial.attributeName.trim()) {
      changes.push({
        field: 'Nombre del Atributo',
        from: initial.attributeName || 'Color',
        to: attributeName.trim()
      })
    }

    if (selectedCategoryId !== initial.categoryId) {
      const oldCatName = categories.find((c) => c.id === initial.categoryId)?.name || 'Sin Categoría'
      const newCatName = categories.find((c) => c.id === selectedCategoryId)?.name || 'Sin Categoría'
      changes.push({
        field: 'Categoría',
        from: oldCatName,
        to: newCatName
      })
    }

    const currentSupArray = Array.from(selectedSupplierIds).sort((a, b) => a - b)
    const initialSupArray = [...initial.supplierIds].sort((a, b) => a - b)
    const supsChanged =
      currentSupArray.length !== initialSupArray.length ||
      currentSupArray.some((id, idx) => id !== initialSupArray[idx])

    if (supsChanged) {
      const oldSupNames = suppliers
        .filter((s) => initialSupArray.includes(s.id))
        .map((s) => s.name)
        .join(', ') || 'Ninguno'
      const newSupNames = suppliers
        .filter((s) => currentSupArray.includes(s.id))
        .map((s) => s.name)
        .join(', ') || 'Ninguno'
      changes.push({
        field: 'Proveedores',
        from: oldSupNames,
        to: newSupNames
      })
    }

    const parsedParentSale = parseCLP(parentSalePrice)
    const initialParentSale = parseCLP(initial.salePrice)
    if (parsedParentSale !== initialParentSale && parsedParentSale > 0) {
      changes.push({
        field: 'Precio de Venta Base',
        from: initialParentSale > 0 ? `$${initialParentSale.toLocaleString('es-CL')}` : 'Sin definir',
        to: `$${parsedParentSale.toLocaleString('es-CL')}`
      })
    }

    const parsedParentCost = parentCostPrice.trim() ? parseCLP(parentCostPrice) : null
    const initialParentCost = initial.costPrice.trim() ? parseCLP(initial.costPrice) : null
    if (parsedParentCost !== initialParentCost) {
      changes.push({
        field: 'Precio de Costo Base',
        from: initialParentCost !== null ? `$${initialParentCost.toLocaleString('es-CL')}` : 'Sin definir',
        to: parsedParentCost !== null ? `$${parsedParentCost.toLocaleString('es-CL')}` : 'Sin costo'
      })
    }

    const parsedParentMin = parseInt(parentMinStock, 10) || 0
    const initialParentMin = parseInt(initial.minStock, 10) || 0
    if (parsedParentMin !== initialParentMin) {
      changes.push({
        field: 'Inventario Mínimo General',
        from: `${initialParentMin} un.`,
        to: `${parsedParentMin} un.`
      })
    }

    return changes
  }

  const executeSave = async (syncVariations: boolean): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    const finalCategoryId = selectedCategoryId
    const supplierIdsArray = Array.from(selectedSupplierIds)

    try {
      const parsedParentSalePrice = parseCLP(parentSalePrice)
      const parsedParentCostPrice = parentCostPrice.trim() ? parseCLP(parentCostPrice) : null
      const parsedParentMinStock = parseInt(parentMinStock, 10) || 0

      // 1. Guardar y actualizar producto padre con sincronización si aplica
      await saveProduct({
        id: product!.parent_id!,
        name: parentName.trim(),
        product_type: 'variable',
        category_id: finalCategoryId,
        supplier_ids: supplierIdsArray,
        attribute_name: attributeName.trim(),
        sale_price: parsedParentSalePrice,
        cost_price: parsedParentCostPrice,
        min_stock: parsedParentMinStock,
        sync_variations: syncVariations
      })

      // 2. Guardar variación específica
      let finalVariationSalePrice = parseCLP(salePrice)
      if (syncVariations && parsedParentSalePrice > 0 && finalVariationSalePrice <= 0) {
        finalVariationSalePrice = parsedParentSalePrice
      }

      const variationInput: ProductInput = {
        id: product!.id,
        code: code.trim(),
        name: `${parentName.trim()} ${attributeValue.trim()}`,
        product_type: 'variation',
        parent_id: product!.parent_id,
        attribute_name: attributeName.trim(),
        attribute_value: attributeValue.trim(),
        sale_price: finalVariationSalePrice > 0 ? finalVariationSalePrice : parsedParentSalePrice,
        cost_price: costPrice.trim() ? parseCLP(costPrice) : parsedParentCostPrice,
        category_id: finalCategoryId,
        supplier_ids: supplierIdsArray,
        stock: parseInt(stock, 10) || 0,
        min_stock: parseInt(minStock, 10) >= 0 ? parseInt(minStock, 10) : parsedParentMinStock
      }

      await saveProduct(variationInput)
      setIsConfirmParentModalOpen(false)
      onClose()
    } catch (err: any) {
      console.error('Error guardando variación:', err)
      setError(err.message || 'Error al guardar variación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const finalCategoryId = selectedCategoryId
    const supplierIdsArray = Array.from(selectedSupplierIds)

    // CASO 1: Edición de una Variación de un Producto Variable
    if (isEditingVariation && product?.parent_id) {
      if (!parentName.trim()) {
        setError('El nombre del producto padre es obligatorio.')
        return
      }
      if (!attributeValue.trim()) {
        setError(`El valor del atributo (${attributeName}) es obligatorio.`)
        return
      }
      if (!code.trim()) {
        setError('El código de barras / SKU de la variación es obligatorio.')
        return
      }

      const parsedSalePrice = parseCLP(salePrice)
      if (parsedSalePrice <= 0 && parseCLP(parentSalePrice) <= 0) {
        setError('El precio de venta debe ser un número entero mayor a 0.')
        return
      }

      // Comprobar si hubo cambios en los datos del padre
      const changes = getParentChanges()
      if (changes.length > 0) {
        setDetectedParentChanges(changes)
        setIsConfirmParentModalOpen(true)
        return
      }

      // Si no hubo cambios en el padre, guardar directamente
      await executeSave(false)
      return
    }

    // CASO 2: Producto Simple
    if (productType === 'simple') {
      if (!name.trim()) {
        setError('El nombre del producto es obligatorio.')
        return
      }
      if (!code.trim()) {
        setError('El código de barras / SKU es obligatorio.')
        return
      }

      const parsedSalePrice = parseCLP(salePrice)
      if (parsedSalePrice <= 0) {
        setError('El precio de venta debe ser un número entero mayor a 0.')
        return
      }

      const parsedCostPrice = costPrice.trim() ? parseCLP(costPrice) : null
      const parsedStock = parseInt(stock, 10) || 0
      const parsedMinStock = parseInt(minStock, 10) || 0

      const input: ProductInput = {
        id: product?.id,
        code: code.trim(),
        name: name.trim(),
        product_type: 'simple',
        sale_price: parsedSalePrice,
        cost_price: parsedCostPrice,
        category_id: finalCategoryId,
        supplier_ids: supplierIdsArray,
        stock: parsedStock,
        min_stock: parsedMinStock
      }

      setIsSubmitting(true)
      try {
        await saveProduct(input)
        onClose()
      } catch (err: any) {
        console.error('Error guardando producto:', err)
        setError(err.message || 'Error al guardar producto.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // CASO 3: Nuevo Producto Variable (con tabla de variaciones)
    if (productType === 'variable') {
      if (!name.trim()) {
        setError('El nombre general del producto variable es obligatorio.')
        return
      }
      if (variations.length === 0) {
        setError('Un producto variable debe tener al menos una variación.')
        return
      }

      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]
        if (!v.attributeValue.trim()) {
          setError(`La variación #${i + 1} requiere un valor de atributo (ej: "Negro", "Azul").`)
          return
        }
        if (!v.code.trim()) {
          setError(`La variación "${v.attributeValue}" requiere un código de barras / SKU único.`)
          return
        }
        const vPrice = parseCLP(v.salePrice)
        if (vPrice <= 0) {
          setError(`El precio de venta de la variación "${v.attributeValue}" debe ser mayor a 0.`)
          return
        }
      }

      const parentInput: ProductInput = {
        id: product?.id,
        name: name.trim(),
        product_type: 'variable',
        category_id: finalCategoryId,
        supplier_ids: supplierIdsArray,
        attribute_name: attributeName.trim() || 'Color',
        sale_price: 0,
        stock: 0
      }

      const variationsInput: ProductInput[] = variations.map((v) => ({
        id: v.id,
        code: v.code.trim(),
        name: `${name.trim()} ${v.attributeValue.trim()}`,
        product_type: 'variation',
        attribute_name: attributeName.trim() || 'Color',
        attribute_value: v.attributeValue.trim(),
        sale_price: parseCLP(v.salePrice),
        cost_price: v.costPrice.trim() ? parseCLP(v.costPrice) : null,
        stock: parseInt(v.stock, 10) || 0,
        min_stock: parseInt(v.minStock, 10) || 0,
        category_id: finalCategoryId,
        supplier_ids: supplierIdsArray
      }))

      setIsSubmitting(true)
      try {
        await saveVariableProduct(parentInput, variationsInput)
        onClose()
      } catch (err: any) {
        console.error('Error guardando producto variable:', err)
        setError(err.message || 'Error al guardar producto variable.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-lilac-100 max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 select-text">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-lilac-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 text-lilac-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <span>
              {isEditingVariation
                ? 'Editar Producto Variable (Padre y Variación)'
                : isEditingSimple
                ? 'Editar Producto Simple'
                : 'Nuevo Producto'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Selector de Tipo (Simple vs Variable) - Solo al crear nuevo producto */}
          {!product && (
            <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setProductType('simple')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  productType === 'simple'
                    ? 'bg-white text-lilac-700 shadow-sm border border-lilac-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Producto Simple (SKU único)</span>
              </button>
              <button
                type="button"
                onClick={() => setProductType('variable')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  productType === 'variable'
                    ? 'bg-white text-lilac-700 shadow-sm border border-lilac-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Producto Variable (con Variaciones)</span>
              </button>
            </div>
          )}

          {/* CASO A: EDICIÓN DE UN PRODUCTO VARIABLE (PADRE + VARIACIÓN ESPECÍFICA) */}
          {isEditingVariation ? (
            <div className="space-y-5">
              {/* Parte 1: Producto Padre */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-lilac-600" />
                    <span>1. Datos del Producto Padre</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Contenedor General</span>
                </div>

                {/* Banner de Aviso */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Aviso importante:</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Al modificar cualquier dato del producto padre (nombre, categoría, proveedores, precios o inv. mínimo), se abrirá una confirmación para aplicar y sincronizar los cambios en todas las variaciones.
                    </p>
                  </div>
                </div>

                {/* Nombre Padre y Atributo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre del Producto Padre *
                    </label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Ej: Algodón Rústico"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Atributo General
                    </label>
                    <input
                      type="text"
                      value={attributeName}
                      onChange={(e) => setAttributeName(e.target.value)}
                      placeholder="Ej: Color, Talla"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 text-slate-700"
                    />
                  </div>
                </div>

                {/* Categoría Compartida */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-lilac-600" />
                    <span>Categoría</span>
                  </label>
                  <select
                    value={selectedCategoryId || ''}
                    onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                  >
                    <option value="">-- Sin categoría --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proveedores Compartidos */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-lilac-600" />
                      <span>Proveedores del Padre (compartidos por todas las variaciones)</span>
                    </label>
                    {!isAddingSupplierInline ? (
                      <button
                        type="button"
                        onClick={() => setIsAddingSupplierInline(true)}
                        className="text-xs text-lilac-600 hover:text-lilac-700 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Nuevo Proveedor</span>
                      </button>
                    ) : null}
                  </div>

                  {isAddingSupplierInline && (
                    <div className="flex items-center gap-2 p-2 bg-lilac-50 border border-lilac-200 rounded-lg">
                      <input
                        type="text"
                        value={newInlineSupplierName}
                        onChange={(e) => setNewInlineSupplierName(e.target.value)}
                        placeholder="Nombre del nuevo proveedor..."
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-lilac-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddInlineSupplier}
                        className="px-2.5 py-1 bg-lilac-600 hover:bg-lilac-700 text-white rounded text-xs font-bold transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingSupplierInline(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-0.5">
                    {suppliers.map((sup) => {
                      const isChecked = selectedSupplierIds.has(sup.id)
                      return (
                        <label
                          key={sup.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-lilac-500 border-lilac-600 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-lilac-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedSupplierIds)
                              if (e.target.checked) next.add(sup.id)
                              else next.delete(sup.id)
                              setSelectedSupplierIds(next)
                            }}
                            className="rounded text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 accent-lilac-600 cursor-pointer"
                          />
                          <span>{sup.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Precios e Inventario Mínimo Generales del Padre */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
                      <span>Precio de Venta Base (CLP)</span>
                    </label>
                    <input
                      type="text"
                      value={parentSalePrice}
                      onChange={(e) => handleParentSalePriceChange(e.target.value)}
                      placeholder="Ej: 3.500"
                      className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Precio general para las variaciones.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Precio de Costo Base (CLP)</span>
                    </label>
                    <input
                      type="text"
                      value={parentCostPrice}
                      onChange={(e) => handleParentCostPriceChange(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Costo base general.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Inv. Mínimo General</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={parentMinStock}
                      onChange={(e) => handleParentMinStockChange(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Alerta stock bajo para variaciones.
                    </span>
                  </div>
                </div>
              </div>

              {/* Parte 2: Variación Específica Seleccionada */}
              <div className="bg-lilac-50/40 border border-lilac-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-lilac-200/80 pb-2">
                  <span className="text-xs font-bold text-lilac-900 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-lilac-600" />
                    <span>2. Valores Específicos de la Variación</span>
                  </span>
                  <span className="text-xs font-bold text-lilac-700 bg-lilac-100 px-2.5 py-0.5 rounded-full">
                    {attributeValue || 'Sin valor'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Código de barras / SKU (Editable) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Código de Barras / SKU * (Editable)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Ej: 780123456"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono text-slate-900 font-bold focus:outline-none focus:border-lilac-500 uppercase"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Se actualizará conservando todo el historial en el kardex.
                    </span>
                  </div>

                  {/* Valor del Atributo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Valor de la Variación ({attributeName || 'Atributo'}) *
                    </label>
                    <input
                      type="text"
                      value={attributeValue}
                      onChange={(e) => setAttributeValue(e.target.value)}
                      placeholder="Ej: Azul Marino, Rojo, XL..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-lilac-500"
                    />
                  </div>
                </div>

                {/* Precios */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 rounded-xl border border-lilac-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
                      <span>Precio de Venta (CLP) *</span>
                    </label>
                    <input
                      type="text"
                      value={salePrice}
                      onChange={(e) => {
                        const val = parseCLP(e.target.value)
                        setSalePrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Precio de Costo (CLP opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={costPrice}
                      onChange={(e) => {
                        const val = parseCLP(e.target.value)
                        setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                      }}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                  </div>
                </div>

                {/* Stock y Stock Mínimo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-lilac-600" />
                      <span>Existencia Actual (Stock)</span>
                    </label>
                    <input
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Inventario Mínimo (Alerta)
                    </label>
                    <input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* CASO B: PRODUCTO SIMPLE O CREACIÓN NUEVA */
            <div className="space-y-4">
              {/* Nombre General */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {productType === 'variable' ? 'Nombre General del Producto Variable *' : 'Nombre del Producto *'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={productType === 'variable' ? 'Ej: Algodón Rústico' : 'Ej: Crochet Aluminio 4.0mm'}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 font-medium"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-lilac-600" />
                  <span>Categoría</span>
                </label>
                <select
                  value={selectedCategoryId || ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                >
                  <option value="">-- Sin categoría --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proveedores (Múltiples con Checkboxes) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-lilac-600" />
                    <span>Proveedores Asociados</span>
                  </label>
                  {!isAddingSupplierInline ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingSupplierInline(true)}
                      className="text-xs text-lilac-600 hover:text-lilac-700 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nuevo Proveedor</span>
                    </button>
                  ) : null}
                </div>

                {isAddingSupplierInline && (
                  <div className="flex items-center gap-2 p-2 bg-lilac-50 border border-lilac-200 rounded-lg">
                    <input
                      type="text"
                      value={newInlineSupplierName}
                      onChange={(e) => setNewInlineSupplierName(e.target.value)}
                      placeholder="Nombre del nuevo proveedor..."
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-lilac-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddInlineSupplier}
                      className="px-2.5 py-1 bg-lilac-600 hover:bg-lilac-700 text-white rounded text-xs font-bold transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingSupplierInline(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {suppliers.map((sup) => {
                    const isChecked = selectedSupplierIds.has(sup.id)
                    return (
                      <label
                        key={sup.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-lilac-500 border-lilac-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-lilac-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedSupplierIds)
                            if (e.target.checked) next.add(sup.id)
                            else next.delete(sup.id)
                            setSelectedSupplierIds(next)
                          }}
                          className="rounded text-lilac-600 focus:ring-lilac-500 w-3.5 h-3.5 accent-lilac-600 cursor-pointer"
                        />
                        <span>{sup.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* CAMPOS DE PRODUCTO SIMPLE */}
              {productType === 'simple' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Código (Ahora editable para simple y variable) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Código de Barras / SKU * (Editable)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Ej: 780123456"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-lilac-500 uppercase"
                    />
                    {product && (
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Si modificas el código, se mantendrán intactos los movimientos en el kardex y ventas pasadas.
                      </span>
                    )}
                  </div>

                  {/* Precios */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-lilac-50/50 p-4 rounded-xl border border-lilac-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
                        <span>Precio de Venta (CLP) *</span>
                      </label>
                      <input
                        type="text"
                        value={salePrice}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setSalePrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm font-bold text-slate-800 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span>Precio de Costo (CLP opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={costPrice}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="Opcional"
                        className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                  </div>

                  {/* Stock y Stock Mínimo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5 text-lilac-600" />
                        <span>Existencia Actual (Stock)</span>
                      </label>
                      <input
                        type="number"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Inventario Mínimo (Alerta)
                      </label>
                      <input
                        type="number"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS DE NUEVO PRODUCTO VARIABLE: CONFIGURAR PADRE + VALORES POR DEFECTO + TABLA VARIACIONES */}
              {productType === 'variable' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Nombre de Atributo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre del Atributo Diferenciador *
                    </label>
                    <input
                      type="text"
                      value={attributeName}
                      onChange={(e) => setAttributeName(e.target.value)}
                      placeholder="Ej: Color, Talla, Grosor"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500"
                    />
                  </div>

                  {/* Valores por defecto en el producto padre para prellenar variaciones */}
                  <div className="bg-lilac-50/60 border border-lilac-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-lilac-900 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-lilac-600" />
                        <span>Valores por defecto para las Variaciones</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Se asignarán por defecto al agregar nuevas variaciones
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Precio Venta por defecto (CLP)
                        </label>
                        <input
                          type="text"
                          value={salePrice}
                          onChange={(e) => {
                            const val = parseCLP(e.target.value)
                            setSalePrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                          }}
                          placeholder="Ej: 3.500"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-lilac-200 rounded-lg focus:outline-none focus:border-lilac-500 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Precio Costo por defecto (CLP)
                        </label>
                        <input
                          type="text"
                          value={costPrice}
                          onChange={(e) => {
                            const val = parseCLP(e.target.value)
                            setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                          }}
                          placeholder="Opcional"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Stock Mínimo por defecto
                        </label>
                        <input
                          type="number"
                          value={minStock}
                          onChange={(e) => setMinStock(e.target.value)}
                          min="0"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-lilac-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Barra de Agregar Variación */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-700">
                      Variaciones a registrar ({variations.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVariation}
                      className="px-3 py-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 border border-lilac-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Variación</span>
                    </button>
                  </div>

                  {/* Tabla de Variaciones */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Valor ({attributeName || 'Atributo'}) *</th>
                          <th className="p-2.5">Código / SKU *</th>
                          <th className="p-2.5">Precio Venta (CLP) *</th>
                          <th className="p-2.5">P. Costo</th>
                          <th className="p-2.5">Stock</th>
                          <th className="p-2.5">Mínimo</th>
                          <th className="p-2.5 text-center w-12">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {variations.map((v, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-2">
                              <input
                                type="text"
                                value={v.attributeValue}
                                onChange={(e) => handleVariationChange(idx, 'attributeValue', e.target.value)}
                                placeholder="Ej: Negro, Azul"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-lilac-500 font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={v.code}
                                onChange={(e) => handleVariationChange(idx, 'code', e.target.value)}
                                placeholder="Ej: 7801001"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-lilac-500 uppercase"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={v.salePrice}
                                onChange={(e) => {
                                  const val = parseCLP(e.target.value)
                                  handleVariationChange(
                                    idx,
                                    'salePrice',
                                    val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL')
                                  )
                                }}
                                placeholder="0"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-bold focus:outline-none focus:border-lilac-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={v.costPrice}
                                onChange={(e) => {
                                  const val = parseCLP(e.target.value)
                                  handleVariationChange(
                                    idx,
                                    'costPrice',
                                    val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL')
                                  )
                                }}
                                placeholder="Opcional"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-lilac-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={v.stock}
                                onChange={(e) => handleVariationChange(idx, 'stock', e.target.value)}
                                min="0"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-lilac-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={v.minStock}
                                onChange={(e) => handleVariationChange(idx, 'minStock', e.target.value)}
                                min="0"
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-lilac-500"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariation(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Eliminar variación"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-bold text-white bg-lilac-600 hover:bg-lilac-700 rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Producto'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Confirmación para Cambios en Producto Padre */}
      {isConfirmParentModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Confirmar Modificación Masiva</h3>
                  <p className="text-[11px] text-amber-800 font-medium">Producto Padre: {parentName}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmParentModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Has modificado los datos del producto padre. Los siguientes cambios se aplicarán y sincronizarán para <strong className="text-slate-900 font-bold">todas las variaciones</strong> de este producto:
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50 max-h-56 overflow-y-auto">
                {detectedParentChanges.map((change, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-700 shrink-0">{change.field}</span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-slate-400 line-through text-[11px]">{change.from}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-black text-lilac-700 bg-lilac-50 px-2 py-0.5 rounded border border-lilac-200">
                        {change.to}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  ¿Confirmas que deseas guardar y aplicar estos cambios a <strong>todas las variaciones</strong>?
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmParentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar y Revisar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => executeSave(true)}
                className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Sí, Aplicar a Todas las Variaciones'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
