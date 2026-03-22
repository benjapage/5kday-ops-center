import { useState } from 'react'
import { DollarSign, TrendingUp, BarChart3, Plus, Trash2 } from 'lucide-react'
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
import { useAuth } from '@/contexts/AuthContext'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { formatCurrency, formatDate, formatROAS } from '@/lib/formatters'
import { toast } from 'sonner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

export default function Financial() {
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [revenueOpen, setRevenueOpen] = useState(false)
  const { dailyPnl, expenses, isLoading, addExpense, addRevenue, deleteExpense, mtd } = useFinancials()
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
            <TabsTrigger value="chart">Gráfico</TabsTrigger>
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
                            >
                              <Trash2 size={13} />
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
              <CardTitle className="text-sm font-semibold text-slate-700">Últimos 30 días</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sin datos para graficar" />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Legend />
                    <Line type="monotone" dataKey="Ingresos" stroke="#10B981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Profit" stroke="#0B1A2E" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Gasto Ads" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ExpenseForm open={expenseOpen} onOpenChange={setExpenseOpen} onAdd={addExpense} />
      <RevenueForm open={revenueOpen} onOpenChange={setRevenueOpen} onAdd={addRevenue} />
    </div>
  )
}
