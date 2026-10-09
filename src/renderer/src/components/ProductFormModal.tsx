import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Save,
  Package,
  DollarSign,
  Boxes,
  GitBranch,
  Plus,
  Trash2,
  AlertTriangle,
  Lock
} from 'lucide-react'
import { ProductInput, ProductSearchResult, ProductType } from '@shared/types'
import { useCatalogStore } from '../store/catalogStore'
import { useUIStore } from '../store/uiStore'
import { useInventoryStore } from '../store/inventoryStore'
import { parseCLP, capitalizeWords } from '../utils/formatters'
import { useModalStack } from '../utils/modalStack'
import { CategorySelectCard } from './CategorySelectCard'
import { SupplierSelectCard } from './SupplierSelectCard'

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
  const { categories, suppliers, saveProduct, saveVariableProduct, getVariations, deleteProduct } = useCatalogStore()

  // Modales de eliminación y validación de stock
  const [isStockBlockedModalOpen, setIsStockBlockedModalOpen] = useState(false)
  const [stockBlockedInfo, setStockBlockedInfo] = useState<{
    name: string
    code?: string
    stock: number
    productToAdjust?: ProductSearchResult
  } | null>(null)
  const [isConfirmDeleteProductModalOpen, setIsConfirmDeleteProductModalOpen] = useState(false)
  const [variationIndexToDelete, setVariationIndexToDelete] = useState<number | null>(null)

  // Modal de advertencia para edición directa de stock bloqueada
  const [isStockEditBlockedModalOpen, setIsStockEditBlockedModalOpen] = useState(false)
  const [stockEditBlockedTarget, setStockEditBlockedTarget] = useState<{
    name: string
    code: string
    stock: number
    productToAdjust: ProductSearchResult
  } | null>(null)
  const [editBlockedError, setEditBlockedError] = useState<string | null>(null)
  const initialVariationsSnapshot = useRef<VariationRow[]>([])

  const [productType, setProductType] = useState<ProductType>('simple')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  // Refs para navegación entre campos (código -> nombre)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const attributeValueInputRef = useRef<HTMLInputElement>(null)
  const variationAttrRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // Autofocus al campo de código al abrir para nuevo producto
  useEffect(() => {
    if (isOpen && !product) {
      const timer = setTimeout(() => {
        codeInputRef.current?.focus()
      }, 70)
      return () => clearTimeout(timer)
    }
  }, [isOpen, product, productType])
  const [parentName, setParentName] = useState('')
  const [attributeValue, setAttributeValue] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set())
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('5')

  // Variable product fields
  const [attributeName, setAttributeName] = useState('Color')
  const [variations, setVariations] = useState<VariationRow[]>([])
  const [focusVariationIndex, setFocusVariationIndex] = useState<number | null>(null)

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
  const [codeConflictName, setCodeConflictName] = useState<string | null>(null)
  const [variationCodeErrors, setVariationCodeErrors] = useState<Record<number, string>>({})

  // Auto-cerrar toast de error a los 4 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const isEditingVariation = Boolean(product && (product.product_type === 'variation' || product.parent_id))
  const isEditingSimple = Boolean(product && product.product_type === 'simple')

  const handleCodeBlur = async (): Promise<void> => {
    const trimmed = code.trim()
    if (!trimmed) {
      setCodeConflictName(null)
      return
    }
    try {
      const res = await window.api.catalog.checkProductCodeAvailable(trimmed, product?.id)
      if (!res.available) {
        setCodeConflictName(res.conflictProductName || 'Otro producto')
      } else {
        setCodeConflictName(null)
      }
    } catch (err) {
      console.error('Error al verificar disponibilidad del código:', err)
    }
  }

  const handleVariationCodeBlur = async (index: number): Promise<void> => {
    const v = variations[index]
    if (!v) return
    const trimmed = v.code.trim()
    if (!trimmed) {
      setVariationCodeErrors((prev) => {
        const next = { ...prev }
        delete next[index]
        return next
      })
      return
    }
    try {
      const res = await window.api.catalog.checkProductCodeAvailable(trimmed, v.id)
      setVariationCodeErrors((prev) => {
        const next = { ...prev }
        if (!res.available) {
          next[index] = `En uso por "${res.conflictProductName}".`
        } else {
          delete next[index]
        }
        return next
      })
    } catch (err) {
      console.error('Error al verificar código de variación:', err)
    }
  }

  const variationCodeCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of variations) {
      const c = v.code.trim().toUpperCase()
      if (c) counts.set(c, (counts.get(c) || 0) + 1)
    }
    return counts
  }, [variations])

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
          const mapped: VariationRow[] = vars.map((v) => ({
            id: v.id,
            attributeValue: v.attribute_value || '',
            code: v.code || '',
            salePrice: v.sale_price ? v.sale_price.toLocaleString('es-CL') : '',
            costPrice: v.cost_price ? v.cost_price.toLocaleString('es-CL') : '',
            stock: v.stock.toString(),
            minStock: v.min_stock.toString()
          }))
          setVariations(mapped)
          initialVariationsSnapshot.current = mapped
        })
      } else if (!product.parent_id) {
        setVariations([])
        initialVariationsSnapshot.current = []
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
      initialVariationsSnapshot.current = []
      setIsConfirmParentModalOpen(false)
      setDetectedParentChanges([])
      setVariations([])
      setFocusVariationIndex(null)
    }
    setError(null)
    setCodeConflictName(null)
    setVariationCodeErrors({})
    setIsStockBlockedModalOpen(false)
    setStockBlockedInfo(null)
    setIsConfirmDeleteProductModalOpen(false)
    setVariationIndexToDelete(null)
    setIsStockEditBlockedModalOpen(false)
    setStockEditBlockedTarget(null)
    setEditBlockedError(null)
  }, [product, categories, isOpen, getVariations])

  useModalStack({
    id: 'product-form-modal',
    isOpen:
      isOpen &&
      !isConfirmParentModalOpen &&
      !isStockBlockedModalOpen &&
      !isConfirmDeleteProductModalOpen &&
      variationIndexToDelete === null &&
      !isStockEditBlockedModalOpen,
    onClose,
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'stock-edit-blocked-modal',
    isOpen: isStockEditBlockedModalOpen,
    onClose: () => {
      setIsStockEditBlockedModalOpen(false)
      setStockEditBlockedTarget(null)
      setEditBlockedError(null)
    },
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'product-form-confirm-parent-modal',
    isOpen: isConfirmParentModalOpen,
    onClose: () => setIsConfirmParentModalOpen(false),
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'product-form-stock-blocked-modal',
    isOpen: isStockBlockedModalOpen,
    onClose: () => setIsStockBlockedModalOpen(false),
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'product-form-confirm-delete-modal',
    isOpen: isConfirmDeleteProductModalOpen,
    onClose: () => setIsConfirmDeleteProductModalOpen(false),
    closeOnBackdrop: false
  })

  useModalStack({
    id: 'product-form-confirm-delete-variation-modal',
    isOpen: variationIndexToDelete !== null,
    onClose: () => setVariationIndexToDelete(null),
    closeOnBackdrop: false
  })

  // Comprueba si una fila de variación está completamente vacía (sin nada escrito en ningún input)
  const isVariationEmpty = (v: VariationRow): boolean => {
    const hasAttr = v.attributeValue.trim() !== ''
    const hasCode = v.code.trim() !== ''
    const hasStock = v.stock.trim() !== '' && v.stock.trim() !== '0'
    const hasCost = v.costPrice.trim() !== '' && v.costPrice !== (costPrice || '')
    const hasMinStock = v.minStock.trim() !== ''
    const hasSale = v.salePrice.trim() !== '' && v.salePrice !== (salePrice || '')
    const isSavedInDb = Boolean(v.id)

    return !hasAttr && !hasCode && !hasStock && !hasCost && !hasMinStock && !hasSale && !isSavedInDb
  }

  // Intento de eliminar el producto/variación principal que se está editando
  const handleAttemptDeleteProduct = (): void => {
    if (!product) return

    const parsedInputStock = parseInt(stock, 10)
    const effectiveStock = !isNaN(parsedInputStock) ? parsedInputStock : (product.stock || 0)

    if (effectiveStock > 0) {
      const displayName = isEditingVariation
        ? `${parentName || product.parent_name || ''} ${attributeValue || product.attribute_value || ''}`.trim() || product.name
        : (name.trim() || product.name)

      setStockBlockedInfo({
        name: displayName,
        code: code || product.code || undefined,
        stock: effectiveStock,
        productToAdjust: product
      })
      setIsStockBlockedModalOpen(true)
      return
    }

    // Stock es 0 -> abrir confirmación de borrado
    setIsConfirmDeleteProductModalOpen(true)
  }

  const handleConfirmDeleteProduct = async (): Promise<void> => {
    if (!product) return
    setIsSubmitting(true)
    setError(null)
    try {
      await deleteProduct((product.id || product.code)!)
      setIsConfirmDeleteProductModalOpen(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el producto.')
      setIsConfirmDeleteProductModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoToAdjustInventory = (): void => {
    const item = stockBlockedInfo
    setIsStockBlockedModalOpen(false)
    onClose()

    if (item?.productToAdjust) {
      useInventoryStore.getState().setSelectedProduct(item.productToAdjust)
    } else if (product) {
      useInventoryStore.getState().setSelectedProduct(product)
    }
    useInventoryStore.getState().setActiveTab('adjust')
    useUIStore.getState().setActiveTab('inventario')
  }

  const checkHasUnsavedChanges = (): boolean => {
    if (!product) return false

    if (isEditingVariation) {
      const codeChanged = code.trim() !== (product.code || '').trim()
      const attrChanged = attributeValue.trim() !== (product.attribute_value || '').trim()
      const saleChanged = parseCLP(salePrice) !== (product.sale_price || 0)
      const currentCost = costPrice.trim() ? parseCLP(costPrice) : null
      const initialCost = product.cost_price || null
      const costChanged = currentCost !== initialCost
      const minChanged = (parseInt(minStock, 10) || 0) !== (product.min_stock !== undefined ? product.min_stock : 5)
      const parentChanged = getParentChanges().length > 0
      return codeChanged || attrChanged || saleChanged || costChanged || minChanged || parentChanged
    }

    if (productType === 'simple') {
      const codeChanged = code.trim() !== (product.code || '').trim()
      const nameChanged = name.trim() !== (product.name || '').trim()
      const saleChanged = parseCLP(salePrice) !== (product.sale_price || 0)
      const currentCost = costPrice.trim() ? parseCLP(costPrice) : null
      const initialCost = product.cost_price || null
      const costChanged = currentCost !== initialCost
      const minChanged = (parseInt(minStock, 10) || 0) !== (product.min_stock !== undefined ? product.min_stock : 5)
      const catChanged = selectedCategoryId !== (product.category_id || null)

      const initialSups = Array.from(new Set(product.supplier_ids || product.suppliers?.map((s) => s.id) || [])).sort((a, b) => a - b)
      const currentSups = Array.from(selectedSupplierIds).sort((a, b) => a - b)
      const supsChanged = initialSups.length !== currentSups.length || initialSups.some((id, idx) => id !== currentSups[idx])

      return codeChanged || nameChanged || saleChanged || costChanged || minChanged || catChanged || supsChanged
    }

    if (productType === 'variable') {
      const nameChanged = name.trim() !== (product.name || '').trim()
      const attrNameChanged = attributeName.trim() !== (product.attribute_name || 'Color').trim()
      const catChanged = selectedCategoryId !== (product.category_id || null)

      const initialSups = Array.from(new Set(product.supplier_ids || product.suppliers?.map((s) => s.id) || [])).sort((a, b) => a - b)
      const currentSups = Array.from(selectedSupplierIds).sort((a, b) => a - b)
      const supsChanged = initialSups.length !== currentSups.length || initialSups.some((id, idx) => id !== currentSups[idx])

      if (nameChanged || attrNameChanged || catChanged || supsChanged) return true

      const initialVars = initialVariationsSnapshot.current
      const nonBlankVars = variations.filter((v) => !isVariationEmpty(v))
      if (nonBlankVars.length !== initialVars.length) return true

      for (let i = 0; i < nonBlankVars.length; i++) {
        const v = nonBlankVars[i]
        const init = initialVars[i]
        if (!init) return true
        if (v.id !== init.id) return true
        if (v.code.trim() !== init.code.trim()) return true
        if (v.attributeValue.trim() !== init.attributeValue.trim()) return true
        if (parseCLP(v.salePrice) !== parseCLP(init.salePrice)) return true
        const curCost = v.costPrice.trim() ? parseCLP(v.costPrice) : null
        const initCost = init.costPrice.trim() ? parseCLP(init.costPrice) : null
        if (curCost !== initCost) return true
        if ((parseInt(v.minStock, 10) || 0) !== (parseInt(init.minStock, 10) || 0)) return true
      }
    }

    return false
  }

  const handleStockFieldClick = (): void => {
    if (!product) return
    const targetProduct: ProductSearchResult = {
      ...product,
      code: code || product.code || '',
      name: name || product.name
    }
    setStockEditBlockedTarget({
      name: name || product.name,
      code: code || product.code || '',
      stock: product.stock ?? 0,
      productToAdjust: targetProduct
    })
    setEditBlockedError(null)
    setIsStockEditBlockedModalOpen(true)
  }

  const handleVariationStockFieldClick = (): void => {
    if (!product) return
    const fullName = `${parentName || product.parent_name || ''} ${attributeValue || product.attribute_value || ''}`.trim() || product.name
    const targetProduct: ProductSearchResult = {
      ...product,
      code: code || product.code || '',
      name: fullName
    }
    setStockEditBlockedTarget({
      name: fullName,
      code: code || product.code || '',
      stock: product.stock ?? 0,
      productToAdjust: targetProduct
    })
    setEditBlockedError(null)
    setIsStockEditBlockedModalOpen(true)
  }

  const handleVariationRowStockClick = (v: VariationRow, idx: number): void => {
    if (!v.id) return
    const fullName = `${parentName || name || 'Producto'} ${v.attributeValue || v.code || `Variación #${idx + 1}`}`.trim()
    const productObj: ProductSearchResult = {
      id: v.id,
      code: v.code || '',
      name: fullName,
      search_name: fullName.toUpperCase(),
      sale_price: parseCLP(v.salePrice),
      cost_price: v.costPrice ? parseCLP(v.costPrice) : null,
      stock: parseInt(v.stock, 10) || 0,
      min_stock: parseInt(v.minStock, 10) || 0,
      category_id: selectedCategoryId,
      product_type: 'variation',
      parent_id: product?.id || null,
      parent_name: parentName || name || null,
      attribute_name: attributeName,
      attribute_value: v.attributeValue,
      active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setStockEditBlockedTarget({
      name: fullName,
      code: v.code || '',
      stock: parseInt(v.stock, 10) || 0,
      productToAdjust: productObj
    })
    setEditBlockedError(null)
    setIsStockEditBlockedModalOpen(true)
  }

  const handleDiscardAndRedirectToInventory = (): void => {
    if (!stockEditBlockedTarget) return
    const target = stockEditBlockedTarget.productToAdjust
    setIsStockEditBlockedModalOpen(false)
    setStockEditBlockedTarget(null)
    setEditBlockedError(null)
    onClose()

    useInventoryStore.getState().setSelectedProduct(target)
    useInventoryStore.getState().setActiveTab('adjust')
    useUIStore.getState().setActiveTab('inventario')
  }

  const handleCancelStockBlockedModal = (): void => {
    setIsStockEditBlockedModalOpen(false)
    setStockEditBlockedTarget(null)
    setEditBlockedError(null)
  }

  const handleSaveAndRedirectToInventory = async (): Promise<void> => {
    if (!stockEditBlockedTarget) return

    setIsSubmitting(true)
    setEditBlockedError(null)
    try {
      if (isEditingVariation && product?.parent_id) {
        if (!parentName.trim()) {
          setEditBlockedError('El nombre del producto padre es obligatorio.')
          setIsSubmitting(false)
          return
        }
        if (!attributeValue.trim()) {
          setEditBlockedError(`El valor del atributo (${attributeName}) es obligatorio.`)
          setIsSubmitting(false)
          return
        }
        if (!code.trim()) {
          setEditBlockedError('El código de barras / SKU de la variación es obligatorio.')
          setIsSubmitting(false)
          return
        }
        const parsedSalePrice = parseCLP(salePrice)
        if (parsedSalePrice <= 0 && parseCLP(parentSalePrice) <= 0) {
          setEditBlockedError('El precio de venta debe ser un número entero mayor a 0.')
          setIsSubmitting(false)
          return
        }
        await executeSave(false)
      } else if (productType === 'simple') {
        if (!name.trim()) {
          setEditBlockedError('El nombre del producto es obligatorio.')
          setIsSubmitting(false)
          return
        }
        if (!code.trim()) {
          setEditBlockedError('El código de barras / SKU es obligatorio.')
          setIsSubmitting(false)
          return
        }
        const parsedSalePrice = parseCLP(salePrice)
        if (parsedSalePrice <= 0) {
          setEditBlockedError('El precio de venta debe ser un número entero mayor a 0.')
          setIsSubmitting(false)
          return
        }
        const parsedCostPrice = costPrice.trim() ? parseCLP(costPrice) : null
        await saveProduct({
          id: product?.id,
          code: code.trim(),
          name: name.trim(),
          product_type: 'simple',
          sale_price: parsedSalePrice,
          cost_price: parsedCostPrice,
          category_id: selectedCategoryId,
          supplier_ids: Array.from(selectedSupplierIds),
          stock: product?.stock ?? 0,
          min_stock: parseInt(minStock, 10) || 0
        })
      } else if (productType === 'variable') {
        if (!name.trim()) {
          setEditBlockedError('El nombre general del producto variable es obligatorio.')
          setIsSubmitting(false)
          return
        }
        const nonBlankVariations = variations.filter((v) => !isVariationEmpty(v))
        if (nonBlankVariations.length === 0) {
          setEditBlockedError('Un producto variable debe tener al menos una variación.')
          setIsSubmitting(false)
          return
        }
        for (let i = 0; i < nonBlankVariations.length; i++) {
          const v = nonBlankVariations[i]
          if (!v.attributeValue.trim()) {
            setEditBlockedError(`La variación #${i + 1} requiere un valor de atributo. Debes completarla o eliminarla antes de guardar.`)
            setIsSubmitting(false)
            return
          }
          if (!v.code.trim()) {
            setEditBlockedError(`La variación "${v.attributeValue}" requiere un código de barras / SKU único. Debes completarla o eliminarla antes de guardar.`)
            setIsSubmitting(false)
            return
          }
          const vPrice = parseCLP(v.salePrice)
          if (vPrice <= 0) {
            setEditBlockedError(`El precio de venta de la variación "${v.attributeValue}" debe ser mayor a 0.`)
            setIsSubmitting(false)
            return
          }
        }

        const parentInput: ProductInput = {
          id: product?.id,
          name: name.trim(),
          product_type: 'variable',
          category_id: selectedCategoryId,
          supplier_ids: Array.from(selectedSupplierIds),
          attribute_name: attributeName.trim() || 'Color',
          sale_price: 0,
          stock: 0
        }

        const variationsInput: ProductInput[] = nonBlankVariations.map((v) => ({
          id: v.id,
          code: v.code.trim(),
          name: `${name.trim()} ${v.attributeValue.trim()}`,
          product_type: 'variation',
          attribute_name: attributeName.trim() || 'Color',
          attribute_value: v.attributeValue.trim(),
          sale_price: parseCLP(v.salePrice),
          cost_price: v.costPrice.trim() ? parseCLP(v.costPrice) : null,
          stock: parseInt(v.stock, 10) || 0,
          min_stock: v.minStock.trim() ? (parseInt(v.minStock, 10) || 0) : (minStock ? parseInt(minStock, 10) || 5 : 5),
          category_id: selectedCategoryId,
          supplier_ids: Array.from(selectedSupplierIds)
        }))

        await saveVariableProduct(parentInput, variationsInput)
      }

      const target = stockEditBlockedTarget.productToAdjust
      setIsStockEditBlockedModalOpen(false)
      setStockEditBlockedTarget(null)
      onClose()

      useInventoryStore.getState().setSelectedProduct(target)
      useInventoryStore.getState().setActiveTab('adjust')
      useUIStore.getState().setActiveTab('inventario')
    } catch (err: any) {
      console.error('Error al guardar antes de redirigir a inventario:', err)
      setEditBlockedError(err.message || 'Error al guardar los cambios.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const handleAddVariation = (): void => {
    const nextIdx = variations.length
    setVariations([
      ...variations,
      {
        attributeValue: '',
        code: '',
        salePrice: salePrice || '',
        costPrice: costPrice || '',
        stock: '',
        minStock: ''
      }
    ])
    setFocusVariationIndex(nextIdx)
  }

  const handleRemoveVariation = (index: number): void => {
    const v = variations[index]
    if (!v) return

    // 1. Si la variación tiene stock > 0, no permitir borrarla y mostrar modal de advertencia
    const parsedStock = parseInt(v.stock, 10) || 0
    if (parsedStock > 0) {
      const displayName = `${parentName || name || 'Producto'} ${v.attributeValue || v.code || `Variación #${index + 1}`}`.trim()
      const productObj: ProductSearchResult = {
        id: v.id || 0,
        code: v.code || '',
        name: displayName,
        search_name: displayName.toUpperCase(),
        sale_price: parseCLP(v.salePrice),
        cost_price: v.costPrice ? parseCLP(v.costPrice) : null,
        stock: parsedStock,
        min_stock: parseInt(v.minStock, 10) || 0,
        category_id: selectedCategoryId,
        product_type: 'variation',
        parent_id: product?.id || null,
        parent_name: parentName || name || null,
        attribute_name: attributeName,
        attribute_value: v.attributeValue,
        active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      setStockBlockedInfo({
        name: displayName,
        code: v.code,
        stock: parsedStock,
        productToAdjust: productObj
      })
      setIsStockBlockedModalOpen(true)
      return
    }

    // 2. Si la variación está completamente vacía, eliminar directamente sin preguntar
    if (isVariationEmpty(v)) {
      setVariations(variations.filter((_, i) => i !== index))
      return
    }

    // 3. Si tiene datos escritos, pedir confirmación
    setVariationIndexToDelete(index)
  }

  const handleConfirmRemoveVariation = (): void => {
    if (variationIndexToDelete !== null) {
      setVariations(variations.filter((_, i) => i !== variationIndexToDelete))
      setVariationIndexToDelete(null)
    }
  }

  const handleVariationChange = (index: number, field: keyof VariationRow, value: string): void => {
    const updated = [...variations]
    let finalValue = value
    if (field === 'code') {
      finalValue = value.toUpperCase()
      if (variationCodeErrors[index]) {
        setVariationCodeErrors((prev) => {
          const next = { ...prev }
          delete next[index]
          return next
        })
      }
    } else if (field === 'attributeValue') {
      finalValue = capitalizeWords(value)
    }
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

      const checkCode = await window.api.catalog.checkProductCodeAvailable(code.trim(), product.id)
      if (!checkCode.available) {
        setCodeConflictName(checkCode.conflictProductName || 'Otro producto')
        setError(`El código "${code.trim()}" ya está registrado en el producto "${checkCode.conflictProductName}".`)
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

      const checkCode = await window.api.catalog.checkProductCodeAvailable(code.trim(), product?.id)
      if (!checkCode.available) {
        setCodeConflictName(checkCode.conflictProductName || 'Otro producto')
        setError(`El código "${code.trim()}" ya está registrado en el producto "${checkCode.conflictProductName}".`)
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

      // Validar duplicados dentro de la misma tabla de variaciones
      const seenCodes = new Map<string, number>()
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]
        const c = v.code.trim().toUpperCase()
        if (seenCodes.has(c)) {
          const prevIdx = seenCodes.get(c)!
          setError(`El código "${v.code.trim()}" está repetido en la variación #${prevIdx + 1} ("${variations[prevIdx].attributeValue || 'Variación'}") y la variación #${i + 1} ("${v.attributeValue || 'Variación'}"). Cada variación debe tener un código único.`)
          return
        }
        seenCodes.set(c, i)
      }

      // Validar que ningún código de las variaciones exista ya en base de datos
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i]
        const check = await window.api.catalog.checkProductCodeAvailable(v.code.trim(), v.id)
        if (!check.available) {
          setError(`El código "${v.code.trim()}" (variación #${i + 1} "${v.attributeValue}") ya está registrado en el producto "${check.conflictProductName}".`)
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
        min_stock: v.minStock.trim() ? (parseInt(v.minStock, 10) || 0) : (minStock ? parseInt(minStock, 10) || 5 : 5),
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-lilac-100 dark:border-slate-800 max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 select-text">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-lilac-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-lilac-100 dark:bg-slate-800 text-lilac-600 dark:text-lilac-400 flex items-center justify-center">
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
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Selector de Tipo (Simple vs Variable) - Solo al crear nuevo producto */}
          {!product && (
            <div className="flex items-center gap-3 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setProductType('simple')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  productType === 'simple'
                    ? 'bg-white dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 shadow-sm border border-lilac-200 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                    ? 'bg-white dark:bg-slate-700 text-lilac-700 dark:text-lilac-300 shadow-sm border border-lilac-200 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
              <div className="bg-slate-200/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                    <span>1. Datos del Producto Padre</span>
                  </span>
                  <span className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">Contenedor General</span>
                </div>

                {/* Banner de Aviso */}
                <div className="p-3 bg-amber-50 dark:bg-slate-800/90 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Aviso importante:</p>
                    <p className="text-[11px] text-amber-900 dark:text-amber-300/90 mt-0.5 font-medium">
                      Al modificar cualquier dato del producto padre (nombre, categoría, proveedores, precios o inv. mínimo), se abrirá una confirmación para aplicar y sincronizar los cambios en todas las variaciones.
                    </p>
                  </div>
                </div>

                {/* Nombre Padre y Atributo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                      Nombre del Producto Padre *
                    </label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(capitalizeWords(e.target.value))}
                      placeholder="Ej: Algodón Rústico"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                      Atributo General
                    </label>
                    <input
                      type="text"
                      value={attributeName}
                      onChange={(e) => setAttributeName(capitalizeWords(e.target.value))}
                      placeholder="Ej: Color, Talla"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {/* Categoría Compartida */}
                <CategorySelectCard
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                  title="Categoría Compartida"
                />

                {/* Proveedores Compartidos */}
                <SupplierSelectCard
                  selectedSupplierIds={selectedSupplierIds}
                  onChangeSelectedSupplierIds={setSelectedSupplierIds}
                  title="Proveedor/es del padre"
                />

                {/* Precios e Inventario Mínimo Generales del Padre */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                      <span>Precio de Venta Base (CLP)</span>
                    </label>
                    <input
                      type="text"
                      value={parentSalePrice}
                      onChange={(e) => handleParentSalePriceChange(e.target.value)}
                      placeholder="Ej: 3.500"
                      className="w-full px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 block font-medium">
                      Precio general para las variaciones.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Precio de Costo Base (CLP)</span>
                    </label>
                    <input
                      type="text"
                      value={parentCostPrice}
                      onChange={(e) => handleParentCostPriceChange(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 block font-medium">
                      Costo base general.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Inv. Mínimo General</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={parentMinStock}
                      onChange={(e) => handleParentMinStockChange(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 block font-medium">
                      Alerta stock bajo para variaciones.
                    </span>
                  </div>
                </div>
              </div>

              {/* Parte 2: Variación Específica Seleccionada */}
              <div className="bg-slate-200/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                    <span>2. Valores Específicos de la Variación</span>
                  </span>
                  <span className="text-xs font-bold text-lilac-900 dark:text-lilac-300 bg-lilac-200 dark:bg-slate-700 dark:border dark:border-slate-600 px-2.5 py-0.5 rounded-full">
                    {attributeValue || 'Sin valor'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Código de barras / SKU (Editable) */}
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 shrink-0">
                        Código de Barras / SKU *
                      </label>
                      {codeConflictName && (
                        <span
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 truncate flex items-center gap-1 min-w-0"
                          title={`En uso por: ${codeConflictName}`}
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">En uso por: {codeConflictName}</span>
                        </span>
                      )}
                    </div>
                    <input
                      ref={codeInputRef}
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase())
                        if (codeConflictName) setCodeConflictName(null)
                      }}
                      onBlur={handleCodeBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          attributeValueInputRef.current?.focus()
                          attributeValueInputRef.current?.select()
                        }
                      }}
                      placeholder="Ej: 780123456"
                      className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-xl font-mono text-slate-900 dark:text-white font-bold focus:outline-none uppercase placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs ${
                        codeConflictName
                          ? 'border-rose-500 focus:border-rose-600 dark:border-rose-500'
                          : 'border-slate-300 dark:border-slate-700 focus:border-lilac-500'
                      }`}
                    />
                  </div>

                  {/* Valor del Atributo */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                      Valor de la Variación ({attributeName || 'Atributo'}) *
                    </label>
                    <input
                      ref={attributeValueInputRef}
                      type="text"
                      value={attributeValue}
                      onChange={(e) => setAttributeValue(capitalizeWords(e.target.value))}
                      placeholder="Ej: Azul Marino, Rojo, XL..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Precios e Inventario (4 Columnas) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
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
                      className="w-full px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Precio Costo (CLP)</span>
                    </label>
                    <input
                      type="text"
                      value={costPrice}
                      onChange={(e) => {
                        const val = parseCLP(e.target.value)
                        setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                      }}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                      <span>Existencia (Stock)</span>
                    </label>
                    {product ? (
                      <div
                        onClick={handleVariationStockFieldClick}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer transition-colors group shadow-2xs"
                        title="La existencia no se puede editar directamente. Haz clic para ir a Ajustar Inventario."
                      >
                        <span className="font-mono text-slate-900 dark:text-white">{product.stock ?? 0}</span>
                        <div className="flex items-center gap-1 text-[11px] text-lilac-700 dark:text-lilac-300 font-semibold group-hover:underline">
                          <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-lilac-600 dark:group-hover:text-lilac-400" />
                          <span>Ajustar</span>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        min="0"
                        placeholder="Stock inicial"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Inv. Mínimo (Alerta)</span>
                    </label>
                    <input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : productType === 'simple' ? (
            /* CASO B: PRODUCTO SIMPLE (UNA SOLA TARJETA) */
            <div className="bg-slate-200/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
              {/* Cabecera de la Tarjeta */}
              <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                  <span>Datos del Producto Simple</span>
                </span>
                <span className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">SKU Único</span>
              </div>

              {/* Fila 1: Código (1/3) + Nombre (2/3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 shrink-0">
                      Código de Barras / SKU * {product ? '(Editable)' : ''}
                    </label>
                    {codeConflictName && (
                      <span
                        className="text-[11px] font-bold text-rose-600 dark:text-rose-400 truncate flex items-center gap-1 min-w-0"
                        title={`En uso por: ${codeConflictName}`}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">En uso por: {codeConflictName}</span>
                      </span>
                    )}
                  </div>
                  <input
                    ref={codeInputRef}
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      if (codeConflictName) setCodeConflictName(null)
                    }}
                    onBlur={handleCodeBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        nameInputRef.current?.focus()
                        nameInputRef.current?.select()
                      }
                    }}
                    placeholder="Ej: 780123456"
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-xl font-mono font-bold focus:outline-none uppercase text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs ${
                      codeConflictName
                        ? 'border-rose-500 focus:border-rose-600 dark:border-rose-500'
                        : 'border-slate-300 dark:border-slate-700 focus:border-lilac-500'
                    }`}
                  />
                  {product && (
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 block font-medium">
                      Si modificas el código, se mantendrán intactos los movimientos en el kardex y ventas pasadas.
                    </span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(capitalizeWords(e.target.value))}
                    placeholder="Ej: Crochet Aluminio 4.0mm"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Fila 2: Categoría */}
              <CategorySelectCard
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                title="Categoría"
              />

              {/* Fila 3: Proveedores Asociados */}
              <SupplierSelectCard
                selectedSupplierIds={selectedSupplierIds}
                onChangeSelectedSupplierIds={setSelectedSupplierIds}
                title="Proveedor/es del producto"
              />

              {/* Fila 4: Bloque Unificado de 4 Columnas: Precios e Inventario */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
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
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Precio Costo (CLP)</span>
                  </label>
                  <input
                    type="text"
                    value={costPrice}
                    onChange={(e) => {
                      const val = parseCLP(e.target.value)
                      setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                    }}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                    <span>Existencia (Stock)</span>
                  </label>
                  {product ? (
                    <div
                      onClick={handleStockFieldClick}
                      className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer transition-colors group shadow-2xs"
                      title="La existencia no se puede editar directamente. Haz clic para ir a Ajustar Inventario."
                    >
                      <span className="font-mono text-slate-900 dark:text-white">{product.stock ?? 0}</span>
                      <div className="flex items-center gap-1 text-[11px] text-lilac-700 dark:text-lilac-300 font-semibold group-hover:underline">
                        <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-lilac-600 dark:group-hover:text-lilac-400" />
                        <span>Ajustar</span>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      min="0"
                      placeholder="Stock inicial"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Inv. Mínimo (Alerta)</span>
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* CASO C: NUEVO PRODUCTO VARIABLE (DOS TARJETAS: PADRE Y VARIACIONES) */
            <div className="space-y-5">
              {/* Tarjeta 1: Datos del Producto Padre */}
              <div className="bg-slate-200/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                    <span>1. Datos del Producto Padre</span>
                  </span>
                  <span className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">Contenedor General</span>
                </div>

                {/* Nombre General y Atributo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                      Nombre General del Producto Variable *
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(capitalizeWords(e.target.value))}
                      placeholder="Ej: Algodón Rústico"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">
                      Atributo Diferenciador *
                    </label>
                    <input
                      type="text"
                      value={attributeName}
                      onChange={(e) => setAttributeName(capitalizeWords(e.target.value))}
                      placeholder="Ej: Color, Talla, Grosor"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Categoría Compartida */}
                <CategorySelectCard
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                  title="Categoría Compartida"
                />

                {/* Proveedores Compartidos */}
                <SupplierSelectCard
                  selectedSupplierIds={selectedSupplierIds}
                  onChangeSelectedSupplierIds={setSelectedSupplierIds}
                  title="Proveedor/es del padre"
                />

                {/* Valores por defecto para las Variaciones */}
                <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                      <span>Valores Base / por Defecto para las Variaciones</span>
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      Se asignarán por defecto al agregar nuevas variaciones
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                        <span>Precio Venta Base (CLP)</span>
                      </label>
                      <input
                        type="text"
                        value={salePrice}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setSalePrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="Ej: 3.500"
                        className="w-full px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Precio Costo Base (CLP)</span>
                      </label>
                      <input
                        type="text"
                        value={costPrice}
                        onChange={(e) => {
                          const val = parseCLP(e.target.value)
                          setCostPrice(val === 0 && !e.target.value.trim() ? '' : val.toLocaleString('es-CL'))
                        }}
                        placeholder="Opcional"
                        className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Inv. Mínimo General</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        placeholder="5"
                        className="w-full px-3 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Variaciones */}
              <div className="bg-slate-200/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-lilac-600 dark:text-lilac-400" />
                      <span>2. Variaciones del Producto</span>
                    </span>
                    <span className="text-xs font-bold text-lilac-900 dark:text-lilac-300 bg-lilac-200 dark:bg-slate-700 dark:border dark:border-slate-600 px-2.5 py-0.5 rounded-full">
                      {variations.length} {variations.length === 1 ? 'variación' : 'variaciones'}
                    </span>
                  </div>

                  {variations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddVariation}
                      className="text-xs text-lilac-700 hover:text-lilac-800 dark:text-lilac-400 dark:hover:text-lilac-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Variación</span>
                    </button>
                  )}
                </div>

                {variations.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex flex-col items-center justify-center text-center shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-lilac-100 dark:bg-slate-700 text-lilac-600 dark:text-lilac-400 flex items-center justify-center mb-3 shadow-inner">
                      <GitBranch className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                      Aún no hay variaciones registradas
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mb-4 font-medium">
                      Crea las distintas variantes (por {attributeName || 'atributo'}, código propio y existencias) para este producto variable.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddVariation}
                      className="px-6 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold shadow-md shadow-lilac-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Primera Variación</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {variations.map((v, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl space-y-2.5 shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                      >
                        {/* Fila 1: Código (1/6), Nombre / Atributo (4/6), Precio Venta (1/6) */}
                        <div className="grid grid-cols-6 gap-2">
                          <div className="col-span-1 relative">
                            <input
                              ref={(el) => {
                                if (el && idx === focusVariationIndex) {
                                  el.focus()
                                  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                                  setFocusVariationIndex(null)
                                }
                              }}
                              type="text"
                              value={v.code}
                              onChange={(e) => handleVariationChange(idx, 'code', e.target.value)}
                              onBlur={() => handleVariationCodeBlur(idx)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  variationAttrRefs.current[idx]?.focus()
                                  variationAttrRefs.current[idx]?.select()
                                }
                              }}
                              title={
                                (variationCodeCounts.get(v.code.trim().toUpperCase()) || 0) > 1
                                  ? 'Código repetido en esta lista'
                                  : variationCodeErrors[idx] || undefined
                              }
                              placeholder="Código *"
                              className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono font-bold focus:outline-none uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-left shadow-2xs ${
                                (variationCodeCounts.get(v.code.trim().toUpperCase()) || 0) > 1 || variationCodeErrors[idx]
                                  ? 'border-rose-500 focus:border-rose-600 dark:border-rose-500'
                                  : 'border-slate-300 dark:border-slate-700 focus:border-lilac-500'
                              }`}
                            />
                            {((variationCodeCounts.get(v.code.trim().toUpperCase()) || 0) > 1 || variationCodeErrors[idx]) && (
                              <div
                                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 pointer-events-none"
                                title={
                                  (variationCodeCounts.get(v.code.trim().toUpperCase()) || 0) > 1
                                    ? 'Código repetido en esta lista'
                                    : variationCodeErrors[idx] || undefined
                                }
                              />
                            )}
                          </div>
                          <div className="col-span-4">
                            <input
                              ref={(el) => {
                                variationAttrRefs.current[idx] = el
                              }}
                              type="text"
                              value={v.attributeValue}
                              onChange={(e) => handleVariationChange(idx, 'attributeValue', e.target.value)}
                              placeholder={`Nombre / Valor (${attributeName || 'Atributo'}) * (Ej: Negro, Azul, XL)`}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-lilac-500 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-left shadow-2xs"
                            />
                          </div>
                          <div className="col-span-1">
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
                              placeholder="P. Venta *"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal text-left shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Fila 2: P. Costo, Stock, Stock Mínimo + Eliminar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
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
                              placeholder="P. Costo (opcional)"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-left shadow-2xs"
                            />
                          </div>
                          <div className="flex-1">
                            {v.id ? (
                              <div
                                onClick={() => handleVariationRowStockClick(v, idx)}
                                className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer transition-colors group shadow-2xs"
                                title="Existencia protegida. Haz clic para ir a Ajustar Inventario."
                              >
                                <span className="font-mono text-slate-900 dark:text-white">{v.stock}</span>
                                <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-lilac-600 dark:group-hover:text-lilac-400 shrink-0" />
                              </div>
                            ) : (
                              <input
                                type="number"
                                value={v.stock}
                                onChange={(e) => handleVariationChange(idx, 'stock', e.target.value)}
                                min="0"
                                placeholder="Stock"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-left shadow-2xs"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              type="number"
                              value={v.minStock}
                              onChange={(e) => handleVariationChange(idx, 'minStock', e.target.value)}
                              min="0"
                              placeholder="Stock Mínimo"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-lilac-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-left shadow-2xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariation(idx)}
                            className="p-1.5 text-slate-700 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors cursor-pointer shrink-0"
                            title="Eliminar variación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Botón inferior para agregar otra variación */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAddVariation}
                        className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 active:scale-[0.99]"
                      >
                        <Plus className="w-4 h-4 text-lilac-600 dark:text-lilac-400" />
                        <span>Agregar Otra Variación</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            {product ? (
              <button
                type="button"
                onClick={handleAttemptDeleteProduct}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar {isEditingVariation ? 'Variación' : 'Producto'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-bold text-white bg-lilac-600 hover:bg-lilac-700 rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : 'Guardar Producto'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de Advertencia: No se puede eliminar si tiene stock */}
      {isStockBlockedModalOpen && stockBlockedInfo && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">No es posible eliminar</h3>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-mono truncate max-w-[260px]">
                    {stockBlockedInfo.code || stockBlockedInfo.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockBlockedModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-amber-50/80 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1.5">
                <span className="font-bold text-amber-950 dark:text-amber-200 text-xs block">
                  {stockBlockedInfo.name}
                </span>
                <p className="text-xs text-amber-900 dark:text-amber-300/90 leading-relaxed">
                  Para eliminar este producto o variación, <strong className="font-black text-amber-950 dark:text-amber-200">no debe tener stock disponible</strong> (su existencia debe ser 0).
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Existencia actual registrada:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-300 text-sm bg-rose-50 dark:bg-slate-700 px-2.5 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
                  {stockBlockedInfo.stock} {stockBlockedInfo.stock === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Debes rebajar o ajustar la existencia a 0 antes de poder dar de baja este producto del catálogo.
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsStockBlockedModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleGoToAdjustInventory}
                className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Boxes className="w-4 h-4" />
                <span>Ir a Ajustar Inventario</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Producto / Variación Editada (cuando stock es 0) */}
      {isConfirmDeleteProductModalOpen && product && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">
                    {isEditingVariation ? '¿Eliminar variación?' : '¿Eliminar producto?'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {code || product.code || 'Sin código'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmDeleteProductModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3 bg-rose-50 dark:bg-slate-800/80 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs space-y-1">
                <span className="font-bold text-rose-950 dark:text-rose-200 block">
                  {isEditingVariation
                    ? `${parentName || product.parent_name || ''} ${attributeValue || product.attribute_value || ''}`.trim() || product.name
                    : (name || product.name)}
                </span>
                <span className="text-rose-700 dark:text-rose-300 text-[11px] block">
                  Se realizará un soft delete (se mantendrá en el historial y kardex, pero ya no aparecerá en el catálogo ni en ventas).
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Confirmas que deseas eliminar {isEditingVariation ? 'esta variación' : 'este producto'} definitivamente del catálogo activo?
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmDeleteProductModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDeleteProduct}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Variación de la Lista (si no está vacía) */}
      {variationIndexToDelete !== null && variations[variationIndexToDelete] && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-xs">¿Eliminar variación?</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">
                    {variations[variationIndexToDelete].code || `Variación #${variationIndexToDelete + 1}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariationIndexToDelete(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                ¿Estás seguro de que deseas eliminar la variación{' '}
                <strong className="font-bold text-slate-900 dark:text-white">
                  "{variations[variationIndexToDelete].attributeValue || variations[variationIndexToDelete].code || `Variación #${variationIndexToDelete + 1}`}"
                </strong>
                ?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Se quitará de la lista de variaciones del producto.
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVariationIndexToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveVariation}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Cambios en Producto Padre */}
      {isConfirmParentModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">Confirmar Modificación Masiva</h3>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Producto Padre: {parentName}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmParentModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Has modificado los datos del producto padre. Los siguientes cambios se aplicarán y sincronizarán para <strong className="text-slate-900 dark:text-white font-bold">todas las variaciones</strong> de este producto:
              </p>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60 bg-slate-50 dark:bg-slate-800 max-h-56 overflow-y-auto">
                {detectedParentChanges.map((change, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">{change.field}</span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="text-slate-400 dark:text-slate-500 line-through text-[11px]">{change.from}</span>
                      <span className="text-slate-400 dark:text-slate-500">→</span>
                      <span className="font-black text-lilac-700 dark:text-lilac-300 bg-lilac-50 dark:bg-slate-700 px-2 py-0.5 rounded border border-lilac-200 dark:border-slate-600">
                        {change.to}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  ¿Confirmas que deseas guardar y aplicar estos cambios a <strong>todas las variaciones</strong>?
                </span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmParentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer transition-colors"
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

      {/* Modal de Advertencia: Existencia Protegida y Redirección a Inventario */}
      {isStockEditBlockedModalOpen && stockEditBlockedTarget && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-lilac-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lilac-100 dark:bg-slate-800 text-lilac-700 dark:text-lilac-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">
                    Ajustar Existencia en Inventario
                  </h3>
                  <p className="text-[11px] text-lilac-800 dark:text-lilac-300 font-mono truncate max-w-[260px]">
                    {stockEditBlockedTarget.code || 'Sin código'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelStockBlockedModal}
                disabled={isSubmitting}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  {stockEditBlockedTarget.name}
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  La existencia de un producto ya creado <strong className="text-slate-800 dark:text-slate-100">no se puede editar directamente desde el catálogo</strong>.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Para mantener la trazabilidad y el kardex de movimientos al día, los cambios de inventario deben realizarse desde la pestaña <strong className="text-lilac-700 dark:text-lilac-400 font-semibold">Inventario → Ajustar existencia</strong>.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs shadow-2xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Existencia actual registrada:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                  {stockEditBlockedTarget.stock} {stockEditBlockedTarget.stock === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>

              {checkHasUnsavedChanges() && (
                <div className="p-3 bg-amber-50 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Tienes cambios sin guardar en el formulario.</span>
                    <span>¿Deseas guardar los cambios antes de ir a Inventario o prefieres descartarlos?</span>
                  </div>
                </div>
              )}

              {editBlockedError && (
                <div className="p-3 bg-rose-50 dark:bg-slate-800/80 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{editBlockedError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelStockBlockedModal}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              {checkHasUnsavedChanges() ? (
                <>
                  <button
                    type="button"
                    onClick={handleDiscardAndRedirectToInventory}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                  >
                    Descartar e Ir a Inventario
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndRedirectToInventory}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Boxes className="w-4 h-4" />
                    <span>{isSubmitting ? 'Guardando...' : 'Guardar e Ir a Inventario'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDiscardAndRedirectToInventory}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Boxes className="w-4 h-4" />
                  <span>Ir a Ajustar Inventario</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast flotante con posición fija para errores sin layout shift */}
      {error && (
        <div className="fixed bottom-6 right-6 z-60 max-w-md bg-rose-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-rose-700/60 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
          <div className="flex-1 text-xs font-semibold leading-snug">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-rose-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
