import { useState, useEffect } from 'react'
import { Settings2, User, Users, Plug, Bell, Shield, CheckCircle2, XCircle, DollarSign, Key, Mail, Moon, Sun, Monitor, FolderOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useShopifyStores } from '@/hooks/useShopifyStores'
import { useGoogleConnection } from '@/hooks/useDriveFiles'
import { formatCurrency } from '@/lib/formatters'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { dailyProfitTarget, targets, isLoading, saveDailyProfitTarget, saveTargets } = useSettings()
  const { profile, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { stores } = useShopifyStores()
  const { connection: googleConn } = useGoogleConnection()
  const [inputValue, setInputValue] = useState('')
  const [monthlyRevInput, setMonthlyRevInput] = useState('')
  const [dailyVideosInput, setDailyVideosInput] = useState('')
  const [dailyImagesInput, setDailyImagesInput] = useState('')
  const [maxCpaInput, setMaxCpaInput] = useState('')
  const [minRoasInput, setMinRoasInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [welcomeEnabled, setWelcomeEnabled] = useState(localStorage.getItem('5kday-welcome-disabled') !== 'true')
  const [driveParentFolder, setDriveParentFolder] = useState('')
  const [savingDriveFolder, setSavingDriveFolder] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setInputValue(String(targets.daily_profit))
      setMonthlyRevInput(String(targets.monthly_revenue))
      setDailyVideosInput(String(targets.daily_videos))
      setDailyImagesInput(String(targets.daily_images))
      setMaxCpaInput(String(targets.default_max_cpa))
      setMinRoasInput(String(targets.default_min_roas))
    }
  }, [isLoading, targets])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email, role').order('created_at').then(({ data }) => {
      if (data) setMembers(data)
    })
    supabase.from('settings').select('value').eq('id', 'drive_parent_folder').single().then(({ data }) => {
      if (data?.value?.url) setDriveParentFolder(data.value.url)
    })
  }, [])

  const isAdmin = profile?.role === 'admin'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(inputValue)
    if (!amount || amount <= 0) { toast.error('Monto invalido'); return }
    setIsSaving(true)
    const { error } = await saveDailyProfitTarget(amount)
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
    admin: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/50',
    tech: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/50',
    editor: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Configuracion</h1>
        <p className="text-sm text-slate-500 mt-0.5">Perfil, equipo, integraciones y seguridad</p>
      </div>

      {/* PERFIL */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <User size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Perfil</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Nombre</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile?.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Email</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">{user?.email || '—'}</p>
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
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Users size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Equipo</h2>
            <span className="text-xs text-slate-400 ml-auto font-mono">{members.length} miembros</span>
          </div>

          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#10B981' }}>
                  {m.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
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
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Plug size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Integraciones</h2>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Shopify', detail: `${shopifyConnected} tienda${shopifyConnected !== 1 ? 's' : ''} conectada${shopifyConnected !== 1 ? 's' : ''}`, connected: shopifyConnected > 0, color: '#96bf48' },
              { name: 'Google Drive', detail: googleConn ? `Conectado: ${googleConn.email}` : 'No conectado', connected: googleConnected, color: '#4285f4' },
              { name: 'Meta Ads', detail: 'API Graph v21.0', connected: true, color: '#1877f2' },
              { name: 'Supabase', detail: 'Base de datos + Auth', connected: true, color: '#3ECF8E' },
              { name: 'Vercel', detail: 'Hosting + Serverless', connected: true, color: '#000' },
            ].map(int => (
              <div key={int.name} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: int.color + '15' }}>
                  <Plug size={14} style={{ color: int.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{int.name}</p>
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

      {/* DRIVE */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <FolderOpen size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Google Drive - Creativos</h2>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Carpeta padre de ofertas</Label>
            <p className="text-[10px] text-slate-400 mb-1">Al crear una oferta, se creara automaticamente la estructura de carpetas dentro de esta carpeta.</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveParentFolder}
                onChange={e => setDriveParentFolder(e.target.value)}
                disabled={!isAdmin}
                className="font-mono text-xs"
              />
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingDriveFolder}
                  onClick={async () => {
                    setSavingDriveFolder(true)
                    await supabase.from('settings').upsert({
                      id: 'drive_parent_folder',
                      value: { url: driveParentFolder },
                      updated_at: new Date().toISOString(),
                    }, { onConflict: 'id' })
                    setSavingDriveFolder(false)
                    toast.success('Carpeta padre guardada')
                  }}
                >
                  {savingDriveFolder ? '...' : 'Guardar'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OBJETIVOS */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <DollarSign size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Objetivos</h2>
          </div>

          {!isAdmin && (
            <p className="text-xs text-amber-600">Solo los administradores pueden modificar esta configuracion.</p>
          )}

          <form onSubmit={async (e) => {
            e.preventDefault()
            setIsSaving(true)
            const { error } = await saveTargets({
              daily_profit: Number(inputValue) || targets.daily_profit,
              monthly_revenue: Number(monthlyRevInput) || targets.monthly_revenue,
              daily_videos: Number(dailyVideosInput) || targets.daily_videos,
              daily_images: Number(dailyImagesInput) || targets.daily_images,
              default_max_cpa: Number(maxCpaInput) || targets.default_max_cpa,
              default_min_roas: Number(minRoasInput) || targets.default_min_roas,
            })
            setIsSaving(false)
            if (error) { toast.error(error); return }
            toast.success('Objetivos actualizados')
          }} className="space-y-4">

            {/* Financial targets */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Metas financieras</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Meta profit diario (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <Input type="number" min="1" step="1" className="pl-7 font-mono" value={inputValue} onChange={e => setInputValue(e.target.value)} disabled={!isAdmin || isLoading} placeholder="5000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Meta facturacion mensual (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <Input type="number" min="1" step="1" className="pl-7 font-mono" value={monthlyRevInput} onChange={e => setMonthlyRevInput(e.target.value)} disabled={!isAdmin || isLoading} placeholder="60000" />
                  </div>
                </div>
              </div>
            </div>

            {/* Creative targets */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Metas de creativos diarios</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Videos por dia</Label>
                  <Input type="number" min="0" step="1" className="font-mono" value={dailyVideosInput} onChange={e => setDailyVideosInput(e.target.value)} disabled={!isAdmin || isLoading} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Imagenes por dia</Label>
                  <Input type="number" min="0" step="1" className="font-mono" value={dailyImagesInput} onChange={e => setDailyImagesInput(e.target.value)} disabled={!isAdmin || isLoading} placeholder="15" />
                </div>
              </div>
            </div>

            {/* Winner criteria */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Criterios de anuncio ganador (default)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">CPA maximo (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                    <Input type="number" min="0" step="0.5" className="pl-7 font-mono" value={maxCpaInput} onChange={e => setMaxCpaInput(e.target.value)} disabled={!isAdmin || isLoading} placeholder="15" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">ROAS minimo</Label>
                  <Input type="number" min="0" step="0.1" className="font-mono" value={minRoasInput} onChange={e => setMinRoasInput(e.target.value)} disabled={!isAdmin || isLoading} placeholder="1.5" />
                </div>
              </div>
            </div>

            {isAdmin && (
              <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isSaving || isLoading}>
                {isSaving ? 'Guardando...' : 'Guardar objetivos'}
              </Button>
            )}

            <p className="text-[10px] text-slate-400">
              Actualmente: profit diario <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">{formatCurrency(targets.daily_profit)}</span>/dia ·
              facturacion <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">{formatCurrency(targets.monthly_revenue)}</span>/mes ·
              creativos <span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">{targets.daily_videos}</span>v/<span className="font-semibold text-slate-600 dark:text-slate-300 font-mono">{targets.daily_images}</span>img por dia
            </p>
          </form>
        </CardContent>
      </Card>

      {/* APARIENCIA */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Moon size={16} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Apariencia</h2>
          </div>

          <div className="flex gap-3">
            {([
              { value: 'light' as const, label: 'Claro', Icon: Sun },
              { value: 'dark' as const, label: 'Oscuro', Icon: Moon },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all flex-1 ${
                  theme === opt.value
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <opt.Icon size={18} className={theme === opt.value ? 'text-emerald-600' : 'text-slate-400'} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${theme === opt.value ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {opt.label}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Welcome animation toggle */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Animacion de bienvenida</p>
              <p className="text-xs text-slate-400">Pantalla animada al abrir la app</p>
            </div>
            <button
              onClick={() => {
                const current = localStorage.getItem('5kday-welcome-disabled') === 'true'
                localStorage.setItem('5kday-welcome-disabled', current ? 'false' : 'true')
                toast.success(current ? 'Animacion activada' : 'Animacion desactivada')
                setWelcomeEnabled(current)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                welcomeEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                welcomeEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* NOTIFICACIONES */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Bell size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notificaciones</h2>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Alertas de ban de WhatsApp', description: 'Notificacion cuando un numero es baneado o flaggeado', enabled: true },
              { label: 'Resumen diario', description: 'Email con metricas del dia anterior', enabled: false },
              { label: 'Ordenes Shopify', description: 'Notificacion en tiempo real de nuevas ventas', enabled: true },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.label}</p>
                  <p className="text-xs text-slate-400">{n.description}</p>
                </div>
                <div className={`h-6 w-10 rounded-full relative cursor-pointer transition-colors ${n.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
                  <div className={`h-5 w-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${n.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Las notificaciones push se configuraran en una proxima version.</p>
        </CardContent>
      </Card>

      {/* SEGURIDAD */}
      <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800/60">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <Shield size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Seguridad</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <p className="text-xs text-slate-500">Cambiar contrasena de acceso</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nueva contrasena</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.newPass}
                  onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Confirmar contrasena</Label>
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

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-400" />
              <p className="text-xs text-slate-500">
                Sesion activa: <span className="font-mono text-slate-600 dark:text-slate-400">{user?.email}</span>
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
