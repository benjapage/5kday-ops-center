import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { COUNTRIES } from '@/lib/constants'
import { Pencil, Building2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database.types'
import type { useWaAccounts } from '@/hooks/useWaAccounts'

type WaAccount = Database['public']['Tables']['wa_accounts']['Row']

interface EditWaAccountDialogProps {
  account: WaAccount
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: ReturnType<typeof useWaAccounts>['update']
}

export function EditWaAccountDialog({ account, open, onOpenChange, onUpdate }: EditWaAccountDialogProps) {
  const [form, setForm] = useState({
    bm_id: account.bm_id ?? '',
    bm_link_url: account.bm_link_url ?? '',
    manychat_name: account.manychat_name ?? '',
    manychat_url: account.manychat_url ?? '',
    country: account.country,
    notes: account.notes ?? '',
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setForm({
      bm_id: account.bm_id ?? '',
      bm_link_url: account.bm_link_url ?? '',
      manychat_name: account.manychat_name ?? '',
      manychat_url: account.manychat_url ?? '',
      country: account.country,
      notes: account.notes ?? '',
    })
  }, [account])

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await onUpdate(account.id, {
      bm_id: form.bm_id || null,
      bm_link_url: form.bm_link_url || null,
      manychat_name: form.manychat_name || null,
      manychat_url: form.manychat_url || null,
      country: form.country,
      notes: form.notes || null,
    })
    setIsLoading(false)

    if (error) { toast.error(error); return }
    toast.success('Cuenta actualizada')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Pencil size={14} className="text-blue-600" />
            </div>
            Editar cuenta
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{account.phone_number}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Ubicacion</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Pais</Label>
              <Select value={form.country} onValueChange={v => set('country', v)}>
                <SelectTrigger className="max-w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title flex items-center gap-1.5">
              <Building2 size={12} /> Business Manager
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">BM ID</Label>
                <Input value={form.bm_id} onChange={e => set('bm_id', e.target.value)} placeholder="123456789" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">BM Link</Label>
                <Input value={form.bm_link_url} onChange={e => set('bm_link_url', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title flex items-center gap-1.5">
              <MessageCircle size={12} /> ManyChat
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Nombre de cuenta</Label>
                <Input value={form.manychat_name} onChange={e => set('manychat_name', e.target.value)} placeholder="Mi Bot" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">URL</Label>
                <Input value={form.manychat_url} onChange={e => set('manychat_url', e.target.value)} placeholder="https://manychat.com/..." />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Notas</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="resize-none" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="text-white"
              style={{ backgroundColor: '#10B981' }}
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
