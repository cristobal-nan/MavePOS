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
  { id: 'catalogo', label: 'Productos', icon: Layers },
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
    <nav className="h-12 bg-white dark:bg-slate-800 border-b border-lilac-200 dark:border-slate-700 px-4 flex items-center gap-1 shadow-sm select-none">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-lilac-100 dark:bg-lilac-950/60 text-lilac-800 dark:text-lilac-200 shadow-sm border border-lilac-200 dark:border-lilac-800 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-lilac-900 dark:hover:text-lilac-200 hover:bg-lilac-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <Icon
              className={`w-4 h-4 transition-colors ${
                isActive ? 'text-lilac-600 dark:text-lilac-400' : 'text-slate-400 dark:text-slate-400 group-hover:text-lilac-500'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
