import {
  LayoutDashboard,
  Smartphone,
  DollarSign,
  TrendingUp,
  Users,
  Settings2,
  LogOut,
} from 'lucide-react'
import { Logo } from './Logo'
import { NavItem } from './NavItem'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/meta', label: 'Activos Meta', Icon: Smartphone },
  { to: '/financial', label: 'Financiero', Icon: DollarSign },
  { to: '/pipeline', label: 'Pipeline', Icon: TrendingUp },
  { to: '/team', label: 'Equipo', Icon: Users },
  { to: '/settings', label: 'Configuración', Icon: Settings2 },
]

export function Sidebar() {
  const { profile, user, signOut } = useAuth()

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
      style={{ backgroundColor: '#0B1A2E' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Logo size="sm" />
        <p className="text-xs text-slate-400 mt-1">OPS CENTER</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className="text-xs font-semibold text-white"
              style={{ backgroundColor: '#10B981' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors w-full"
        >
          <LogOut size={14} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
