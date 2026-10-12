import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Package, Plus, Search, AlertCircle } from 'lucide-react'
import {
  ViewHeader,
  SubTabs,
  SubTabItem,
  EmptyState
} from '../renderer/src/components/common'

describe('Componentes Canónicos Compartidos (Fase 0)', () => {
  describe('ViewHeader', () => {
    it('renderiza título y subtítulo con truncamiento y jerarquía semántica', () => {
      const html = renderToStaticMarkup(
        React.createElement(ViewHeader, {
          title: 'Catálogo de Productos',
          subtitle: 'Gestión y control de artículos vendibles'
        })
      )

      expect(html).toContain('Catálogo de Productos')
      expect(html).toContain('Gestión y control de artículos vendibles')
      expect(html).toContain('<h1')
      expect(html).toContain('truncate')
      expect(html).toContain('min-w-0')
    })

    it('renderiza icono decorativo con aria-hidden="true"', () => {
      const html = renderToStaticMarkup(
        React.createElement(ViewHeader, {
          title: 'Inventario',
          icon: Package
        })
      )

      expect(html).toContain('aria-hidden="true"')
    })

    it('renderiza ranura de acciones primarias y badge de estado', () => {
      const html = renderToStaticMarkup(
        React.createElement(ViewHeader, {
          title: 'Ventas en Espera',
          badge: React.createElement('span', { className: 'badge-test' }, '3 pendientes'),
          primaryAction: React.createElement(
            'button',
            { type: 'button', className: 'btn-test' },
            'Nueva Venta'
          )
        })
      )

      expect(html).toContain('3 pendientes')
      expect(html).toContain('Nueva Venta')
      expect(html).toContain('badge-test')
    })
  })

  describe('SubTabs', () => {
    type TestTab = 'tab_a' | 'tab_b' | 'tab_c'
    const tabs: SubTabItem<TestTab>[] = [
      { id: 'tab_a', label: 'Disponibles', count: 42 },
      { id: 'tab_b', label: 'Agotados', count: 0 },
      { id: 'tab_c', label: 'Desactivados', disabled: true }
    ]

    it('cumple con semántica ARIA para tablist y tab', () => {
      const html = renderToStaticMarkup(
        React.createElement(SubTabs, {
          tabs,
          activeTab: 'tab_a',
          onChange: () => {}
        })
      )

      expect(html).toContain('role="tablist"')
      expect(html).toContain('role="tab"')
      expect(html).toContain('aria-selected="true"')
      expect(html).toContain('aria-selected="false"')
      expect(html).toContain('tabindex="0"')
      expect(html).toContain('tabindex="-1"')
    })

    it('aplica tabular-nums a contadores numéricos para evitar layout shift', () => {
      const html = renderToStaticMarkup(
        React.createElement(SubTabs, {
          tabs,
          activeTab: 'tab_a',
          onChange: () => {}
        })
      )

      expect(html).toContain('tabular-nums')
      expect(html).toContain('42')
    })

    it('marca pestañas deshabilitadas con aria-disabled y atributo disabled', () => {
      const html = renderToStaticMarkup(
        React.createElement(SubTabs, {
          tabs,
          activeTab: 'tab_a',
          onChange: () => {}
        })
      )

      expect(html).toContain('aria-disabled="true"')
      expect(html).toContain('disabled=""')
      expect(html).toContain('opacity-40')
    })

    it('utiliza focus-visible accesible con anillo de realce', () => {
      const html = renderToStaticMarkup(
        React.createElement(SubTabs, {
          tabs,
          activeTab: 'tab_a',
          onChange: () => {}
        })
      )

      expect(html).toContain('focus-visible:ring-2')
      expect(html).toContain('focus-visible:ring-lilac-500')
      expect(html).toContain('focus-visible:outline-none')
    })
  })

  describe('EmptyState', () => {
    it('renderiza título, descripción e icono accesible', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          title: 'No hay productos en esta categoría',
          description: 'Crea tu primer producto para comenzar a vender.',
          icon: Package
        })
      )

      expect(html).toContain('role="status"')
      expect(html).toContain('No hay productos en esta categoría')
      expect(html).toContain('Crea tu primer producto para comenzar a vender.')
      expect(html).toContain('aria-hidden="true"')
    })

    it('renderiza botón de acción primaria con copy activo y focus accesible', () => {
      const handleClick = vi.fn()
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          title: 'Sin movimientos registrados',
          icon: Search,
          action: {
            label: 'Crear primer producto',
            onClick: handleClick,
            icon: Plus
          }
        })
      )

      expect(html).toContain('Crear primer producto')
      expect(html).toContain('focus-visible:ring-2')
      expect(html).toContain('bg-lilac-600')
    })

    it('muestra estado de carga con elipsis tipográfica … cuando loading=true', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          title: 'Sincronizando inventario',
          icon: AlertCircle,
          action: {
            label: 'Cargando datos',
            onClick: () => {},
            loading: true
          }
        })
      )

      // Debe incluir elipsis tipográfica U+2026 y no tres puntos
      expect(html).toContain('Cargando datos…')
      expect(html).toContain('animate-spin')
    })

    it('soporta modo compacto para tablas o modales reducidos', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          title: 'Tabla vacía',
          compact: true
        })
      )

      expect(html).toContain('py-6')
      expect(html).toContain('text-xs')
    })
  })
})
