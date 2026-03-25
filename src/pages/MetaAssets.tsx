import { useState } from 'react'
import { RefreshCw, Loader2, Megaphone, Building2, User, Plus, Trash2, Edit2, MoreHorizontal } from 'lucide-react'
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
  notes?: string | null
}

interface BusinessManager {
  id: string
  name: string
  bm_id: string
  status: 'active' | 'restricted' | 'banned'
  notes?: string | null
}

interface MetaProfile {
  id: string
  name: string
  profile_id: string
  status: 'active' | 'restricted' | 'banned'
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
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  disabled: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
  restricted: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  banned: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.disabled
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${s.bg} ${s.text} ${s.border}`}>
      {status === 'active' ? 'Activa' : status === 'disabled' ? 'Deshabilitada' : status === 'restricted' ? 'Restringida' : status === 'banned' ? 'Baneada' : status}
    </Badge>
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
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'select'; options?: { value: string; label: string }[] }[]
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
              <Label className="text-xs font-medium text-slate-600">{f.label}</Label>
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
  getId, onAdd, onUpdate, onDelete, canWrite, fields,
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
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'select'; options?: { value: string; label: string }[] }[]
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
            { label: 'Baneadas', count: counts.banned, color: '#EF4444' },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700/50">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-[10px] font-semibold text-slate-600">{c.count}</span>
              <span className="text-[10px] text-slate-400">{c.label}</span>
            </div>
          ))}
        </div>

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
                  <p className="text-[10px] font-mono text-slate-400 truncate">{idLabel}: {getId(item)}</p>
                </div>
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
  const [syncing, setSyncing] = useState(false)
  const { profile } = useAuth()
  const canWrite = profile?.role === 'admin' || profile?.role === 'tech'

  const adAccounts = useMetaAssets<AdAccount>('meta_ad_accounts')
  const bms = useMetaAssets<BusinessManager>('meta_business_managers')
  const profiles = useMetaAssets<MetaProfile>('meta_profiles')

  async function syncMeta() {
    setSyncing(true)
    try {
      const res = await fetch('/api/meta-sync?days=30')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error al sincronizar'); return }
      toast.success(`Sincronizado: ${data.synced.accountDays} dias`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Activos Meta</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contingencias: numeros WA, cuentas publicitarias, BMs y perfiles</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-8" disabled={syncing} onClick={syncMeta}>
          {syncing ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <RefreshCw size={13} className="mr-1.5" />}
          Sync Meta Ads
        </Button>
      </div>

      {/* WhatsApp Accounts */}
      <WaAccountTable />

      {/* 3 Asset Cards */}
      <div className="grid grid-cols-3 gap-4">
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
          fields={[
            { key: 'name', label: 'Nombre', placeholder: 'Ej: Cuenta principal' },
            { key: 'account_id', label: 'Account ID', placeholder: 'Ej: 123456789' },
            { key: 'currency', label: 'Moneda', placeholder: 'USD' },
          ]}
          onAdd={async (data) => {
            const { error } = await adAccounts.create({
              name: data.name, account_id: data.account_id,
              status: (data.status as AdAccount['status']) || 'active',
              currency: data.currency || 'USD', notes: data.notes || null,
            } as any)
            if (error) toast.error(error)
            else toast.success('Cuenta creada')
          }}
          onUpdate={async (id, data) => {
            const { error } = await adAccounts.update(id, {
              name: data.name, account_id: data.account_id,
              status: data.status as AdAccount['status'],
              currency: data.currency, notes: data.notes || null,
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
          fields={[
            { key: 'name', label: 'Nombre', placeholder: 'Ej: BM Principal' },
            { key: 'bm_id', label: 'BM ID', placeholder: 'Ej: 123456789' },
          ]}
          onAdd={async (data) => {
            const { error } = await bms.create({
              name: data.name, bm_id: data.bm_id,
              status: (data.status as BusinessManager['status']) || 'active',
              notes: data.notes || null,
            } as any)
            if (error) toast.error(error)
            else toast.success('BM creado')
          }}
          onUpdate={async (id, data) => {
            const { error } = await bms.update(id, {
              name: data.name, bm_id: data.bm_id,
              status: data.status as BusinessManager['status'],
              notes: data.notes || null,
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
          fields={[
            { key: 'name', label: 'Nombre', placeholder: 'Ej: Juan Perez' },
            { key: 'profile_id', label: 'Profile ID', placeholder: 'Ej: 123456789' },
          ]}
          onAdd={async (data) => {
            const { error } = await profiles.create({
              name: data.name, profile_id: data.profile_id,
              status: (data.status as MetaProfile['status']) || 'active',
              notes: data.notes || null,
            } as any)
            if (error) toast.error(error)
            else toast.success('Perfil creado')
          }}
          onUpdate={async (id, data) => {
            const { error } = await profiles.update(id, {
              name: data.name, profile_id: data.profile_id,
              status: data.status as MetaProfile['status'],
              notes: data.notes || null,
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
  )
}
