import { useState, useEffect } from 'react'
import { Settings2, User, Users, Plug, Bell, Shield, CheckCircle2, XCircle, DollarSign, Key, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { useShopifyStores } from '@/hooks/useShopifyStores'
import { useGoogleConnection } from '@/hooks/useDriveFiles'
import { formatCurrency } from '@/lib/formatters'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { monthlyTarget, isLoading, saveMonthlyTarget } = useSettings()
  const { profile, user } = useAuth()
  const { stores } = useShopifyStores()
  const { connection: googleConn } = useGoogleConnection()
  const [inputValue, setInputValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!isLoading) setInputValue(String(monthlyTarget))
  }, [isLoading, monthlyTarget])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email, role').order('created_at').then(({ data }) => {
      if (data) setMembers(data)
    })
  }, [])

  const isAdmin = profile?.role === 'admin'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(inputValue)
    if (!amount || amount <= 0) { toast.error('Monto invalido'); return }
    setIsSaving(true)
    const { error } = await saveMonthlyTarget(amount)
    setIsSaving(false)
    if (error) { toast.error(error); return }
    toast.success(`Meta actualizada a ${formatCurrency(amount)}`)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error('Las contrasenas no coinciden')
      return
    }
    if (passwordForm.newPass.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres')
      return
    }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
    setChangingPassword(false)
    if (error) { toast.error(error.message); return }
    toast.success('Contrasena actualizada')
    setPasswordForm({ current: '', newPass: '', confirm: '' })
  }

  const shopifyConnected = stores.filter(s => s.is_active).length
  const googleConnected = !!googleConn

  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', tech: 'Tech', editor: 'Editor' }
  const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    tech: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    editor: 'bg-slate-50 text-slate-600 border-slate-200',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Configuracion</h1>
        <p className="text-sm text-slate-500 mt-0.5">Perfil, equipo, integraciones y seguridad</p>
      </div>

      {/* PERFIL */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Perfil</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Nombre</p>
              <p className="text-sm font-medium text-slate-800">{profile?.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Email</p>
              <p className="text-sm text-slate-600 font-mono">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Rol</p>
              <Badge variant="outline" className={`text-xs ${ROLE_COLORS[profile?.role ?? 'editor']}`}>
                {ROLE_LABELS[profile?.role ?? 'editor']}
              </Badge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">ID</p>
              <p className="text-xs text-slate-400 font-mono truncate">{profile?.id || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EQUIPO */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Equipo</h2>
            <span className="text-xs text-slate-400 ml-auto font-mono">{members.length} miembros</span>
          </div>

          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#10B981' }}>
                  {m.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {m.full_name}
                    {m.id === profile?.id && <span className="text-xs text-slate-400 ml-1.5">(yo)</span>}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">{m.email}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${ROLE_COLORS[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* INTEGRACIONES */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plug size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Integraciones</h2>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Shopify', detail: `${shopifyConnected} tienda${shopifyConnected !== 1 ? 's' : ''} conectada${shopifyConnected !== 1 ? 's' : ''}`, connected: shopifyConnected > 0, color: '#96bf48' },
              { name: 'Google Drive', detail: googleConn ? `Conectado: ${googleConn.email}` : 'No conectado', connected: googleConnected, color: '#4285f4' },
              { name: 'Meta Ads', detail: 'API Graph v21.0', connected: true, color: '#1877f2' },
              { name: 'Supabase', detail: 'Base de datos + Auth', connected: true, color: '#3ECF8E' },
              { name: 'Vercel', detail: 'Hosting + Serverless', connected: true, color: '#000' },
            ].map(int => (
              <div key={int.name} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: int.color + '15' }}>
                  <Plug size={14} style={{ color: int.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{int.name}</p>
                  <p className="text-xs text-slate-400">{int.detail}</p>
                </div>
                {int.connected ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-medium">Activo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    <XCircle size={14} />
                    <span className="text-xs font-medium">Desconectado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* METAS FINANCIERAS */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <DollarSign size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Metas financieras</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Meta de facturacion mensual (USD)</Label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    className="pl-7 font-mono"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={!isAdmin || isLoading}
                    placeholder="5000"
                  />
                </div>
                {isAdmin && (
                  <Button
                    type="submit"
                    className="text-white shrink-0"
                    style={{ backgroundColor: '#10B981' }}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Actualmente: <span className="font-semibold text-slate-600 font-mono">{formatCurrency(monthlyTarget)}</span> / mes
              </p>
              {!isAdmin && (
                <p className="text-xs text-amber-600">Solo los administradores pueden modificar esta configuracion.</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* NOTIFICACIONES */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Notificaciones</h2>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Alertas de ban de WhatsApp', description: 'Notificacion cuando un numero es baneado o flaggeado', enabled: true },
              { label: 'Resumen diario', description: 'Email con metricas del dia anterior', enabled: false },
              { label: 'Ordenes Shopify', description: 'Notificacion en tiempo real de nuevas ventas', enabled: true },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{n.label}</p>
                  <p className="text-xs text-slate-400">{n.description}</p>
                </div>
                <div className={`h-6 w-10 rounded-full relative cursor-pointer transition-colors ${n.enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <div className={`h-5 w-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${n.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Las notificaciones push se configuraran en una proxima version.</p>
        </CardContent>
      </Card>

      {/* SEGURIDAD */}
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Seguridad</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <p className="text-xs text-slate-500">Cambiar contrasena de acceso</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Nueva contrasena</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.newPass}
                  onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Confirmar contrasena</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={changingPassword || !passwordForm.newPass}
              className="gap-1.5"
            >
              <Key size={13} />
              {changingPassword ? 'Actualizando...' : 'Cambiar contrasena'}
            </Button>
          </form>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-400" />
              <p className="text-xs text-slate-500">
                Sesion activa: <span className="font-mono text-slate-600">{user?.email}</span>
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Ultimo login: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('es-AR') : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
