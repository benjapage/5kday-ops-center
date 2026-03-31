import { useState } from 'react'
import { Megaphone, Building2, User, Plus, Trash2, Edit2, MoreHorizontal, AlertTriangle, MessageCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { WaAccountTable } from '@/components/meta/WaAccountTable'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────
interface AdAccount {
  id: string
  name: string
  account_id: string
  status: 'active' | 'disabled' | 'banned'
  currency: string
  channel_type?: string | null
  bm_id?: string | null
  notes?: string | null
}

interface BusinessManager {
  id: string
  name: string
  bm_id: string
  status: 'active' | 'restricted' | 'banned'
  bm_function?: string | null
  bm_usage?: 'usando' | 'sin_usar' | null
  profile_id?: string | null
  notes?: string | null
}

interface MetaProfile {
  id: string
  name: string
  profile_id: string
  status: 'active' | 'restricted' | 'banned'
  profile_function?: string | null
  notes?: string | null
}

// ─── Generic CRUD hook ───────────────────────────────────
function useMetaAssets<T extends { id: string }>(table: string) {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    setItems((data ?? []) as T[])
    setIsLoading(false)
  }, [table])

  useEffect(() => { fetch() }, [fetch])

  async function create(item: Omit<T, 'id'>) {
    const { error } = await supabase.from(table).insert(item as any)
    if (error) return { error: error.message }
    await fetch()
    return { error: null }
  }

  async function update(id: string, updates: Partial<T>) {
    const { error } = await supabase.from(table).update(updates as any).eq('id', id)
    if (error) return { error: error.message }
    await fetch()
    return { error: null }
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return { error: error.message }
    await fetch()
    return { error: null }
  }

  return { items, isLoading, create, update, remove, refresh: fetch }
}

// ─── Status colors ───────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', darkBg: 'dark:bg-green-900/20', darkText: 'dark:text-green-400' },
  disabled: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', darkBg: 'dark:bg-slate-700/30', darkText: 'dark:text-slate-400' },
  restricted: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', darkBg: 'dark:bg-amber-900/20', darkText: 'dark:text-amber-400' },
  banned: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', darkBg: 'dark:bg-red-900/20', darkText: 'dark:text-red-400' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.disabled
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${s.bg} ${s.text} ${s.border} ${s.darkBg} ${s.darkText}`}>
      {status === 'active' ? 'Activa' : status === 'disabled' ? 'Deshabilitada' : status === 'restricted' ? 'Restringida' : status === 'banned' ? 'Baneada' : status}
    </Badge>
  )
}

function FunctionBadge({ fn }: { fn?: string | null }) {
  if (!fn) return null
  const colors: Record<string, string> = {
    whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    landing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    numeros: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    cuentas: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    mixto: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
    publicitario: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    calentamiento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    admin: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
    soporte: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${colors[fn] ?? colors.mixto}`}>
      {fn}
    </span>
  )
}

