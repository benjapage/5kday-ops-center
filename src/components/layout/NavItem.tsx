import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  to: string
  label: string
  Icon: LucideIcon
}

export function NavItem({ to, label, Icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white/10 text-emerald-400 border-l-2 border-emerald-400'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  )
}
