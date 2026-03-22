import { useState } from 'react'
import { Plus, MoreHorizontal, Archive, ExternalLink, ImageIcon, Video, FileText, Package } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useAuth } from '@/contexts/AuthContext'
import { COUNTRIES, CHANNELS, ASSET_TYPES } from '@/lib/constants'
import { formatDate, formatROAS, formatCurrency } from '@/lib/formatters'
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
    name: '', country: '', channel: '', start_date: today,
    target_roas: '', target_cpl: '', current_roas: '', current_cpl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  function set(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Requerido'
    if (!form.country) errs.country = 'Requerido'
    if (!form.channel) errs.channel = 'Requerido'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setIsLoading(true)
    const { error } = await onCreate({
      name: form.name,
      country: form.country,
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
    setForm({ name: '', country: '', channel: '', start_date: today, target_roas: '', target_cpl: '', current_roas: '', current_cpl: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva oferta</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input placeholder="Ej: Curso Avanzado Argentina" value={form.name} onChange={e => set('name', e.target.value)} />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>País *</Label>
              <Select value={form.country} onValueChange={v => set('country', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.country && <p className="text-xs text-red-500">{errors.country}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Canal *</Label>
              <Select value={form.channel} onValueChange={v => set('channel', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.channel && <p className="text-xs text-red-500">{errors.channel}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de inicio</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ROAS objetivo</Label>
              <Input type="number" step="0.01" placeholder="3.00" value={form.target_roas} onChange={e => set('target_roas', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ROAS actual</Label>
              <Input type="number" step="0.01" placeholder="2.50" value={form.current_roas} onChange={e => set('current_roas', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>CPL objetivo (USD)</Label>
              <Input type="number" step="0.01" placeholder="5.00" value={form.target_cpl} onChange={e => set('target_cpl', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPL actual (USD)</Label>
              <Input type="number" step="0.01" placeholder="4.20" value={form.current_cpl} onChange={e => set('current_cpl', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
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
        <DialogHeader><DialogTitle>Agregar creativo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input placeholder="Ej: Video testimonial v3" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.asset_type} onValueChange={v => set('asset_type', v)}>
                <SelectTrigger><SelectValue placeholder="Tipo..." /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Oferta</Label>
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
            <Label>URL del asset</Label>
            <Input placeholder="https://drive.google.com/..." value={form.asset_url} onChange={e => set('asset_url', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Agregar'}
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

export default function Pipeline() {
  const { offers, isLoading: loadingOffers, create: createOffer, archive } = useOffers()
  const { creatives, isLoading: loadingCreatives, create: createCreative, retire } = useCreatives()
  const { profile } = useAuth()
  const [addOfferOpen, setAddOfferOpen] = useState(false)
  const [addCreativeOpen, setAddCreativeOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'archived' | 'all'>('active')

  const canWrite = profile?.role === 'admin' || profile?.role === 'tech'

  const filteredOffers = statusFilter === 'all' ? offers : offers.filter(o => o.status === statusFilter)

  if (loadingOffers) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ofertas activas, métricas y banco de creativos</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Activas', count: offers.filter(o => o.status === 'active').length, color: '#22C55E' },
          { label: 'Pausadas', count: offers.filter(o => o.status === 'paused').length, color: '#F59E0B' },
          { label: 'Archivadas', count: offers.filter(o => o.status === 'archived').length, color: '#94A3B8' },
        ].map(item => (
          <Card key={item.label} className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-slate-600">{item.label}</span>
              <span className="text-xl font-bold font-mono" style={{ color: item.color }}>{item.count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="offers">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="offers">Ofertas</TabsTrigger>
            <TabsTrigger value="creatives">Banco de creativos</TabsTrigger>
          </TabsList>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddCreativeOpen(true)} className="gap-1.5">
                <Plus size={14} /> Creativo
              </Button>
              <Button size="sm" className="text-white gap-1.5" style={{ backgroundColor: '#10B981' }} onClick={() => setAddOfferOpen(true)}>
                <Plus size={14} /> Oferta
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="offers">
          {/* Filter */}
          <div className="flex gap-1 mb-4">
            {(['active', 'paused', 'archived', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === f ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'}`}
                style={statusFilter === f ? { backgroundColor: '#0B1A2E' } : {}}
              >
                {f === 'active' ? 'Activas' : f === 'paused' ? 'Pausadas' : f === 'archived' ? 'Archivadas' : 'Todas'}
              </button>
            ))}
          </div>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Oferta</TableHead>
                    <TableHead className="text-xs">País / Canal</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs text-right">ROAS actual</TableHead>
                    <TableHead className="text-xs text-right">ROAS objetivo</TableHead>
                    <TableHead className="text-xs text-right">CPL actual</TableHead>
                    <TableHead className="text-xs">Inicio</TableHead>
                    {canWrite && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 8 : 7}>
                        <EmptyState icon={Plus} title="Sin ofertas" description="Creá tu primera oferta" />
                      </TableCell>
                    </TableRow>
                  ) : filteredOffers.map(offer => {
                    const roasOk = offer.current_roas != null && offer.target_roas != null
                      ? offer.current_roas >= offer.target_roas
                      : null
                    return (
                      <TableRow key={offer.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-sm">{offer.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{countryFlag(offer.country)} {offer.country}</span>
                            <Badge variant="outline" className="text-xs w-fit">{offer.channel}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${offer.status === 'active' ? 'border-green-300 text-green-700 bg-green-50' : offer.status === 'paused' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-slate-200 text-slate-500'}`}
                          >
                            {offer.status === 'active' ? 'Activa' : offer.status === 'paused' ? 'Pausada' : 'Archivada'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm font-semibold ${roasOk === true ? 'text-green-700' : roasOk === false ? 'text-red-500' : 'text-slate-400'}`}>
                          {formatROAS(offer.current_roas)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-slate-500">
                          {formatROAS(offer.target_roas)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-slate-600">
                          {offer.current_cpl != null ? formatCurrency(offer.current_cpl) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{formatDate(offer.start_date)}</TableCell>
                        {canWrite && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal size={15} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
        </TabsContent>

        <TabsContent value="creatives">
          {loadingCreatives ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {creatives.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState icon={ImageIcon} title="Sin creativos" description="Agregá tu primer asset al banco" />
                </div>
              ) : creatives.map(creative => {
                const linkedOffer = offers.find(o => o.id === creative.offer_id)
                return (
                  <Card key={creative.id} className={`shadow-sm border-slate-200 ${creative.status === 'retired' ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AssetIcon type={creative.asset_type} />
                          <span className="text-sm font-medium text-slate-800 truncate">{creative.name}</span>
                        </div>
                        {creative.status === 'retired' && (
                          <Badge variant="outline" className="text-xs text-slate-400 flex-shrink-0">Retirado</Badge>
                        )}
                      </div>
                      {linkedOffer && (
                        <p className="text-xs text-slate-500">{linkedOffer.name}</p>
                      )}
                      <div className="flex items-center justify-between">
                        {creative.asset_url ? (
                          <a
                            href={creative.asset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink size={11} /> Ver asset
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">Sin URL</span>
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
        </TabsContent>
      </Tabs>

      <AddOfferDialog open={addOfferOpen} onOpenChange={setAddOfferOpen} onCreate={createOffer} />
      <AddCreativeDialog open={addCreativeOpen} onOpenChange={setAddCreativeOpen} onCreate={createCreative} offers={offers} />
    </div>
  )
}
