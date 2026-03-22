import { useState } from 'react'
import { Users, Link, CheckSquare, Plus, Trash2, ExternalLink, ChevronDown } from 'lucide-react'
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
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'

type Role = Database['public']['Tables']['profiles']['Row']['role']

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  tech: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  editor: 'bg-slate-100 text-slate-600 border-slate-200',
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
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo checklist</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input placeholder="Ej: Tareas diarias de marketing" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Asignado a</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ítems</Label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Ítem ${i + 1}`}
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
                    className="h-9 w-9 text-slate-400 hover:text-red-500"
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ''])}>
              <Plus size={13} className="mr-1" /> Agregar ítem
            </Button>
          </div>
          <DialogFooter>
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
        <DialogHeader><DialogTitle>Agregar link</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input placeholder="Ej: SOPs de onboarding" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>URL *</Label>
            <Input placeholder="https://drive.google.com/..." value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Input placeholder="Ej: SOPs, Creativos, Reportes..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Agregar link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        <h1 className="text-2xl font-bold text-slate-800">Equipo</h1>
        <p className="text-sm text-slate-500 mt-0.5">Miembros, checklists y recursos internos</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members"><Users size={14} className="mr-1.5" /> Miembros</TabsTrigger>
          <TabsTrigger value="checklists"><CheckSquare size={14} className="mr-1.5" /> Checklists</TabsTrigger>
          <TabsTrigger value="drive"><Link size={14} className="mr-1.5" /> Recursos</TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members" className="mt-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
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
                    <TableRow key={member.id} className="hover:bg-slate-50/50">
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
                  <Card key={cl.id} className="shadow-sm border-slate-200">
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
                              onChange={() => toggleChecklistItem(item.id, item.completedToday)}
                              className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
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
                <Card key={link.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{link.title}</p>
                        {link.category && (
                          <Badge variant="outline" className="text-xs mt-1">{link.category}</Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-300 hover:text-red-500 flex-shrink-0"
                          onClick={async () => {
                            const { error } = await deleteDriveLink(link.id)
                            if (error) toast.error(error)
                            else toast.success('Link eliminado')
                          }}
                        >
                          <Trash2 size={12} />
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
