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
            className={`h-9 px-4 rounded-lg flex items-center gap-2 text-sm border focus:outline-none focus-visible:outline-none transition-colors duration-100 cursor-pointer ${
              isActive
                ? 'bg-lilac-100 dark:bg-lilac-950/60 text-lilac-800 dark:text-lilac-200 shadow-sm border-lilac-200 dark:border-lilac-800 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon
              className={`w-4 h-4 transition-colors ${
                isActive ? 'text-lilac-600 dark:text-lilac-400' : 'text-slate-400 dark:text-slate-400'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
