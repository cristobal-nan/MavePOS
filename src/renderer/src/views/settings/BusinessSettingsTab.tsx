import React, { useState, useEffect, useCallback } from 'react'
import { Store } from 'lucide-react'
import { useSettingsStore, DirtyFieldChange } from '../../store/settingsStore'

interface BusinessFormValues {
  businessName: string
  businessRut: string
  businessActivity: string
  businessAddress: string
  businessPhone: string
  businessEmail: string
  ticketFooter: string
}

const EMPTY_VALUES: BusinessFormValues = {
  businessName: '',
  businessRut: '',
  businessActivity: '',
  businessAddress: '',
  businessPhone: '',
  businessEmail: '',
  ticketFooter: ''
}

export const BusinessSettingsTab: React.FC = () => {
  const [initialValues, setInitialValues] = useState<BusinessFormValues>(EMPTY_VALUES)
  const [formValues, setFormValues] = useState<BusinessFormValues>(EMPTY_VALUES)
  const [isLoaded, setIsLoaded] = useState(false)

  const registerSubTabState = useSettingsStore((s) => s.registerSubTabState)
  const clearSubTabState = useSettingsStore((s) => s.clearSubTabState)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((all) => {
        if (!isMounted) return
        const loaded: BusinessFormValues = {
          businessName: all.business_name || '',
          businessRut: all.business_rut || '',
          businessActivity: all.business_activity || '',
          businessAddress: all.business_address || '',
          businessPhone: all.business_phone || '',
          businessEmail: all.business_email || '',
          ticketFooter: all.ticket_footer_message || ''
        }
        setInitialValues(loaded)
        setFormValues(loaded)
        setIsLoaded(true)
      })
      .catch((err) => {
        console.error('Error cargando configuración del negocio:', err)
      })

    return () => {
      isMounted = false
      clearSubTabState()
    }
  }, [clearSubTabState])

  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await window.api.setSetting('business_name', formValues.businessName.trim())
      await window.api.setSetting('business_rut', formValues.businessRut.trim())
      await window.api.setSetting('business_activity', formValues.businessActivity.trim())
      await window.api.setSetting('business_address', formValues.businessAddress.trim())
      await window.api.setSetting('business_phone', formValues.businessPhone.trim())
      await window.api.setSetting('business_email', formValues.businessEmail.trim())
      await window.api.setSetting('ticket_footer_message', formValues.ticketFooter.trim())

      const savedValues: BusinessFormValues = {
        businessName: formValues.businessName.trim(),
        businessRut: formValues.businessRut.trim(),
        businessActivity: formValues.businessActivity.trim(),
        businessAddress: formValues.businessAddress.trim(),
        businessPhone: formValues.businessPhone.trim(),
        businessEmail: formValues.businessEmail.trim(),
        ticketFooter: formValues.ticketFooter.trim()
      }
      setInitialValues(savedValues)
      setFormValues(savedValues)
      return true
    } catch (err) {
      console.error('Error guardando datos del negocio:', err)
      return false
    }
  }, [formValues])

  const handleDiscard = useCallback((): void => {
    setFormValues(initialValues)
  }, [initialValues])

  // Detectar cambios y registrar en el store
  useEffect(() => {
    if (!isLoaded) return

    const changes: DirtyFieldChange[] = []
    if (formValues.businessName !== initialValues.businessName) {
      changes.push({ field: 'Razón Social / Nombre', value: formValues.businessName })
    }
    if (formValues.businessRut !== initialValues.businessRut) {
      changes.push({ field: 'RUT del Negocio', value: formValues.businessRut })
    }
    if (formValues.businessActivity !== initialValues.businessActivity) {
      changes.push({ field: 'Giro Comercial', value: formValues.businessActivity })
    }
    if (formValues.businessAddress !== initialValues.businessAddress) {
      changes.push({ field: 'Dirección Comercial', value: formValues.businessAddress })
    }
    if (formValues.businessPhone !== initialValues.businessPhone) {
      changes.push({ field: 'Teléfono / WhatsApp', value: formValues.businessPhone })
    }
    if (formValues.businessEmail !== initialValues.businessEmail) {
      changes.push({ field: 'Correo Electrónico', value: formValues.businessEmail })
    }
    if (formValues.ticketFooter !== initialValues.ticketFooter) {
      changes.push({ field: 'Pie de Ticket', value: formValues.ticketFooter })
    }

    const isDirty = changes.length > 0
    registerSubTabState(isDirty, changes, handleSave, handleDiscard)
  }, [formValues, initialValues, isLoaded, handleSave, handleDiscard, registerSubTabState])

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-lilac-600" />
            <h2 className="text-sm font-bold text-slate-800">Identificación y Datos Comerciales</h2>
          </div>
          <span className="text-xs text-slate-400">Se imprimirán en el encabezado de boletas y tickets</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nombre Comercial / Razón Social</label>
            <input
              type="text"
              value={formValues.businessName}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessName: e.target.value }))}
              placeholder="Ej: Lanas & Tejidos Mave"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">RUT del Negocio</label>
            <input
              type="text"
              value={formValues.businessRut}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessRut: e.target.value }))}
              placeholder="Ej: 76.123.456-7"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Giro Comercial</label>
            <input
              type="text"
              value={formValues.businessActivity}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessActivity: e.target.value }))}
              placeholder="Ej: Venta de Lanas, Hilos y Artículos de Costura"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Dirección del Local</label>
            <input
              type="text"
              value={formValues.businessAddress}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessAddress: e.target.value }))}
              placeholder="Ej: Av. Providencia 1234, Local 5, Santiago"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
            <input
              type="text"
              value={formValues.businessPhone}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessPhone: e.target.value }))}
              placeholder="Ej: +56 9 1234 5678"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Correo Electrónico de Contacto</label>
            <input
              type="email"
              value={formValues.businessEmail}
              onChange={(e) => setFormValues((prev) => ({ ...prev, businessEmail: e.target.value }))}
              placeholder="Ej: contacto@lanasmave.cl"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Mensaje de Pie de Ticket</label>
            <textarea
              rows={2}
              value={formValues.ticketFooter}
              onChange={(e) => setFormValues((prev) => ({ ...prev, ticketFooter: e.target.value }))}
              placeholder="Ej: ¡Muchas gracias por su preferencia! Cambios dentro de 30 días presentando este comprobante."
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
