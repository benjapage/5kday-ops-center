import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { toast } from 'sonner'
import type { useFinancials } from '@/hooks/useFinancials'
import type { Database } from '@/types/database.types'

type ExpenseCategory = Database['public']['Tables']['expenses']['Row']['category']

interface ExpenseFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: ReturnType<typeof useFinancials>['addExpense']
}

export function ExpenseForm({ open, onOpenChange, onAdd }: ExpenseFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amount: '',
    currency: 'USD' as 'USD' | 'ARS',
    category: '' as ExpenseCategory | '',
    description: '',
    expense_date: today,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Ingresá un monto válido'
    if (!form.category) e.category = 'La categoría es obligatoria'
    if (!form.expense_date) e.expense_date = 'Requerido'
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
      category: form.category as ExpenseCategory,
      description: form.description || undefined,
      expense_date: form.expense_date,
    })
    setIsLoading(false)

    if (error) { toast.error(error); return }
    toast.success('Gasto registrado')
    setForm({ amount: '', currency: 'USD', category: '', description: '', expense_date: today })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ARS">ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={form.expense_date}
              onChange={e => set('expense_date', e.target.value)}
            />
            {errors.expense_date && <p className="text-xs text-red-500">{errors.expense_date}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              placeholder="Detalle del gasto..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
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
              {isLoading ? 'Guardando...' : 'Registrar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
