import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { COUNTRIES } from '@/lib/constants'
import { Smartphone, Building2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { useWaAccounts } from '@/hooks/useWaAccounts'

interface AddWaAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: ReturnType<typeof useWaAccounts>['create']
}

export function AddWaAccountDialog({ open, onOpenChange, onCreate }: AddWaAccountDialogProps) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    phone_number: '',
    country: '',
    start_date: today,
    bm_id: '',
    bm_link_url: '',
    manychat_name: '',
    manychat_url: '',
    manychat_api_key: '',
    notes: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.phone_number.trim()) e.phone_number = 'Requerido'
    if (!form.country) e.country = 'Requerido'
    if (!form.start_date) e.start_date = 'Requerido'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setIsLoading(true)
    const { error } = await onCreate({
      phone_number: form.phone_number.trim(),
      country: form.country,
      start_date: form.start_date,
      status: 'warming',
      bm_id: form.bm_id || null,
      bm_link_url: form.bm_link_url || null,
      manychat_name: form.manychat_name || null,
      manychat_url: form.manychat_url || null,
      manychat_api_key: form.manychat_api_key || null,
      notes: form.notes || null,
    })

    setIsLoading(false)
    if (error) {
      toast.error(error.includes('unique') ? 'Ese numero ya existe' : error)
      return
    }

    toast.success('Cuenta WA agregada')
    setForm({ phone_number: '', country: '', start_date: today, bm_id: '', bm_link_url: '', manychat_name: '', manychat_url: '', manychat_api_key: '', notes: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <Smartphone size={16} className="text-emerald-600" />
            </div>
            Agregar cuenta WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            La cuenta entrara en calentamiento por 7 dias antes de estar lista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Datos principales */}
          <div className="form-section">
            <p className="form-section-title">Datos de la cuenta</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Numero de telefono *</Label>
                <Input
                  placeholder="+54 9 11 1234-5678"
                  value={form.phone_number}
                  onChange={e => set('phone_number', e.target.value)}
                  className={errors.phone_number ? 'border-red-300 focus-visible:ring-red-400' : ''}
                />
                {errors.phone_number && <p className="text-xs text-red-500" role="alert">{errors.phone_number}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Pais *</Label>
                <Select value={form.country} onValueChange={v => set('country', v)}>
                  <SelectTrigger className={errors.country ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-xs text-red-500" role="alert">{errors.country}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Inicio de calentamiento *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className="max-w-[200px]"
              />
              {errors.start_date && <p className="text-xs text-red-500" role="alert">{errors.start_date}</p>}
            </div>
          </div>

          {/* Section: Business Manager */}
          <div className="form-section">
            <p className="form-section-title flex items-center gap-1.5">
              <Building2 size={12} /> Business Manager
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">BM ID</Label>
                <Input
                  placeholder="123456789"
                  value={form.bm_id}
                  onChange={e => set('bm_id', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">BM Link</Label>
                <Input
                  placeholder="https://business.facebook.com/..."
                  value={form.bm_link_url}
                  onChange={e => set('bm_link_url', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: ManyChat */}
          <div className="form-section">
            <p className="form-section-title flex items-center gap-1.5">
              <MessageCircle size={12} /> ManyChat
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nombre de cuenta</Label>
                <Input
                  placeholder="Mi Bot Principal"
                  value={form.manychat_name}
                  onChange={e => set('manychat_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">URL</Label>
                <Input
                  placeholder="https://manychat.com/..."
                  value={form.manychat_url}
                  onChange={e => set('manychat_url', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">API Key</Label>
              <Input
                placeholder="Configuracion > API > Tu API Key"
                value={form.manychat_api_key}
                onChange={e => set('manychat_api_key', e.target.value)}
                type="password"
              />
              <p className="text-[10px] text-slate-400">Se usa para detectar baneos automaticamente cada hora.</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Notas</Label>
            <Textarea
              placeholder="Observaciones adicionales..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="resize-none"
            />
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
              {isLoading ? 'Guardando...' : 'Agregar cuenta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
