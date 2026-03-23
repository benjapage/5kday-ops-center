import { useState } from 'react'
import { DollarSign, TrendingUp, BarChart3, Plus, Trash2, RefreshCw, Pause, Play, CreditCard } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/shared/MetricCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExpenseForm } from '@/components/financial/ExpenseForm'
import { RevenueForm } from '@/components/financial/RevenueForm'
import { useFinancials } from '@/hooks/useFinancials'
import { useSubscriptions, type Subscription } from '@/hooks/useSubscriptions'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { formatCurrency, formatDate, formatROAS } from '@/lib/formatters'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Area,
} from 'recharts'

function roasColor(roas: number | null) {
  if (roas == null) return 'text-slate-400'
  if (roas >= 3) return 'text-green-600'
  if (roas >= 1.5) return 'text-amber-600'
  return 'text-red-500'
}

function categoryLabel(cat: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function AddSubscriptionDialog({ open, onOpenChange, onCreate }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (data: { name: string; amount: number; currency: 'USD' | 'ARS'; category: string; billing_day: number; notes?: string }) => Promise<{ error: string | null }>
}) {
  const [form, setForm] = useState({ name: '', amount: '', currency: 'USD', category: 'tools_software', billing_day: '1', notes: '' })
  const [isLoading, setIsLoading] = useState(false)

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.amount || Number(form.amount) <= 0) { toast.error('Nombre y monto son requeridos'); return }
    setIsLoading(true)
    const { error } = await onCreate({
      name: form.name,
      amount: Number(form.amount),
      currency: form.currency as 'USD' | 'ARS',
      category: form.category,
      billing_day: Number(form.billing_day),
      notes: form.notes || undefined,
    })
    setIsLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Suscripcion creada')
    setForm({ name: '', amount: '', currency: 'USD', category: 'tools_software', billing_day: '1', notes: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <CreditCard size={16} className="text-purple-600" />
            </div>
            Nueva suscripcion
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Se computara automaticamente como gasto cada mes en el dia indicado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-section">
            <p className="form-section-title">Detalle</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Nombre *</Label>
              <Input placeholder="Ej: ManyChat Pro" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Monto mensual *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} className="text-lg font-semibold" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Moneda</Label>
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
                <Label className="text-xs font-medium text-slate-600">Categoria</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Dia de cobro</Label>
                <Input type="number" min="1" max="31" value={form.billing_day} onChange={e => set('billing_day', e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Crear suscripcion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Financial() {
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [revenueOpen, setRevenueOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const { dailyPnl, expenses, isLoading, addExpense, addRevenue, deleteExpense, mtd, blueRate, toUSD } = useFinancials()
  const { subscriptions, create: createSub, toggleActive, remove: removeSub, processSubscriptions } = useSubscriptions()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  async function handleDeleteExpense(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error } = await deleteExpense(id)
    if (error) toast.error(error)
    else toast.success('Gasto eliminado')
  }

  // Chart data: last 30 days cumulative
  const chartData = [...dailyPnl]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(-30)
    .map(d => ({
      date: d.date?.split('-').slice(1).join('/') ?? '',
      Ingresos: Number(d.total_revenue ?? 0),
      Profit: Number(d.profit ?? 0),
      'Gasto Ads': Number(d.ad_spend ?? 0),
    }))

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Módulo Financiero</h1>
        <p className="text-sm text-slate-500 mt-0.5">P&amp;L, gastos e ingresos del negocio</p>
      </div>

      {/* MTD Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Ingresos MTD" value={mtd.revenue} format="currency" icon={TrendingUp} iconColor="#10B981" />
        <MetricCard title="Gastos MTD" value={mtd.expenses} format="currency" icon={BarChart3} iconColor="#EF4444" />
        <MetricCard title="Ads MTD" value={mtd.adSpend} format="currency" icon={BarChart3} iconColor="#F59E0B" />
        <MetricCard
          title="Profit MTD"
          value={mtd.profit}
          format="currency"
          icon={DollarSign}
          iconColor={mtd.profit >= 0 ? '#10B981' : '#EF4444'}
        />
        <MetricCard title="ROAS MTD" value={mtd.roas} format="roas" icon={TrendingUp} iconColor="#0B1A2E" />
      </div>

      <Tabs defaultValue="daily">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="daily">P&L Diario</TabsTrigger>
            <TabsTrigger value="expenses">Gastos</TabsTrigger>
            <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
            <TabsTrigger value="chart">Grafico</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExpenseOpen(true)}
              className="gap-1.5"
            >
              <Plus size={14} /> Gasto
            </Button>
            <Button
              size="sm"
              className="text-white gap-1.5"
              style={{ backgroundColor: '#10B981' }}
              onClick={() => setRevenueOpen(true)}
            >
              <Plus size={14} /> Ingreso
            </Button>
          </div>
        </div>

        {/* Daily P&L */}
        <TabsContent value="daily">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs text-right">Ingresos</TableHead>
                    <TableHead className="text-xs text-right">Gasto Ads</TableHead>
                    <TableHead className="text-xs text-right">Otros gastos</TableHead>
                    <TableHead className="text-xs text-right">Total gastos</TableHead>
                    <TableHead className="text-xs text-right">Profit</TableHead>
                    <TableHead className="text-xs text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyPnl.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState icon={DollarSign} title="Sin datos" description="Registrá un ingreso o gasto para ver el P&L" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyPnl.slice(0, 30).map(row => {
                      const revenue = Number(row.total_revenue ?? 0)
                      const expenses = Number(row.total_expenses ?? 0)
                      const adSpend = Number(row.ad_spend ?? 0)
                      const otherExpenses = expenses - adSpend
                      const profit = Number(row.profit ?? 0)
                      const roas = adSpend > 0 ? revenue / adSpend : null
                      return (
                        <TableRow key={row.date} className="hover:bg-slate-50/50">
                          <TableCell className="text-sm font-medium">{formatDate(row.date ?? '')}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-700">
                            {formatCurrency(revenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-700">
                            {formatCurrency(adSpend)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-slate-600">
                            {formatCurrency(otherExpenses)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-red-600">
                            {formatCurrency(expenses)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm font-semibold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {formatCurrency(profit)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm font-semibold ${roasColor(roas)}`}>
                            {formatROAS(roas)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses list */}
        <TabsContent value="expenses">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Categoría</TableHead>
                    <TableHead className="text-xs">Descripción</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4}>
                        <EmptyState icon={DollarSign} title="Sin gastos registrados" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map(expense => (
                      <TableRow key={expense.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm">{formatDate(expense.expense_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{categoryLabel(expense.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{expense.description ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-red-600">
                          {formatCurrency(expense.amount, expense.currency)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-500"
                              onClick={() => handleDeleteExpense(expense.id)}
                              aria-label={`Eliminar gasto del ${formatDate(expense.expense_date)}`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart */}
        <TabsContent value="chart">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700">Mes actual — Ingresos, Gastos y Profit diario</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sin datos para graficar" />
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Ingresos" fill="#10B981" radius={[3, 3, 0, 0]} opacity={0.85} />
                    <Bar dataKey="Gasto Ads" fill="#F59E0B" radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line type="monotone" dataKey="Profit" stroke="#0B1A2E" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions */}
        <TabsContent value="subscriptions">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={processSubscriptions}>
                <RefreshCw size={13} /> Procesar mes actual
              </Button>
            </div>
            <Button size="sm" className="text-white gap-1.5" style={{ backgroundColor: '#10B981' }} onClick={() => setSubOpen(true)}>
              <Plus size={14} /> Suscripcion
            </Button>
          </div>

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    <TableHead className="text-xs text-center">Dia cobro</TableHead>
                    <TableHead className="text-xs text-center">Estado</TableHead>
                    {isAdmin && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5}>
                        <EmptyState icon={CreditCard} title="Sin suscripciones" description="Agrega tus herramientas y servicios recurrentes" />
                      </TableCell>
                    </TableRow>
                  ) : subscriptions.map(sub => (
                    <TableRow key={sub.id} className={`hover:bg-slate-50/50 ${!sub.is_active ? 'opacity-50' : ''}`}>
                      <TableCell className="text-sm font-medium">{sub.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{categoryLabel(sub.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(sub.amount, sub.currency as 'USD' | 'ARS')}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm text-slate-500">
                        {sub.billing_day}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${sub.is_active ? 'border-green-200 text-green-700 bg-green-50' : 'border-slate-200 text-slate-400'}`}>
                          {sub.is_active ? 'Activa' : 'Pausada'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-amber-600"
                              onClick={async () => {
                                const { error } = await toggleActive(sub.id, sub.is_active)
                                if (error) toast.error(error)
                                else toast.success(sub.is_active ? 'Suscripcion pausada' : 'Suscripcion activada')
                              }}
                              aria-label={sub.is_active ? 'Pausar' : 'Activar'}
                            >
                              {sub.is_active ? <Pause size={13} /> : <Play size={13} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-500"
                              onClick={async () => {
                                if (!confirm('Eliminar suscripcion?')) return
                                const { error } = await removeSub(sub.id)
                                if (error) toast.error(error)
                                else toast.success('Suscripcion eliminada')
                              }}
                              aria-label="Eliminar"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Blue rate indicator */}
      {blueRate && (
        <p className="text-[10px] text-slate-400 text-right">
          Dolar Blue: ${blueRate.toLocaleString('es-AR')} — los montos en ARS se convierten automaticamente
        </p>
      )}

      <ExpenseForm open={expenseOpen} onOpenChange={setExpenseOpen} onAdd={addExpense} />
      <RevenueForm open={revenueOpen} onOpenChange={setRevenueOpen} onAdd={addRevenue} />
      <AddSubscriptionDialog open={subOpen} onOpenChange={setSubOpen} onCreate={createSub} />
    </div>
  )
}
