import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  to: string
  label: string
  Icon: LucideIcon
  collapsed?: boolean
}

export function NavItem({ to, label, Icon, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} gap-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white/10 text-emerald-400 border-l-2 border-emerald-400'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}
