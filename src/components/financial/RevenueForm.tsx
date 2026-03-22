import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Ingresá un monto válido'
    if (!form.channel) e.channel = 'Seleccioná un canal'
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
          <DialogTitle>Registrar ingreso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ARS">ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Canal *</Label>
            <Select value={form.channel} onValueChange={v => set('channel', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar canal..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            {errors.channel && <p className="text-xs text-red-500">{errors.channel}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={form.revenue_date}
              onChange={e => set('revenue_date', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              placeholder="Detalle del ingreso..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
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
