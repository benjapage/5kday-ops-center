import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  DollarSign,
  TrendingUp,
  Users,
  Settings2,
  Palette,
  Plug,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
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
  { to: '/creativos', label: 'Creativos', Icon: Palette },
  { to: '/team', label: 'Equipo', Icon: Users },
  { to: '/integrations', label: 'Integraciones', Icon: Plug },
  { to: '/settings', label: 'Configuración', Icon: Settings2 },
]

export function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div
        className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4 md:hidden"
        style={{ backgroundColor: '#0B1A2E' }}
      >
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-xs text-slate-400 font-medium">OPS</span>
        </div>
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="h-10 w-10 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300 ease-in-out
          ${/* Mobile: slide in/out from left */''}
          max-md:top-14 max-md:h-[calc(100vh-3.5rem)] max-md:w-64
          ${mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
          ${/* Desktop: normal collapsed/expanded */''}
          md:translate-x-0 ${collapsed ? 'md:w-[68px]' : 'md:w-64'}
        `}
        style={{ backgroundColor: '#0B1A2E' }}
        aria-label="Barra lateral"
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
      >
        {/* Logo — desktop only */}
        <div className={`border-b border-white/10 items-center hidden md:flex ${collapsed ? 'px-4 py-5 justify-center' : 'px-6 py-5'}`}>
          <Logo size="sm" />
          {!collapsed && <p className="text-xs text-slate-400 ml-2">OPS CENTER</p>}
        </div>

        {/* Toggle button — desktop only */}
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className="absolute top-5 -right-3 h-6 w-6 rounded-full bg-slate-700 border border-slate-600 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 transition-colors z-50 shadow-lg hidden md:flex"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className={`flex items-center ${collapsed ? 'md:justify-center' : ''} gap-3 mb-3`}>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: '#10B981' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {(!collapsed || mobileOpen) && (
              <div className="flex-1 min-w-0 md:hidden block">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0 hidden md:block">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
              </div>
            )}
          </div>
          <div className={`flex items-center ${collapsed ? 'md:flex-col md:gap-2' : ''} gap-2`}>
            <button
              onClick={signOut}
              aria-label="Cerrar sesión"
              className={`flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors ${collapsed ? '' : 'flex-1'} max-md:flex-1`}
            >
              <LogOut size={14} aria-hidden="true" />
              {(!collapsed || mobileOpen) && <span className="md:hidden">Cerrar sesión</span>}
              {!collapsed && <span className="hidden md:inline">Cerrar sesión</span>}
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
    </>
  )
}
