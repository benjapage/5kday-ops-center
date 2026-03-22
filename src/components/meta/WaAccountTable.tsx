import { useState } from 'react'
import { Plus, MoreHorizontal, Trash2, Edit2, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/shared/StatusIndicator'
import { WarmingProgress } from './WarmingProgress'
import { AddWaAccountDialog } from './AddWaAccountDialog'
import { EditWaAccountDialog } from './EditWaAccountDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useWaAccounts } from '@/hooks/useWaAccounts'
import { useAuth } from '@/contexts/AuthContext'
import { COUNTRIES } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'

type WaAccount = Database['public']['Tables']['wa_accounts']['Row']
type Status = 'all' | 'warming' | 'active' | 'banned'

export function WaAccountTable() {
  const { accounts, isLoading, create, update, setStatus, remove } = useWaAccounts()
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<WaAccount | null>(null)
  const [filter, setFilter] = useState<Status>('all')
  const [confirmDelete, setConfirmDelete] = useState<WaAccount | null>(null)

  const canWrite = profile?.role === 'admin' || profile?.role === 'tech'
  const isAdmin = profile?.role === 'admin'

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.status === filter)

  function countryFlag(code: string) {
    return COUNTRIES.find(c => c.code === code)?.flag ?? '🌍'
  }

  const STATUS_LABELS: Record<string, string> = {
    warming: 'calentando',
    active: 'activo',
    banned: 'baneado',
  }

  async function handleStatusChange(account: WaAccount, newStatus: 'warming' | 'active' | 'banned') {
    const { error } = await setStatus(account.id, newStatus)
    if (error) toast.error(error)
    else toast.success(`Estado actualizado a "${STATUS_LABELS[newStatus] ?? newStatus}"`)
  }

  async function handleDelete(account: WaAccount) {
    const { error } = await remove(account.id)
    if (error) toast.error(error)
    else toast.success('Cuenta eliminada')
    setConfirmDelete(null)
  }

  const filters: { label: string; value: Status }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Calentando', value: 'warming' },
    { label: 'Activas', value: 'active' },
    { label: 'Baneadas', value: 'banned' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1" role="group" aria-label="Filtrar por estado">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'text-white'
                  : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={filter === f.value ? { backgroundColor: '#0B1A2E' } : {}}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  ({accounts.filter(a => a.status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button
            size="sm"
            className="text-white gap-1.5"
            style={{ backgroundColor: '#10B981' }}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={15} />
            Agregar cuenta
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Número</TableHead>
              <TableHead className="text-xs">País</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs">Calentamiento</TableHead>
              <TableHead className="text-xs">BM ID</TableHead>
              <TableHead className="text-xs">ManyChat</TableHead>
              <TableHead className="text-xs">Inicio</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={Smartphone}
                    title="Sin cuentas WA"
                    description={filter === 'all' ? 'Agregá tu primera cuenta de WhatsApp' : `No hay cuentas en estado "${filter}"`}
                    action={canWrite && filter === 'all' ? (
                      <Button
                        size="sm"
                        className="text-white"
                        style={{ backgroundColor: '#10B981' }}
                        onClick={() => setAddOpen(true)}
                      >
                        <Plus size={14} className="mr-1" />
                        Agregar cuenta
                      </Button>
                    ) : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(account => (
                <TableRow key={account.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono text-sm font-medium">
                    {account.phone_number}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <span>{countryFlag(account.country)}</span>
                      <span className="text-slate-500">{account.country}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusIndicator status={account.status} />
                  </TableCell>
                  <TableCell>
                    <WarmingProgress startDate={account.start_date} status={account.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {account.bm_id
                      ? <span className="font-mono text-xs">{account.bm_id.slice(0, 12)}…</span>
                      : <span className="text-slate-300">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-sm">
                    {account.manychat_name
                      ? <Badge variant="outline" className="text-xs">{account.manychat_name}</Badge>
                      : <span className="text-slate-300">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {formatDate(account.start_date)}
                  </TableCell>
                  <TableCell>
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setEditAccount(account)}>
                            <Edit2 size={13} className="mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(account, 'active')}
                            disabled={account.status === 'active'}
                            className="text-green-700"
                          >
                            <RefreshCw size={13} className="mr-2" /> Marcar activo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(account, 'warming')}
                            disabled={account.status === 'warming'}
                            className="text-amber-700"
                          >
                            <RefreshCw size={13} className="mr-2" /> Marcar calentando
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(account, 'banned')}
                            disabled={account.status === 'banned'}
                            className="text-red-700"
                          >
                            <RefreshCw size={13} className="mr-2" /> Marcar baneado
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setConfirmDelete(account)}
                              >
                                <Trash2 size={13} className="mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <AddWaAccountDialog open={addOpen} onOpenChange={setAddOpen} onCreate={create} />
      {editAccount && (
        <EditWaAccountDialog
          account={editAccount}
          open={true}
          onOpenChange={open => { if (!open) setEditAccount(null) }}
          onUpdate={update}
        />
      )}

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar cuenta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Vas a eliminar <strong>{confirmDelete?.phone_number}</strong>. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
