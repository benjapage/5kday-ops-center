import { useState, useEffect, useCallback } from 'react'
import { Plus, MoreHorizontal, Archive, ExternalLink, ImageIcon, Video, FileText, Package, Pencil, Target, Palette, Clock, MessageSquare, Save, Zap, DollarSign, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useOffers } from '@/hooks/useOffers'
import { useCreatives } from '@/hooks/useCreatives'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { COUNTRIES, CHANNELS, ASSET_TYPES } from '@/lib/constants'
import { formatDate, formatROAS, formatCurrency, getDaysSince } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'

type Offer = Database['public']['Tables']['offers']['Row']

function countryFlag(code: string) {
  return COUNTRIES.find(c => c.code === code)?.flag ?? '🌍'
}

function AddOfferDialog({ open, onOpenChange, onCreate }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: ReturnType<typeof useOffers>['create']
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    name: '', countries: [] as string[], channel: '', start_date: today,
    target_roas: '', target_cpl: '', current_roas: '', current_cpl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  function set(k: string, v: any) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  function toggleCountry(code: string) {
    setForm(p => ({
      ...p,
      countries: p.countries.includes(code)
        ? p.countries.filter(c => c !== code)
        : [...p.countries, code]
    }))
    if (errors.country) setErrors(p => ({ ...p, country: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Requerido'
    if (form.countries.length === 0) errs.country = 'Selecciona al menos un pais'
    if (!form.channel) errs.channel = 'Requerido'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setIsLoading(true)
    const { error } = await onCreate({
      name: form.name,
      country: form.countries.join(','),
      channel: form.channel as Offer['channel'],
      start_date: form.start_date,
      target_roas: form.target_roas ? Number(form.target_roas) : null,
      target_cpl: form.target_cpl ? Number(form.target_cpl) : null,
      current_roas: form.current_roas ? Number(form.current_roas) : null,
      current_cpl: form.current_cpl ? Number(form.current_cpl) : null,
    })
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Oferta creada')
    setForm({ name: '', countries: [], channel: '', start_date: today, target_roas: '', target_cpl: '', current_roas: '', current_cpl: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            Nueva oferta
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Informacion basica</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre *</Label>
              <Input placeholder="Ej: Curso Avanzado Argentina" value={form.name} onChange={e => set('name', e.target.value)} className={errors.name ? 'border-red-300' : ''} />
              {errors.name && <p className="text-xs text-red-500" role="alert">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Paises * <span className="text-slate-400 normal-case">(multi-select)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.code)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors border ${
                      form.countries.includes(c.code)
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600/50'
                    }`}
                  >
                    {c.flag} {c.code}
                  </button>
                ))}
              </div>
              {errors.country && <p className="text-xs text-red-500" role="alert">{errors.country}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Canal *</Label>
                <Select value={form.channel} onValueChange={v => set('channel', v)}>
                  <SelectTrigger className={errors.channel ? 'border-red-300' : ''}><SelectValue placeholder="Canal..." /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.channel && <p className="text-xs text-red-500" role="alert">{errors.channel}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Inicio</Label>
                <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title">Metricas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROAS objetivo</Label>
                <Input type="number" step="0.01" placeholder="3.00" value={form.target_roas} onChange={e => set('target_roas', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROAS actual</Label>
                <Input type="number" step="0.01" placeholder="2.50" value={form.current_roas} onChange={e => set('current_roas', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">CPL objetivo (USD)</Label>
                <Input type="number" step="0.01" placeholder="5.00" value={form.target_cpl} onChange={e => set('target_cpl', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">CPL actual (USD)</Label>
                <Input type="number" step="0.01" placeholder="4.20" value={form.current_cpl} onChange={e => set('current_cpl', e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Crear oferta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditOfferDialog({ open, onOpenChange, onUpdate, offer }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdate: ReturnType<typeof useOffers>['update']
  offer: Offer
}) {
  const [form, setForm] = useState({
    name: offer.name,
    country: offer.country,
    channel: offer.channel,
    status: offer.status,
    target_roas: offer.target_roas != null ? String(offer.target_roas) : '',
    target_cpl: offer.target_cpl != null ? String(offer.target_cpl) : '',
    current_roas: offer.current_roas != null ? String(offer.current_roas) : '',
    current_cpl: offer.current_cpl != null ? String(offer.current_cpl) : '',
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setForm({
      name: offer.name,
      country: offer.country,
      channel: offer.channel,
      status: offer.status,
      target_roas: offer.target_roas != null ? String(offer.target_roas) : '',
      target_cpl: offer.target_cpl != null ? String(offer.target_cpl) : '',
      current_roas: offer.current_roas != null ? String(offer.current_roas) : '',
      current_cpl: offer.current_cpl != null ? String(offer.current_cpl) : '',
    })
  }, [offer])

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await onUpdate(offer.id, {
      name: form.name,
      country: form.country,
      channel: form.channel as Offer['channel'],
      status: form.status as Offer['status'],
      target_roas: form.target_roas ? Number(form.target_roas) : null,
      target_cpl: form.target_cpl ? Number(form.target_cpl) : null,
      current_roas: form.current_roas ? Number(form.current_roas) : null,
      current_cpl: form.current_cpl ? Number(form.current_cpl) : null,
    })
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Oferta actualizada')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Pencil size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            Editar oferta
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Informacion basica</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Paises</Label>
                <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="AR,US,BR" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Canal</Label>
                <Select value={form.channel} onValueChange={v => set('channel', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Estado</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="archived">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title">Metricas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROAS objetivo</Label>
                <Input type="number" step="0.01" placeholder="3.00" value={form.target_roas} onChange={e => set('target_roas', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ROAS actual</Label>
                <Input type="number" step="0.01" placeholder="2.50" value={form.current_roas} onChange={e => set('current_roas', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">CPL objetivo (USD)</Label>
                <Input type="number" step="0.01" placeholder="5.00" value={form.target_cpl} onChange={e => set('target_cpl', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">CPL actual (USD)</Label>
                <Input type="number" step="0.01" placeholder="4.20" value={form.current_cpl} onChange={e => set('current_cpl', e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddCreativeDialog({ open, onOpenChange, onCreate, offers }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: ReturnType<typeof useCreatives>['create']
  offers: Offer[]
}) {
  const [form, setForm] = useState({ name: '', offer_id: '', asset_url: '', asset_type: '' })
  const [isLoading, setIsLoading] = useState(false)

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error('El nombre es requerido'); return }
    setIsLoading(true)
    const { error } = await onCreate({
      name: form.name,
      offer_id: form.offer_id || null,
      asset_url: form.asset_url || null,
      asset_type: (form.asset_type as 'image' | 'video' | 'copy' | 'other') || null,
      status: 'active',
    })
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Creativo agregado')
    setForm({ name: '', offer_id: '', asset_url: '', asset_type: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Palette size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            Agregar creativo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Detalle del asset</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre *</Label>
              <Input placeholder="Ej: Video testimonial v3" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={form.asset_type} onValueChange={v => set('asset_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Tipo..." /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Oferta vinculada</Label>
                <Select value={form.offer_id} onValueChange={v => set('offer_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Vincular..." /></SelectTrigger>
                  <SelectContent>
                    {offers.filter(o => o.status === 'active').map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL del asset</Label>
              <Input placeholder="https://drive.google.com/..." value={form.asset_url} onChange={e => set('asset_url', e.target.value)} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Agregar creativo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssetIcon({ type }: { type: string | null }) {
  if (type === 'image') return <ImageIcon size={14} className="text-blue-500" />
  if (type === 'video') return <Video size={14} className="text-purple-500" />
  if (type === 'copy') return <FileText size={14} className="text-amber-500" />
  return <Package size={14} className="text-slate-400" />
}

// Cambio 17: Log entry type
interface LogEntry {
  date: string
  text: string
}

function OfferNoteCard({ offer, creatives, onUpdate, canWrite }: {
  offer: Offer
  creatives: { id: string; offer_id: string | null; status: string; created_at: string; name: string; asset_type: string | null }[]
  onUpdate: ReturnType<typeof useOffers>['update']
  canWrite: boolean
}) {
  // Cambio 17: Split notes into log + free notes
  // Format: LOG entries separated by `---LOG---` from free notes
  const parseNotes = (raw: string) => {
    const parts = raw.split('---LOG---')
    const freeNotes = parts[0]?.trim() ?? ''
    const logRaw = parts[1]?.trim() ?? ''
    const logEntries: LogEntry[] = logRaw
      ? logRaw.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^\[(.+?)\] (.+)$/)
        if (match) return { date: match[1], text: match[2] }
        return { date: '', text: line }
      })
      : []
    return { freeNotes, logEntries }
  }

  const [notes, setNotes] = useState('')
  const [logInput, setLogInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const rawNotes = offer.notes ?? ''
  const { freeNotes: initialFreeNotes, logEntries } = parseNotes(rawNotes)

  useEffect(() => {
    setNotes(initialFreeNotes)
    setDirty(false)
  }, [offer.notes])

  const handleNotesChange = useCallback((val: string) => {
    setNotes(val)
    setDirty(val !== initialFreeNotes)
  }, [initialFreeNotes])

  async function saveNotes() {
    setSaving(true)
    const logPart = rawNotes.includes('---LOG---') ? '---LOG---' + rawNotes.split('---LOG---')[1] : ''
    const { error } = await onUpdate(offer.id, { notes: notes + (logPart ? '\n' + logPart : '') })
    setSaving(false)
    if (error) { toast.error(error); return }
    setDirty(false)
    toast.success('Notas guardadas')
  }

  async function addLogEntry() {
    if (!logInput.trim()) return
    setSaving(true)
    const now = new Date()
    const ts = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const newEntry = `[${ts}] ${logInput.trim()}`
    const currentLog = rawNotes.includes('---LOG---') ? rawNotes.split('---LOG---')[1]?.trim() ?? '' : ''
    const updatedLog = newEntry + (currentLog ? '\n' + currentLog : '')
    const freeNotesPart = notes || initialFreeNotes
    const { error } = await onUpdate(offer.id, { notes: freeNotesPart + '\n---LOG---\n' + updatedLog })
    setSaving(false)
    if (error) { toast.error(error); return }
    setLogInput('')
    toast.success('Entrada agregada al log')
  }

  const linkedCreatives = creatives.filter(c => c.offer_id === offer.id)
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const creativesThisWeek = linkedCreatives.filter(c => new Date(c.created_at) >= weekAgo)

  // Parse countries (multi-select support)
  const countryCodes = offer.country.includes(',') ? offer.country.split(',') : [offer.country]

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {countryCodes.map(c => <span key={c} className="text-base">{countryFlag(c.trim())}</span>)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{offer.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px]">{offer.channel}</Badge>
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${offer.status === 'active' ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/50' : offer.status === 'paused' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/50' : 'border-slate-200 text-slate-500 dark:border-slate-600'}`}
          >
            {offer.status === 'active' ? 'Activa' : offer.status === 'paused' ? 'Pausada' : 'Archivada'}
          </Badge>
        </div>

        {/* KPIs row — Cambio 16: removed Meta facturacion */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">ROAS</p>
            <span className={`text-base num ${
              offer.current_roas != null && offer.target_roas != null
                ? offer.current_roas >= offer.target_roas ? 'text-green-600 dark:text-green-400' : 'text-negative dark:text-negative-dark'
                : 'text-slate-400'
            }`}>
              {formatROAS(offer.current_roas)}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Objetivo</p>
            <span className="text-base num text-slate-700 dark:text-slate-200">
              {formatROAS(offer.target_roas)}
            </span>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Creativos semana</p>
            <span className={`text-base num ${creativesThisWeek.length > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
              {creativesThisWeek.length}/{linkedCreatives.length > 0 ? '10' : '0'}
            </span>
          </div>
        </div>

        {/* Creativos linked */}
        {linkedCreatives.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Creativos vinculados ({linkedCreatives.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {linkedCreatives.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                  <AssetIcon type={c.asset_type} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{c.name}</span>
                  {new Date(c.created_at) >= weekAgo && (
                    <span className="text-[9px] font-bold text-purple-500 uppercase">new</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cambio 17A: Log de campana */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={12} className="text-slate-400" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Log de campana</p>
          </div>
          {canWrite && (
            <div className="flex gap-2 mb-2">
              <Input
                className="text-xs h-8"
                placeholder="Ej: Cambie a Cost Cap $5 en CP3"
                value={logInput}
                onChange={e => setLogInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLogEntry() } }}
              />
              <Button
                size="sm"
                className="h-8 text-xs text-white px-3 flex-shrink-0"
                style={{ backgroundColor: '#6366F1' }}
                disabled={saving || !logInput.trim()}
                onClick={addLogEntry}
              >
                + Log
              </Button>
            </div>
          )}
          {logEntries.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Sin entradas aun</p>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {logEntries.slice(0, 10).map((entry, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="text-slate-400 flex-shrink-0 num">{entry.date}</span>
                  <span className="text-slate-600 dark:text-slate-300">—</span>
                  <span className="text-slate-700 dark:text-slate-200">{entry.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cambio 17B: Notas libres */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={12} className="text-slate-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notas libres</p>
            </div>
            {canWrite && dirty && (
              <Button
                size="sm"
                className="h-6 text-xs gap-1 text-white"
                style={{ backgroundColor: '#10B981' }}
                disabled={saving}
                onClick={saveNotes}
              >
                <Save size={10} />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </div>
          <textarea
            className="w-full text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 placeholder:text-slate-300 dark:placeholder:text-slate-500"
            rows={3}
            placeholder="Ideas, estrategias, proximos pasos..."
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            disabled={!canWrite}
          />
        </div>

        {/* Banco de creativos link — Cambio 18 Phase 1 */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            onClick={() => toast.info('Vincula una carpeta de Google Drive desde Integraciones')}
          >
            <FolderOpen size={13} />
            Abrir carpeta de creativos en Drive
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Pipeline() {
  const { offers, isLoading: loadingOffers, create: createOffer, update: updateOffer, archive } = useOffers()
  const { creatives, isLoading: loadingCreatives, create: createCreative, retire } = useCreatives()
  const { monthlyTarget } = useSettings()
  const { profile } = useAuth()
  const [addOfferOpen, setAddOfferOpen] = useState(false)
  const [addCreativeOpen, setAddCreativeOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'archived' | 'all'>('active')

  const canWrite = profile?.role === 'admin' || profile?.role === 'tech'

  const filteredOffers = statusFilter === 'all' ? offers : offers.filter(o => o.status === statusFilter)
  const activeOffers = offers.filter(o => o.status === 'active')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  if (loadingOffers) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pipeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ofertas activas, metricas y banco de creativos</p>
      </div>

      {/* OFERTAS TABLE — Cambio 16: removed irrelevant columns */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ofertas</h2>
          {canWrite && (
            <Button size="sm" className="text-white gap-1.5" style={{ backgroundColor: '#10B981' }} onClick={() => setAddOfferOpen(true)}>
              <Plus size={14} /> Nueva oferta
            </Button>
          )}
        </div>

          {/* Filter */}
          <div className="flex gap-1 mb-4" role="group" aria-label="Filtrar por estado">
            {(['active', 'paused', 'archived', 'all'] as const).map(f => {
              const label = f === 'active' ? 'Activas' : f === 'paused' ? 'Pausadas' : f === 'archived' ? 'Archivadas' : 'Todas'
              return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                aria-pressed={statusFilter === f}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === f ? 'text-white' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                style={statusFilter === f ? { backgroundColor: '#0B1A2E' } : {}}
              >
                {label}
              </button>
              )
            })}
          </div>

          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead className="text-xs">Oferta</TableHead>
                    <TableHead className="text-xs">Paises / Canal</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs text-right">ROAS</TableHead>
                    <TableHead className="text-xs text-center">Creativos semana</TableHead>
                    <TableHead className="text-xs text-center">Objetivo</TableHead>
                    {canWrite && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 7 : 6}>
                        <EmptyState icon={Plus} title="Sin ofertas" description="Crea tu primera oferta" />
                      </TableCell>
                    </TableRow>
                  ) : filteredOffers.map(offer => {
                    const roasOk = offer.current_roas != null && offer.target_roas != null
                      ? offer.current_roas >= offer.target_roas
                      : null
                    const creativesWeek = creatives.filter(c => c.offer_id === offer.id && new Date(c.created_at) >= weekAgo)
                    const totalCreatives = creatives.filter(c => c.offer_id === offer.id).length
                    const countryCodes = offer.country.includes(',') ? offer.country.split(',') : [offer.country]
                    return (
                      <TableRow key={offer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <TableCell className="font-medium text-sm dark:text-slate-200">{offer.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">
                              {countryCodes.map(c => countryFlag(c.trim())).join(' ')} {countryCodes.join(', ')}
                            </span>
                            <Badge variant="outline" className="text-xs w-fit">{offer.channel}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${offer.status === 'active' ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/50' : offer.status === 'paused' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/50' : 'border-slate-200 text-slate-500 dark:border-slate-600'}`}
                          >
                            {offer.status === 'active' ? 'Activa' : offer.status === 'paused' ? 'Pausada' : 'Archivada'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right num text-sm font-semibold ${roasOk === true ? 'text-green-700 dark:text-green-400' : roasOk === false ? 'text-negative dark:text-negative-dark' : 'text-slate-400'}`}>
                          {formatROAS(offer.current_roas)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs num font-bold ${creativesWeek.length > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-300 dark:text-slate-500'}`}>
                            {creativesWeek.length}/10
                          </span>
                        </TableCell>
                        <TableCell className="text-center num text-sm text-slate-500 dark:text-slate-400">
                          {formatROAS(offer.target_roas)}
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal size={15} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingOffer(offer)}>
                                  <Pencil size={13} className="mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-amber-700"
                                  onClick={async () => {
                                    const { error } = await archive(offer.id)
                                    if (error) toast.error(error)
                                    else toast.success('Oferta archivada')
                                  }}
                                >
                                  <Archive size={13} className="mr-2" /> Archivar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>

      {/* OFFER DETAIL CARDS — Cambio 17 */}
      {activeOffers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Detalle por oferta</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeOffers.map(offer => (
              <OfferNoteCard
                key={offer.id}
                offer={offer}
                creatives={creatives}
                onUpdate={updateOffer}
                canWrite={canWrite}
              />
            ))}
          </div>
        </div>
      )}

      {/* BANCO DE CREATIVOS — Cambio 18 Phase 1 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Banco de creativos</h2>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setAddCreativeOpen(true)} className="gap-1.5">
              <Plus size={14} /> Agregar creativo
            </Button>
          )}
        </div>
        {loadingCreatives ? (
          <LoadingSpinner />
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {creatives.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState icon={ImageIcon} title="Sin creativos" description="Agrega tu primer asset al banco" />
                </div>
              ) : creatives.map(creative => {
                const linkedOffer = offers.find(o => o.id === creative.offer_id)
                return (
                  <Card key={creative.id} className={`shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 ${creative.status === 'retired' ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AssetIcon type={creative.asset_type} />
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{creative.name}</span>
                        </div>
                        {creative.status === 'retired' && (
                          <Badge variant="outline" className="text-xs text-slate-400 flex-shrink-0">Retirado</Badge>
                        )}
                      </div>
                      {linkedOffer && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{linkedOffer.name}</p>
                      )}
                      <div className="flex items-center justify-between">
                        {creative.asset_url ? (
                          <a
                            href={creative.asset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
                          >
                            <ExternalLink size={11} /> Ver asset
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-500">Sin URL</span>
                        )}
                        {canWrite && creative.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-slate-400 hover:text-amber-600 px-2"
                            onClick={async () => {
                              const { error } = await retire(creative.id)
                              if (error) toast.error(error)
                              else toast.success('Creativo retirado')
                            }}
                          >
                            Retirar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
      </div>

      <AddOfferDialog open={addOfferOpen} onOpenChange={setAddOfferOpen} onCreate={createOffer} />
      <AddCreativeDialog open={addCreativeOpen} onOpenChange={setAddCreativeOpen} onCreate={createCreative} offers={offers} />
      {editingOffer && (
        <EditOfferDialog
          open={!!editingOffer}
          onOpenChange={v => { if (!v) setEditingOffer(null) }}
          onUpdate={updateOffer}
          offer={editingOffer}
        />
      )}
    </div>
  )
}
