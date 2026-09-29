import React from 'react'
import {
  ShoppingCart,
  Layers,
  Boxes,
  Calculator,
  BarChart3,
  Settings,
  LucideIcon
} from 'lucide-react'

export type TabId =
  | 'ventas'
  | 'catalogo'
  | 'inventario'
  | 'corte'
  | 'reportes'
  | 'configuracion'

interface TabItem {
  id: TabId
  label: string
  icon: LucideIcon
  badge?: string
}

const TABS: TabItem[] = [
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { id: 'catalogo', label: 'Catálogo', icon: Layers },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'corte', label: 'Corte', icon: Calculator },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'configuracion', label: 'Configuración', icon: Settings }
]

interface NavigationTabsProps {
  activeTab: TabId
  onSelectTab: (id: TabId) => void
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab
}) => {
  return (
    <nav className="h-12 bg-white border-b border-lilac-200 px-4 flex items-center gap-1 shadow-sm select-none">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-lilac-100 text-lilac-800 shadow-sm border border-lilac-200 font-semibold'
                : 'text-slate-600 hover:text-lilac-900 hover:bg-lilac-50'
            }`}
          >
            <Icon
              className={`w-4 h-4 transition-colors ${
                isActive ? 'text-lilac-600' : 'text-slate-400 group-hover:text-lilac-500'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
