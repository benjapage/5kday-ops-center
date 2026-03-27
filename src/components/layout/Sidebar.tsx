import { useState } from 'react'
import {
  LayoutDashboard,
  Smartphone,
  DollarSign,
  TrendingUp,
  Users,
  Settings2,
  Plug,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Logo } from './Logo'
import { NavItem } from './NavItem'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/meta', label: 'Activos Meta', Icon: Smartphone },
  { to: '/financial', label: 'Financiero', Icon: DollarSign },
  { to: '/pipeline', label: 'Pipeline', Icon: TrendingUp },
  { to: '/team', label: 'Equipo', Icon: Users },
  { to: '/integrations', label: 'Integraciones', Icon: Plug },
  { to: '/settings', label: 'Configuración', Icon: Settings2 },
]

export function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(true)

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300 ease-in-out ${collapsed ? 'w-[68px]' : 'w-64'}`}
      style={{ backgroundColor: '#0B1A2E' }}
      aria-label="Barra lateral"
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      {/* Logo */}
      <div className={`border-b border-white/10 flex items-center ${collapsed ? 'px-4 py-5 justify-center' : 'px-6 py-5'}`}>
        <Logo size="sm" />
        {!collapsed && <p className="text-xs text-slate-400 ml-2">OPS CENTER</p>}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="absolute top-5 -right-3 h-6 w-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 transition-colors z-50 shadow-lg"
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1" aria-label="Navegación principal">
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-3`}>
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback
              className="text-xs font-semibold text-white"
              style={{ backgroundColor: '#10B981' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
            </div>
          )}
        </div>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          <button
            onClick={signOut}
            aria-label="Cerrar sesión"
            className={`flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors ${collapsed ? '' : 'flex-1'}`}
          >
            <LogOut size={14} aria-hidden="true" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
