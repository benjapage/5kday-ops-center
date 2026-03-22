import { DollarSign, TrendingUp, Smartphone, BarChart3, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { MetricCard } from '@/components/shared/MetricCard'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export default function Dashboard() {
  const { metrics, isLoading, error } = useDashboard()
  const { profile, user } = useAuth()

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  if (isLoading) return <LoadingSpinner />
  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {greeting()}, {profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'usuario'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen operativo — últimos 30 días</p>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
                alert.type === 'danger'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : alert.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {alert.type === 'info'
                ? <Info size={16} className="flex-shrink-0" />
                : <AlertTriangle size={16} className="flex-shrink-0" />
              }
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Profit neto"
          value={metrics.profit30d}
          format="currency"
          currency="USD"
          icon={DollarSign}
          iconColor={metrics.profit30d >= 0 ? '#10B981' : '#EF4444'}
          subtitle="Ingresos - Gastos totales"
        />
        <MetricCard
          title="Gasto en Ads"
          value={metrics.adSpend30d}
          format="currency"
          currency="USD"
          icon={BarChart3}
          iconColor="#F59E0B"
          subtitle="Inversión publicitaria"
        />
        <MetricCard
          title="ROAS"
          value={metrics.roas}
          format="roas"
          icon={TrendingUp}
          iconColor={
            metrics.roas == null ? '#94A3B8'
            : metrics.roas >= 3 ? '#10B981'
            : metrics.roas >= 1.5 ? '#F59E0B'
            : '#EF4444'
          }
          subtitle="Retorno sobre inversión en ads"
        />
        <MetricCard
          title="Cuentas WA activas"
          value={metrics.waAccounts.active}
          format="number"
          icon={Smartphone}
          iconColor="#10B981"
          subtitle={`${metrics.waAccounts.warming} calentando · ${metrics.waAccounts.banned} baneadas`}
        />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WA Summary */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Smartphone size={16} style={{ color: '#10B981' }} />
              Estado de cuentas WA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Activas', count: metrics.waAccounts.active, color: '#22C55E' },
              { label: 'Calentando', count: metrics.waAccounts.warming, color: '#F59E0B' },
              { label: 'Baneadas', count: metrics.waAccounts.banned, color: '#EF4444' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: item.color }}
                >
                  {item.count}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span
                  className="text-sm font-bold text-slate-800"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {metrics.waAccounts.total}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue breakdown */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <DollarSign size={16} style={{ color: '#10B981' }} />
              Resumen financiero (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Ingresos', value: metrics.revenue30d, color: '#22C55E' },
              { label: 'Gastos totales', value: metrics.expenses30d, color: '#EF4444' },
              { label: 'Gasto en ads', value: metrics.adSpend30d, color: '#F59E0B' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: item.color }}
                >
                  ${item.value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Profit</span>
                <span
                  className={`text-sm font-bold ${metrics.profit30d >= 0 ? 'text-green-600' : 'text-red-500'}`}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  ${metrics.profit30d.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle size={16} style={{ color: '#10B981' }} />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed limit={8} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