function UsageBadge({ usage }: { usage?: string | null }) {
  if (!usage) return null
  const styles: Record<string, string> = {
    usando: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    sin_usar: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  }
  const labels: Record<string, string> = { usando: 'Usando', sin_usar: 'Sin usar' }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${styles[usage] ?? styles.sin_usar}`}>
      {labels[usage] ?? usage}
    </span>
  )
}

// ─── Add/Edit Dialog ─────────────────────────────────────
function AssetDialog({
  open, onOpenChange, onSubmit, title, icon: Icon, iconColor,
  fields, initialValues, submitLabel
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (data: Record<string, string>) => Promise<void>
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  fields: { key: string; label: string; placeholder: string; required?: boolean; type?: 'text' | 'select'; options?: { value: string; label: string }[] }[]
  initialValues?: Record<string, string>
  submitLabel: string
}) {
  const [form, setForm] = useState<Record<string, string>>(initialValues ?? {})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setForm(initialValues ?? {})
  }, [open, initialValues])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSubmit(form)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconColor + '15' }}>
              <span style={{ color: iconColor }}><Icon size={16} /></span>
            </div>
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">Completa los campos requeridos</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-medium">{f.label}{f.required && ' *'}</Label>
              {f.type === 'select' ? (
                <Select value={form[f.key] ?? ''} onValueChange={v => setForm(p => ({ ...p, [f.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder={f.placeholder} /></SelectTrigger>
                  <SelectContent>
                    {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={loading}>
              {loading ? 'Guardando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Asset Card Section ──────────────────────────────────
function AssetSection<T extends { id: string; name: string; status: string; notes?: string | null }>({
  title, icon: Icon, iconColor, items, isLoading, idField, idLabel,
  getId, onAdd, onUpdate, onDelete, canWrite, fields, getFn, getUsage,
  restrictedBmWarning, restrictedBmWarningText, getLinkedName,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  items: T[]
  isLoading: boolean
  idField: string
  idLabel: string
  getId: (item: T) => string
  onAdd: (data: Record<string, string>) => Promise<void>
  onUpdate: (id: string, data: Record<string, string>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  canWrite: boolean
  fields: { key: string; label: string; placeholder: string; required?: boolean; type?: 'text' | 'select'; options?: { value: string; label: string }[] }[]
  getFn?: (item: T) => string | null | undefined
  getUsage?: (item: T) => string | null | undefined
  restrictedBmWarning?: boolean
  restrictedBmWarningText?: string
  getLinkedName?: (item: T) => string | null
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<T | null>(null)

  const statusOptions = [
    { value: 'active', label: 'Activa' },
    { value: 'disabled', label: 'Deshabilitada' },
    { value: 'restricted', label: 'Restringida' },
    { value: 'banned', label: 'Baneada' },
  ]

  const allFields = [
    ...fields,
    { key: 'status', label: 'Estado', placeholder: 'Estado', type: 'select' as const, options: statusOptions },
    { key: 'notes', label: 'Notas', placeholder: 'Notas opcionales' },
  ]

  const counts = {
    active: items.filter(i => i.status === 'active').length,
    banned: items.filter(i => i.status === 'banned').length,
    restricted: items.filter(i => i.status === 'restricted').length,
  }

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconColor + '12' }}>
              <span style={{ color: iconColor }}><Icon size={20} /></span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{items.length} total</p>
            </div>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAddOpen(true)}>
              <Plus size={12} /> Agregar
            </Button>
          )}
        </div>

        {/* Mini counters */}
        <div className="flex gap-2 mb-4">
          {[
            { label: 'Activas', count: counts.active, color: '#22C55E' },
            { label: 'Restringidas', count: counts.restricted, color: '#F59E0B' },
            { label: 'Baneadas', count: counts.banned, color: '#E8816D' },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700/50">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{c.count}</span>
              <span className="text-[10px] text-slate-400">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Restricted BM warning - Cambio 12 */}
        {restrictedBmWarning && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {restrictedBmWarningText || 'BM vinculado restringido — activos en riesgo'}
            </p>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <p className="text-xs text-slate-400 text-center py-6">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin {title.toLowerCase()} registradas</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-slate-400 truncate">{idLabel}: {getId(item)}</p>
                    {getLinkedName && getLinkedName(item) && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">· {getLinkedName(item)}</span>
                    )}
                  </div>
                </div>
                {getUsage && <UsageBadge usage={getUsage(item)} />}
                {getFn && <FunctionBadge fn={getFn(item)} />}
                <StatusBadge status={item.status} />
                {canWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => setEditItem(item)}>
                        <Edit2 size={12} className="mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={async () => {
                        if (!confirm(`Eliminar ${item.name}?`)) return
                        await onDelete(item.id)
                      }}>
                        <Trash2 size={12} className="mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add dialog */}
        <AssetDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSubmit={async (data) => { await onAdd(data); setAddOpen(false) }}
          title={`Nueva ${title.slice(0, -1)}`}
          icon={Icon}
          iconColor={iconColor}
          fields={allFields}
          initialValues={{ status: 'active' }}
          submitLabel="Crear"
        />

        {/* Edit dialog */}
        {editItem && (
          <AssetDialog
            open={true}
            onOpenChange={(v) => { if (!v) setEditItem(null) }}
            onSubmit={async (data) => { await onUpdate(editItem.id, data); setEditItem(null) }}
            title={`Editar ${title.slice(0, -1)}`}
            icon={Icon}
            iconColor={iconColor}
            fields={allFields}
            initialValues={{
              name: editItem.name,
              [idField]: getId(editItem),
              status: editItem.status,
              notes: editItem.notes ?? '',
              channel_type: (editItem as any).channel_type || '__none__',
              bm_id: (idField !== 'bm_id' && (editItem as any).bm_id) ? (editItem as any).bm_id : '__none__',
              bm_function: (editItem as any).bm_function || '__none__',
              bm_usage: (editItem as any).bm_usage || '__none__',
              profile_id: (idField !== 'profile_id' && (editItem as any).profile_id) ? (editItem as any).profile_id : '__none__',
              profile_function: (editItem as any).profile_function || '__none__',
            }}
            submitLabel="Guardar"
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────
export default function MetaAssets() {
  const { profile } = useAuth()
  const canWrite = profile?.role === 'admin' || profile?.role === 'tech'

  const adAccounts = useMetaAssets<AdAccount>('meta_ad_accounts')
  const bms = useMetaAssets<BusinessManager>('meta_business_managers')
  const profiles = useMetaAssets<MetaProfile>('meta_profiles')

  // Cambio 12: detect restricted BMs for cascade warning
  const hasRestrictedBm = bms.items.some(b => b.status === 'restricted' || b.status === 'banned')
  const restrictedBmNames = bms.items.filter(b => b.status === 'restricted' || b.status === 'banned').map(b => b.name)

  // Lookup helpers for relationship chain
  const bmLookup = Object.fromEntries(bms.items.map(b => [b.bm_id, b.name]))
  const profileLookup = Object.fromEntries(profiles.items.map(p => [p.id, p.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Activos Meta</h1>
        <p className="text-sm text-slate-500 mt-0.5">Numeros WA, perfiles, cuentas publicitarias y BMs</p>
      </div>

      {/* ─── Bloque 1: Numeros WhatsApp (Cambio 11) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={16} className="text-green-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Numeros de WhatsApp</h2>
          <span className="text-[10px] text-slate-400 ml-1">Stock principal</span>
        </div>
        <WaAccountTable bmLookup={bmLookup} />
      </div>

      {/* ─── Bloque 2: Perfiles de Meta (Cambio 11) — prioridad alta ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User size={16} className="text-pink-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Perfiles de Meta</h2>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <AssetSection<MetaProfile>
            title="Perfiles"
            icon={User}
            iconColor="#EC4899"
            items={profiles.items}
            isLoading={profiles.isLoading}
            idField="profile_id"
            idLabel="Profile ID"
            getId={(item) => item.profile_id}
            canWrite={canWrite}
            getFn={(item) => item.profile_function}
            fields={[
              { key: 'name', label: 'Nombre / Alias', placeholder: 'Ej: Juan Perez', required: true },
              { key: 'profile_id', label: 'Profile ID', placeholder: 'Opcional — ID tecnico' },
              { key: 'profile_function', label: 'Funcion del perfil', placeholder: 'Funcion...', type: 'select', options: [
                { value: '__none__', label: '— Sin funcion —' },
                { value: 'publicitario', label: 'Publicitario' },
                { value: 'calentamiento', label: 'Calentamiento' },
                { value: 'admin', label: 'Admin' },
                { value: 'soporte', label: 'Soporte' },
              ]},
            ]}
            onAdd={async (data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await profiles.create({
                name: data.name,
                profile_id: data.profile_id || null,
                status: (data.status as MetaProfile['status']) || 'active',
                profile_function: clean(data.profile_function),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('Perfil creado')
            }}
            onUpdate={async (id, data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await profiles.update(id, {
                name: data.name, profile_id: data.profile_id,
                status: data.status as MetaProfile['status'],
                profile_function: clean(data.profile_function),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('Perfil actualizado')
            }}
            onDelete={async (id) => {
              const { error } = await profiles.remove(id)
              if (error) toast.error(error)
              else toast.success('Perfil eliminado')
            }}
          />
        </div>
      </div>

      {/* ─── Bloque 3: Cuentas Publicitarias + BMs (dato secundario) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cuentas publicitarias y BMs</h2>
          <span className="text-[10px] text-slate-400 ml-1">Infraestructura</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AssetSection<AdAccount>
            title="Cuentas publicitarias"
            icon={Megaphone}
            iconColor="#3B82F6"
            items={adAccounts.items}
            isLoading={adAccounts.isLoading}
            idField="account_id"
            idLabel="ID"
            getId={(item) => item.account_id}
            canWrite={canWrite}
            getFn={(item) => item.channel_type}
            getLinkedName={(item) => item.bm_id ? (bmLookup[item.bm_id] ? `BM: ${bmLookup[item.bm_id]}` : null) : null}
            restrictedBmWarning={hasRestrictedBm}
            restrictedBmWarningText={restrictedBmNames.length > 0 ? `${restrictedBmNames.join(', ')} — restringido, activos en riesgo` : undefined}
            fields={[
              { key: 'name', label: 'Nombre', placeholder: 'Ej: Cuenta principal', required: true },
              { key: 'account_id', label: 'Account ID', placeholder: 'Ej: 123456789', required: true },
              { key: 'currency', label: 'Moneda', placeholder: 'USD' },
              { key: 'channel_type', label: 'Tipo de canal', placeholder: 'Canal...', type: 'select', options: [
                { value: '__none__', label: '— Sin canal —' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'landing', label: 'Landing (Shopify)' },
              ]},
              { key: 'bm_id', label: 'BM vinculado', placeholder: 'Seleccionar BM...', type: 'select', options: [
                { value: '__none__', label: '— Sin BM —' },
                ...bms.items.map(b => ({ value: b.bm_id, label: `${b.name} (${b.bm_id.slice(0, 8)}...)` })),
              ]},
            ]}
            onAdd={async (data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await adAccounts.create({
                name: data.name, account_id: data.account_id,
                status: (data.status as AdAccount['status']) || 'active',
                currency: data.currency || 'USD',
                channel_type: clean(data.channel_type),
                bm_id: clean(data.bm_id),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('Cuenta creada')
            }}
            onUpdate={async (id, data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await adAccounts.update(id, {
                name: data.name, account_id: data.account_id,
                status: data.status as AdAccount['status'],
                currency: data.currency,
                channel_type: clean(data.channel_type),
                bm_id: clean(data.bm_id),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('Cuenta actualizada')
            }}
            onDelete={async (id) => {
              const { error } = await adAccounts.remove(id)
              if (error) toast.error(error)
              else toast.success('Cuenta eliminada')
            }}
          />

          <AssetSection<BusinessManager>
            title="Business Managers"
            icon={Building2}
            iconColor="#8B5CF6"
            items={bms.items}
            isLoading={bms.isLoading}
            idField="bm_id"
            idLabel="BM ID"
            getId={(item) => item.bm_id}
            canWrite={canWrite}
            getFn={(item) => item.bm_function}
            getUsage={(item) => item.bm_usage}
            getLinkedName={(item) => item.profile_id ? (profileLookup[item.profile_id] ? `Perfil: ${profileLookup[item.profile_id]}` : null) : null}
            fields={[
              { key: 'name', label: 'Nombre', placeholder: 'Ej: BM Principal', required: true },
              { key: 'bm_id', label: 'BM ID', placeholder: 'Ej: 123456789', required: true },
              { key: 'bm_function', label: 'Funcion del BM', placeholder: 'Funcion...', type: 'select', options: [
                { value: '__none__', label: '— Sin funcion —' },
                { value: 'numeros', label: 'Para numeros' },
                { value: 'cuentas', label: 'Para cuentas publicitarias' },
                { value: 'mixto', label: 'Mixto' },
              ]},
              { key: 'bm_usage', label: 'En uso', placeholder: 'En uso...', type: 'select', options: [
                { value: '__none__', label: '— Sin definir —' },
                { value: 'usando', label: 'Usando' },
                { value: 'sin_usar', label: 'Sin usar' },
              ]},
              { key: 'profile_id', label: 'Perfil vinculado', placeholder: 'Seleccionar perfil...', type: 'select', options: [
                { value: '__none__', label: '— Sin perfil —' },
                ...profiles.items.map(p => ({ value: p.id, label: p.name })),
              ]},
            ]}
            onAdd={async (data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await bms.create({
                name: data.name, bm_id: data.bm_id,
                status: (data.status as BusinessManager['status']) || 'active',
                bm_function: clean(data.bm_function),
                bm_usage: clean(data.bm_usage),
                profile_id: clean(data.profile_id),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('BM creado')
            }}
            onUpdate={async (id, data) => {
              const clean = (v?: string) => (!v || v === '__none__') ? null : v
              const { error } = await bms.update(id, {
                name: data.name, bm_id: data.bm_id,
                status: data.status as BusinessManager['status'],
                bm_function: clean(data.bm_function),
                bm_usage: clean(data.bm_usage),
                profile_id: clean(data.profile_id),
                notes: clean(data.notes),
              } as any)
              if (error) toast.error(error)
              else toast.success('BM actualizado')
            }}
            onDelete={async (id) => {
              const { error } = await bms.remove(id)
              if (error) toast.error(error)
              else toast.success('BM eliminado')
            }}
          />
        </div>
      </div>
    </div>
  )
}
