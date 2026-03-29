import { useState } from 'react'
import { Users, Link, CheckSquare, Plus, Trash2, ExternalLink, ChevronDown, ListChecks, Link2, DollarSign, ChevronLeft, ChevronRight, Save, CheckCircle2, Settings, Video, Trophy } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTeam } from '@/hooks/useTeam'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { useEditorPayments, useEditorConfig } from '@/hooks/useEditorPayments'
import type { WinnerAd } from '@/hooks/useEditorPayments'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'

type Role = Database['public']['Tables']['profiles']['Row']['role']

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/50',
  tech: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/50',
  editor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600',
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  tech: 'Tech',
  editor: 'Editor',
}

function AddChecklistDialog({ open, onOpenChange, onAdd }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdd: ReturnType<typeof useTeam>['addChecklist']
}) {
  const [title, setTitle] = useState('')
  const [role, setRole] = useState('all')
  const [items, setItems] = useState([''])
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title) { toast.error('El título es requerido'); return }
    setIsLoading(true)
    const validItems = items.filter(i => i.trim())
    const { error } = await onAdd(title, role, validItems)
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Checklist creado')
    setTitle(''); setRole('all'); setItems([''])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <ListChecks size={16} className="text-blue-600" />
            </div>
            Nuevo checklist
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Configuracion</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Titulo *</Label>
              <Input placeholder="Ej: Tareas diarias de marketing" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Asignado a</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="tech">Tech</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title">Items del checklist</p>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Item ${i + 1}`}
                    value={item}
                    onChange={e => {
                      const next = [...items]; next[i] = e.target.value; setItems(next)
                    }}
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-slate-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ''])} className="gap-1">
                <Plus size={13} /> Agregar item
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Crear checklist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddDriveLinkDialog({ open, onOpenChange, onAdd }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdd: ReturnType<typeof useTeam>['addDriveLink']
}) {
  const [form, setForm] = useState({ title: '', url: '', category: '' })
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.url) { toast.error('Título y URL son requeridos'); return }
    setIsLoading(true)
    const { error } = await onAdd({ title: form.title, url: form.url, category: form.category || undefined })
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Link agregado')
    setForm({ title: '', url: '', category: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Link2 size={16} className="text-blue-600" />
            </div>
            Agregar recurso
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Detalle del recurso</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Titulo *</Label>
              <Input placeholder="Ej: SOPs de onboarding" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">URL *</Label>
              <Input placeholder="https://drive.google.com/..." value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Categoria</Label>
              <Input placeholder="Ej: SOPs, Creativos, Reportes..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Agregar recurso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function centsToUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function WinnerDetail({ winners }: { winners: WinnerAd[] }) {
  if (!winners.length) return null
  return (
    <div className="mt-1 space-y-0.5">
      {winners.map((w, i) => (
        <div key={i} className="flex items-start gap-1.5 text-[10px]">
          <Trophy size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-300">
            {w.ad_name} — gasto <span className="num font-semibold">{centsToUSD(w.spend_cents)}</span> → bono $5
          </span>
        </div>
      ))}
    </div>
  )
}

function EditorConfigDialog({ open, onOpenChange, editors: editorConfig }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editors: ReturnType<typeof useEditorConfig>
}) {
  const { editors, updateEditor, addEditor } = editorConfig
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    const result = await addEditor(newName.trim())
    if (result.error) toast.error(result.error)
    else { toast.success('Editor agregado'); setNewName('') }
  }

  async function handleUpdate(id: string, field: string, value: any) {
    setSaving(id)
    const result = await updateEditor(id, { [field]: value })
    setSaving(null)
    if (result.error) toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Settings size={16} className="text-slate-600 dark:text-slate-400" />
            </div>
            Configuracion de editores
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {editors.map(ed => (
            <div key={ed.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{ed.name}</span>
                <Badge
                  variant="outline"
                  className={`text-xs cursor-pointer ${ed.active ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-slate-400'}`}
                  onClick={() => handleUpdate(ed.id, 'active', !ed.active)}
                >
                  {ed.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">$/video (USD)</Label>
                  <Input
                    className="text-xs h-7"
                    type="number"
                    step="0.50"
                    value={(ed.rate_per_video_cents / 100).toFixed(2)}
                    onBlur={e => handleUpdate(ed.id, 'rate_per_video_cents', Math.round(Number(e.target.value) * 100))}
                    onChange={() => {}}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">$/ganador (USD)</Label>
                  <Input
                    className="text-xs h-7"
                    type="number"
                    step="0.50"
                    value={(ed.rate_per_winner_cents / 100).toFixed(2)}
                    onBlur={e => handleUpdate(ed.id, 'rate_per_winner_cents', Math.round(Number(e.target.value) * 100))}
                    onChange={() => {}}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">Umbral ganador (USD)</Label>
                  <Input
                    className="text-xs h-7"
                    type="number"
                    step="10"
                    value={(ed.winner_threshold_cents / 100).toFixed(0)}
                    onBlur={e => handleUpdate(ed.id, 'winner_threshold_cents', Math.round(Number(e.target.value) * 100))}
                    onChange={() => {}}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add new editor */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Input
              className="text-xs h-8 flex-1"
              placeholder="Nombre del nuevo editor..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            />
            <Button
              size="sm"
              className="h-8 text-xs text-white gap-1"
              style={{ backgroundColor: '#10B981' }}
              disabled={!newName.trim()}
              onClick={handleAdd}
            >
              <Plus size={12} /> Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditorPaymentsSection({ isAdmin }: { isAdmin: boolean }) {
  const {
    editors, week, saved, unmatchedWinners, isLoading,
    weekStart, prevWeek, nextWeek, thisWeek,
    savePayments, markPaid, refresh,
    totals, allPaid,
  } = useEditorPayments()

  const editorConfig = useEditorConfig()
  const [configOpen, setConfigOpen] = useState(false)
  const [savingPayments, setSavingPayments] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)

  const weekLabel = week
    ? `${new Date(week.start + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} al ${new Date(week.end + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
    : ''

  async function handleSave() {
    setSavingPayments(true)
    const result = await savePayments()
    setSavingPayments(false)
    if (result.error) toast.error(result.error)
    else toast.success('Pagos guardados')
  }

  async function handleMarkPaid() {
    setMarkingPaid(true)
    const result = await markPaid()
    setMarkingPaid(false)
    if (result.error) toast.error(result.error)
    else toast.success(`${result.marked} pagos marcados como pagados`)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="h-7 w-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={thisWeek} className="text-[10px] px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
              Esta semana
            </button>
            <button onClick={nextWeek} className="h-7 w-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Semana {weekLabel}
          </span>
          {allPaid && (
            <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 gap-1">
              <CheckCircle2 size={10} /> Pagado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setConfigOpen(true)}>
              <Settings size={12} /> Editores
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Calculando pagos...</div>
      ) : editors.length === 0 ? (
        <EmptyState icon={DollarSign} title="Sin editores" description="Configura los editores primero" />
      ) : (
        <>
          {/* Payment table */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead className="text-xs">Editor</TableHead>
                    <TableHead className="text-xs text-center">Videos subidos</TableHead>
                    <TableHead className="text-xs text-right">Pago fijo</TableHead>
                    <TableHead className="text-xs text-center">Ganadores</TableHead>
                    <TableHead className="text-xs text-right">Bono</TableHead>
                    <TableHead className="text-xs text-right font-bold">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editors.map(({ editor, payment }) => (
                    <TableRow key={editor.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                            style={{ backgroundColor: editor.name === 'Janne' ? '#8B5CF6' : '#3B82F6' }}
                          >
                            {editor.name[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{editor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Video size={12} className="text-purple-500" />
                          <span className="num text-sm font-semibold text-slate-700 dark:text-slate-200">{payment?.videos_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="num text-sm text-slate-600 dark:text-slate-300">
                          {centsToUSD(payment?.fixed_pay_cents || 0)}
                        </span>
                        <span className="text-[9px] text-slate-400 ml-1">
                          (${(editor.rate_per_video_cents / 100).toFixed(2)}/vid)
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`num text-sm font-semibold ${(payment?.winners_count || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {payment?.winners_count || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`num text-sm ${(payment?.variable_pay_cents || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {centsToUSD(payment?.variable_pay_cents || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="num text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {centsToUSD(payment?.total_pay_cents || 0)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  <TableRow className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-600">
                    <TableCell className="font-bold text-sm text-slate-700 dark:text-slate-200">TOTAL</TableCell>
                    <TableCell className="text-center num text-sm font-bold text-slate-700 dark:text-slate-200">{totals.totalVideos}</TableCell>
                    <TableCell className="text-right num text-sm font-bold text-slate-700 dark:text-slate-200">{centsToUSD(totals.totalFixed)}</TableCell>
                    <TableCell className="text-center num text-sm font-bold text-amber-600 dark:text-amber-400">{totals.totalWinners}</TableCell>
                    <TableCell className="text-right num text-sm font-bold text-amber-600 dark:text-amber-400">{centsToUSD(totals.totalVariable)}</TableCell>
                    <TableCell className="text-right num text-base font-black text-emerald-600 dark:text-emerald-400">{centsToUSD(totals.totalPay)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Winner details per editor */}
          {editors.some(e => (e.payment?.winners?.length || 0) > 0) && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Detalle de anuncios ganadores</p>
              {editors.filter(e => (e.payment?.winners?.length || 0) > 0).map(({ editor, payment }) => (
                <Card key={editor.id} className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy size={13} className="text-amber-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{editor.name}</span>
                      <span className="text-[10px] text-slate-400">— {payment?.winners_count} ganador{(payment?.winners_count || 0) !== 1 ? 'es' : ''}</span>
                    </div>
                    <WinnerDetail winners={payment?.winners || []} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Unmatched winners */}
          {unmatchedWinners.length > 0 && (
            <Card className="shadow-sm border-amber-200 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={13} className="text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Ganadores sin editor asignado</span>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400/70 mb-2">
                  Estos anuncios no pudieron asociarse a un editor. Verifica los nombres.
                </p>
                <WinnerDetail winners={unmatchedWinners} />
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {isAdmin && !allPaid && (
            <div className="flex items-center justify-end gap-2">
              {!saved && (
                <Button
                  size="sm"
                  className="text-white gap-1.5"
                  style={{ backgroundColor: '#6366F1' }}
                  disabled={savingPayments}
                  onClick={handleSave}
                >
                  <Save size={13} />
                  {savingPayments ? 'Guardando...' : 'Guardar calculo'}
                </Button>
              )}
              {saved && (
                <Button
                  size="sm"
                  className="text-white gap-1.5"
                  style={{ backgroundColor: '#10B981' }}
                  disabled={markingPaid}
                  onClick={handleMarkPaid}
                >
                  <CheckCircle2 size={13} />
                  {markingPaid ? 'Marcando...' : 'Marcar como pagado'}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <EditorConfigDialog open={configOpen} onOpenChange={setConfigOpen} editors={editorConfig} />
    </div>
  )
}

export default function Team() {
  const { members, checklists, driveLinks, isLoading, updateRole, toggleChecklistItem, addDriveLink, deleteDriveLink, addChecklist } = useTeam()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [addChecklistOpen, setAddChecklistOpen] = useState(false)
  const [addLinkOpen, setAddLinkOpen] = useState(false)
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpandedChecklists(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Equipo</h1>
        <p className="text-sm text-slate-500 mt-0.5">Miembros, checklists y recursos internos</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members"><Users size={14} className="mr-1.5" /> Miembros</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign size={14} className="mr-1.5" /> Pago editores</TabsTrigger>
          <TabsTrigger value="checklists"><CheckSquare size={14} className="mr-1.5" /> Checklists</TabsTrigger>
          <TabsTrigger value="drive"><Link size={14} className="mr-1.5" /> Recursos</TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members" className="mt-4">
          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[550px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Rol</TableHead>
                    <TableHead className="text-xs">Miembro desde</TableHead>
                    {isAdmin && <TableHead className="text-xs">Cambiar rol</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4}>
                        <EmptyState icon={Users} title="Sin miembros" />
                      </TableCell>
                    </TableRow>
                  ) : members.map(member => (
                    <TableRow key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                            style={{ backgroundColor: '#10B981' }}
                          >
                            {member.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-medium">{member.full_name}</span>
                          {member.id === profile?.id && (
                            <Badge variant="outline" className="text-xs">yo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{member.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${ROLE_COLORS[member.role]}`}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDate(member.created_at)}
                      </TableCell>
                      {isAdmin && member.id !== profile?.id && (
                        <TableCell>
                          <Select
                            value={member.role}
                            onValueChange={async (newRole) => {
                              const { error } = await updateRole(member.id, newRole as Role)
                              if (error) toast.error(error)
                              else toast.success(`Rol actualizado a ${newRole}`)
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => (
                                <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {isAdmin && member.id === profile?.id && (
                        <TableCell className="text-xs text-slate-400">—</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pago a editores */}
        <TabsContent value="payments" className="mt-4">
          <EditorPaymentsSection isAdmin={isAdmin} />
        </TabsContent>

        {/* Checklists */}
        <TabsContent value="checklists" className="mt-4">
          <div className="flex justify-end mb-4">
            {isAdmin && (
              <Button size="sm" className="text-white gap-1.5" style={{ backgroundColor: '#10B981' }} onClick={() => setAddChecklistOpen(true)}>
                <Plus size={14} /> Nuevo checklist
              </Button>
            )}
          </div>
          {checklists.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Sin checklists" description="Creá el primer checklist del equipo" />
          ) : (
            <div className="space-y-3">
              {checklists.map(cl => {
                const completed = cl.items.filter(i => i.completedToday).length
                const total = cl.items.length
                const pct = total > 0 ? (completed / total) * 100 : 0
                const isExpanded = expandedChecklists.has(cl.id)

                return (
                  <Card key={cl.id} className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
                    <CardHeader
                      className="pb-2 cursor-pointer"
                      onClick={() => toggleExpanded(cl.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold">{cl.title}</CardTitle>
                          {cl.assigned_role && cl.assigned_role !== 'all' && (
                            <Badge variant="outline" className={`text-xs ${ROLE_COLORS[cl.assigned_role as Role] ?? ''}`}>
                              {ROLE_LABELS[cl.assigned_role as Role] ?? cl.assigned_role}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{completed}/{total}</span>
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-2" />
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-2">
                        {cl.items.length === 0 ? (
                          <p className="text-xs text-slate-400">Sin ítems en este checklist</p>
                        ) : cl.items.map(item => (
                          <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={item.completedToday}
                              onChange={async () => {
                                await toggleChecklistItem(item.id, item.completedToday)
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                              aria-label={item.label}
                            />
                            <span className={`text-sm ${item.completedToday ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
          <AddChecklistDialog open={addChecklistOpen} onOpenChange={setAddChecklistOpen} onAdd={addChecklist} />
        </TabsContent>

        {/* Drive links */}
        <TabsContent value="drive" className="mt-4">
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <Button size="sm" className="text-white gap-1.5" style={{ backgroundColor: '#10B981' }} onClick={() => setAddLinkOpen(true)}>
                <Plus size={14} /> Agregar link
              </Button>
            </div>
          )}
          {driveLinks.length === 0 ? (
            <EmptyState icon={Link} title="Sin recursos" description="Agregá links a SOPs, docs y recursos del equipo" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {driveLinks.map(link => (
                <Card key={link.id} className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{link.title}</p>
                        {link.category && (
                          <Badge variant="outline" className="text-xs mt-1">{link.category}</Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-300 hover:text-red-500 flex-shrink-0"
                          aria-label={`Eliminar link ${link.title}`}
                          onClick={async () => {
                            const { error } = await deleteDriveLink(link.id)
                            if (error) toast.error(error)
                            else toast.success('Link eliminado')
                          }}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 truncate"
                    >
                      <ExternalLink size={11} />
                      <span className="truncate">{link.url}</span>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <AddDriveLinkDialog open={addLinkOpen} onOpenChange={setAddLinkOpen} onAdd={addDriveLink} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
