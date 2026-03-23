import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { Receipt } from 'lucide-react'
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
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Monto invalido'
    if (!form.category) e.category = 'Requerido'
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
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Receipt size={16} className="text-red-500" />
            </div>
            Registrar gasto
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Registra gastos del negocio para el calculo de P&L.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Detalle del gasto</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Monto *</Label>
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
                <Label className="text-xs font-medium text-slate-600">Moneda</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Categoria *</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className={errors.category ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-red-500" role="alert">{errors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Fecha *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={e => set('expense_date', e.target.value)}
                  className={errors.expense_date ? 'border-red-300' : ''}
                />
                {errors.expense_date && <p className="text-xs text-red-500" role="alert">{errors.expense_date}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Descripcion</Label>
            <Textarea
              placeholder="Detalle del gasto..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
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
              style={{ backgroundColor: '#EF4444' }}
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
