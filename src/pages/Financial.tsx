import { useState } from 'react'
import { DollarSign, TrendingUp, BarChart3, Plus, Trash2, RefreshCw, Pause, Play, CreditCard, ShoppingCart, MessageCircle, Megaphone } from 'lucide-react'
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line,
} from 'recharts'

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
            <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <CreditCard size={16} className="text-purple-600 dark:text-purple-400" />
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
              <Label className="text-xs font-medium">Nombre *</Label>
              <Input placeholder="Ej: ManyChat Pro" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Monto mensual *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} className="text-lg font-semibold" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Moneda</Label>
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
                <Label className="text-xs font-medium">Categoria</Label>
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
                <Label className="text-xs font-medium">Dia de cobro</Label>
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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Financial() {
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const { dailyPnl, expenses, revenues, isLoading, addExpense, addRevenue, deleteExpense, mtd, blueRate, toUSD } = useFinancials()
  const { subscriptions, create: createSub, toggleActive, remove: removeSub, processSubscriptions } = useSubscriptions()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  async function handleDeleteExpense(id: string) {
    if (!confirm('Eliminar esta inversion?')) return
    const { error } = await deleteExpense(id)
    if (error) toast.error(error)
    else toast.success('Inversion eliminada')
  }

  // Chart data from revenue_entries + expenses
  const chartData = [...dailyPnl]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(d => ({ date: d.date.split('-').slice(1).join('/'), Ingresos: d.total_revenue, Profit: d.profit, 'Inversion Ads': d.ad_spend }))

  // Compute quadrant data (Cambio 13)
  const mtdSubs = subscriptions
    .filter(s => s.is_active)
    .reduce((s, sub) => s + (sub.currency === 'ARS' ? sub.amount / (blueRate || 1300) : sub.amount), 0)

  // Financial data from revenue_entries + expenses
  const mtdFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const mtdRevenues = revenues.filter(r => r.revenue_date >= mtdFrom)
  const waRevenue = mtdRevenues.filter(r => r.channel === 'whatsapp').reduce((s, r) => s + toUSD(Number(r.amount), r.currency), 0)
  const shopifyRevenue = mtdRevenues.filter(r => r.channel === 'shopify').reduce((s, r) => s + toUSD(Number(r.amount), r.currency), 0)

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Modulo Financiero</h1>
        <p className="text-sm text-slate-500 mt-0.5">P&amp;L, inversiones e ingresos del negocio</p>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Ingresos del mes" value={mtd.revenue} format="currency" icon={TrendingUp} iconColor="#10B981" />
        <MetricCard title="Inversiones del mes" value={mtd.expenses} format="currency" icon={BarChart3} iconColor="#E8816D" />
        <MetricCard title="Inversion Ads del mes" value={mtd.adSpend} format="currency" icon={BarChart3} iconColor="#F59E0B" />
        <MetricCard
          title="Profit del mes"
          value={mtd.profit}
          format="currency"
          icon={DollarSign}
          iconColor={mtd.profit >= 0 ? '#10B981' : '#E8816D'}
        />
        <MetricCard title="ROAS del mes" value={mtd.roas} format="roas" icon={TrendingUp} iconColor="#6366F1" />
      </div>

      {/* 4 Quadrants — Cambio 13 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Suscripciones */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard size={16} className="text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Suscripciones</p>
                <p className="text-[10px] text-slate-400">Apps y tools mensuales</p>
              </div>
            </div>
            <p className="num text-2xl text-purple-600 dark:text-purple-400 mb-2">{formatCurrency(mtdSubs)}<span className="text-xs text-slate-400 font-normal ml-1">/mes</span></p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {subscriptions.filter(s => s.is_active).slice(0, 5).map(sub => (
                <div key={sub.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{sub.name}</span>
                  <span className="num text-slate-500">{formatCurrency(sub.amount, sub.currency as 'USD' | 'ARS')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inversion Meta Ads */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Megaphone size={16} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Inversion en Ads</p>
                <p className="text-[10px] text-slate-400">Gasto en Meta Ads del mes</p>
              </div>
            </div>
            <p className="num text-2xl text-amber-600 dark:text-amber-400">{formatCurrency(mtd.adSpend)}</p>
            {mtd.roas != null && (
              <p className="text-xs text-slate-400 mt-1">ROAS: <span className="num font-semibold" style={{ color: mtd.roas >= 3 ? '#22C55E' : mtd.roas >= 1.5 ? '#F59E0B' : '#E8816D' }}>{formatROAS(mtd.roas)}</span></p>
            )}
          </CardContent>
        </Card>

        {/* Facturacion WhatsApp */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle size={16} className="text-green-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Facturacion WhatsApp</p>
                <p className="text-[10px] text-slate-400">Ingresos canal WA del mes</p>
              </div>
            </div>
            <p className="num text-2xl text-green-600 dark:text-green-400">{formatCurrency(waRevenue)}</p>
          </CardContent>
        </Card>

        {/* Facturacion Shopify */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <ShoppingCart size={16} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Facturacion Shopify</p>
                <p className="text-[10px] text-slate-400">Ingresos canal landing del mes</p>
              </div>
            </div>
            <p className="num text-2xl text-indigo-600 dark:text-indigo-400">{formatCurrency(shopifyRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chart">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="expenses">Inversiones</TabsTrigger>
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
              <Plus size={14} /> Inversion
            </Button>
          </div>
        </div>

        {/* Expenses list */}
        <TabsContent value="expenses">
          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs">Descripcion</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    {isAdmin && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4}>
                        <EmptyState icon={DollarSign} title="Sin inversiones registradas" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map(expense => (
                      <TableRow key={expense.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <TableCell className="text-sm">{formatDate(expense.expense_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{categoryLabel(expense.category)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-400">{expense.description ?? '—'}</TableCell>
                        <TableCell className="text-right num text-sm font-semibold text-negative dark:text-negative-dark">
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
          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mes actual — Ingresos, Gastos y Profit diario</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sin datos para graficar" />
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Ingresos" fill="#10B981" radius={[3, 3, 0, 0]} opacity={0.85} />
                    <Bar dataKey="Inversion Ads" fill="#F59E0B" radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line type="monotone" dataKey="Profit" stroke="#6366F1" strokeWidth={2.5} dot={false} />
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

          <Card className="shadow-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
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
                    <TableRow key={sub.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 ${!sub.is_active ? 'opacity-50' : ''}`}>
                      <TableCell className="text-sm font-medium dark:text-slate-200">{sub.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{categoryLabel(sub.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-right num text-sm font-semibold dark:text-slate-200">
                        {formatCurrency(sub.amount, sub.currency as 'USD' | 'ARS')}
                      </TableCell>
                      <TableCell className="text-center num text-sm text-slate-500 dark:text-slate-400">
                        {sub.billing_day}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${sub.is_active ? 'border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/50' : 'border-slate-200 text-slate-400 dark:border-slate-600'}`}>
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
<AddSubscriptionDialog open={subOpen} onOpenChange={setSubOpen} onCreate={createSub} />
    </div>
  )
}
