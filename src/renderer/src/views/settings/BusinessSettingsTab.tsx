import React, { useState, useEffect } from 'react'
import { Store, CheckCircle2, Save } from 'lucide-react'

export const BusinessSettingsTab: React.FC = () => {
  const [businessName, setBusinessName] = useState('')
  const [businessRut, setBusinessRut] = useState('')
  const [businessActivity, setBusinessActivity] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [ticketFooter, setTicketFooter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    window.api
      .getAllSettings()
      .then((all) => {
        if (!isMounted) return
        setBusinessName(all.business_name || '')
        setBusinessRut(all.business_rut || '')
        setBusinessActivity(all.business_activity || '')
        setBusinessAddress(all.business_address || '')
        setBusinessPhone(all.business_phone || '')
        setBusinessEmail(all.business_email || '')
        setTicketFooter(all.ticket_footer_message || '')
      })
      .catch((err) => {
        console.error('Error cargando configuración del negocio:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleSaveBusinessData = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    setSavedMessage(null)

    try {
      await window.api.setSetting('business_name', businessName.trim())
      await window.api.setSetting('business_rut', businessRut.trim())
      await window.api.setSetting('business_activity', businessActivity.trim())
      await window.api.setSetting('business_address', businessAddress.trim())
      await window.api.setSetting('business_phone', businessPhone.trim())
      await window.api.setSetting('business_email', businessEmail.trim())
      await window.api.setSetting('ticket_footer_message', ticketFooter.trim())

      setSavedMessage('¡Datos del negocio guardados correctamente!')
      setTimeout(() => setSavedMessage(null), 4000)
    } catch (err: any) {
      console.error('Error guardando datos del negocio:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSaveBusinessData} className="max-w-3xl space-y-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-lilac-100 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-lilac-600" />
            <h2 className="text-sm font-bold text-slate-800">Identificación y Datos Comerciales</h2>
          </div>
          <span className="text-xs text-slate-400">Se imprimirán en el encabezado de boletas y tickets</span>
        </div>

        {savedMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{savedMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nombre Comercial / Razón Social</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Lanas & Tejidos Mave"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">RUT del Negocio</label>
            <input
              type="text"
              value={businessRut}
              onChange={(e) => setBusinessRut(e.target.value)}
              placeholder="Ej: 76.123.456-7"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Giro Comercial</label>
            <input
              type="text"
              value={businessActivity}
              onChange={(e) => setBusinessActivity(e.target.value)}
              placeholder="Ej: Venta de Lanas, Hilos y Artículos de Costura"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Dirección del Local</label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Ej: Av. Providencia 1234, Local 5, Santiago"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
            <input
              type="text"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="Ej: +56 9 1234 5678"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Correo Electrónico de Contacto</label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="Ej: contacto@lanasmave.cl"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Mensaje de Pie de Ticket</label>
            <textarea
              rows={2}
              value={ticketFooter}
              onChange={(e) => setTicketFooter(e.target.value)}
              placeholder="Ej: ¡Muchas gracias por su preferencia! Cambios dentro de 30 días presentando este comprobante."
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-lilac-500 focus:ring-2 focus:ring-lilac-100 font-medium text-slate-800 resize-none"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Datos del Negocio'}</span>
          </button>
        </div>
      </div>
    </form>
  )
}
