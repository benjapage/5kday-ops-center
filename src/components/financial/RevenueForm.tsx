import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import type { useFinancials } from '@/hooks/useFinancials'
import type { Database } from '@/types/database.types'

type Channel = Database['public']['Tables']['revenue_entries']['Row']['channel']

interface RevenueFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: ReturnType<typeof useFinancials>['addRevenue']
}

export function RevenueForm({ open, onOpenChange, onAdd }: RevenueFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amount: '',
    currency: 'USD' as 'USD' | 'ARS',
    channel: '' as Channel | '',
    revenue_date: today,
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
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Monto invalido'
    if (!form.channel) e.channel = 'Requerido'
    if (!form.revenue_date) e.revenue_date = 'Requerido'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setIsLoading(true)
    const { error } = await onAdd({
      amount: Number(form.amount),
      currency: form.currency,
      channel: form.channel as Channel,
      revenue_date: form.revenue_date,
      notes: form.notes || undefined,
    })
    setIsLoading(false)

    if (error) { toast.error(error); return }
    toast.success('Ingreso registrado')
    setForm({ amount: '', currency: 'USD', channel: '', revenue_date: today, notes: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <DollarSign size={16} className="text-emerald-600" />
            </div>
            Registrar ingreso
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Ingreso manual de revenue por canal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Detalle del ingreso</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  className={`text-lg font-semibold ${errors.amount ? 'border-red-300' : ''}`}
                />
                {errors.amount && <p className="text-xs text-red-500" role="alert">{errors.amount}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Moneda</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Canal *</Label>
                <Select value={form.channel} onValueChange={v => set('channel', v)}>
                  <SelectTrigger className={errors.channel ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.channel && <p className="text-xs text-red-500" role="alert">{errors.channel}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Fecha *</Label>
                <Input
                  type="date"
                  value={form.revenue_date}
                  onChange={e => set('revenue_date', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Notas</Label>
            <Textarea
              placeholder="Detalle del ingreso..."
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
              {isLoading ? 'Guardando...' : 'Registrar ingreso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
