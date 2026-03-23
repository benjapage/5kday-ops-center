import { TrendingUp, TrendingDown, DollarSign, BarChart3, Smartphone, AlertTriangle, Info, Target, ImageIcon, Video, FileText, Package } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useOffers } from '@/hooks/useOffers'
import { useCreatives } from '@/hooks/useCreatives'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatCurrency, formatROAS, getDaysSince } from '@/lib/formatters'
import { COUNTRIES } from '@/lib/constants'

function Mono({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span style={style} className={`font-mono ${className}`}>{children}</span>
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>
}

function countryFlag(code: string) {
  return COUNTRIES.find(c => c.code === code)?.flag ?? '🌍'
}

function WarmingBar({ startDate, status }: { startDate: string; status: string }) {
  if (status !== 'warming') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: status === 'ready' ? '#22C55E' : status === 'banned' ? '#EF4444' : '#94A3B8' }} />
        </div>
        <span className="text-[10px] text-slate-400">{status === 'ready' ? '7/7d' : '—'}</span>
      </div>
    )
  }
  const days = Math.min(getDaysSince(startDate), 7)
  const pct = (days / 7) * 100
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#F59E0B' }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color: '#F59E0B' }}>{days}/7d</span>
    </div>
  )
}

export default function Dashboard() {
  const { metrics, isLoading } = useDashboard()
  const { offers } = useOffers()
  const { creatives } = useCreatives()
  const { monthlyTarget } = useSettings()
  const { profile, user } = useAuth()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  if (isLoading || !metrics) return <LoadingSpinner />

  const activeOffers = offers.filter(o => o.status === 'active')
  const activeCreatives = creatives.filter(c => c.status === 'active')
  const targetPct = Math.min((metrics.revenueMtd / monthlyTarget) * 100, 100)

  // Group WA accounts by BM
  const bmGroups: Record<string, typeof metrics.waAccounts.list> = {}
  for (const acc of metrics.waAccounts.list) {
    const key = acc.bm_id ?? '__none__'
    if (!bmGroups[key]) bmGroups[key] = []
    bmGroups[key].push(acc)
  }

  const statusColor: Record<string, string> = {
    active: '#22C55E',
    warming: '#F59E0B',
    banned: '#EF4444',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {greeting()}, {profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'usuario'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider">Resumen operativo · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* ROW 1 — 4 metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Profit hoy',
            value: metrics.profitToday,
            format: 'currency',
            icon: metrics.profitToday >= 0 ? TrendingUp : TrendingDown,
            color: metrics.profitToday >= 0 ? '#22C55E' : '#EF4444',
          },
          {
            label: 'Facturación hoy',
            value: metrics.revenueToday,
            format: 'currency',
            icon: DollarSign,
            color: '#10B981',
          },
          {
            label: 'Inversión en ads',
            value: metrics.adSpendToday,
            format: 'currency',
            icon: BarChart3,
            color: '#F59E0B',
          },
          {
            label: 'ROAS general',
            value: metrics.roas30d,
            format: 'roas',
            icon: TrendingUp,
            color: metrics.roas30d == null ? '#94A3B8' : metrics.roas30d >= 3 ? '#22C55E' : metrics.roas30d >= 1.5 ? '#F59E0B' : '#EF4444',
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <Label>{card.label}</Label>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color + '18' }}>
                <card.icon size={15} style={{ color: card.color }} />
              </div>
            </div>
            <Mono className="text-2xl font-bold text-slate-800">
              {card.format === 'currency'
                ? formatCurrency(card.value as number)
                : formatROAS(card.value as number | null)}
            </Mono>
          </div>
        ))}
      </div>

      {/* ROW 2 — WhatsApp | Alertas | Meta objetivo */}
      <div className="grid grid-cols-12 gap-4">

        {/* WhatsApp — col-span-5 */}
        <div className="col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-slate-500" />
            <Label>WhatsApp</Label>
          </div>

          {/* 3 counter badges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Activas', count: metrics.waAccounts.active, bg: '#DCFCE7', color: '#16A34A' },
              { label: 'Calentando', count: metrics.waAccounts.warming, bg: '#FEF3C7', color: '#D97706' },
              { label: 'Baneadas', count: metrics.waAccounts.banned, bg: '#FEE2E2', color: '#DC2626' },
            ].map(item => (
              <div key={item.label} className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: item.bg }}>
                <Mono className="text-2xl font-bold" style={{ color: item.color }}>{item.count}</Mono>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: item.color }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* WA accounts table */}
          {metrics.waAccounts.list.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Sin cuentas WA registradas</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {metrics.waAccounts.list.map(acc => (
                <div key={acc.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor[acc.status] }} />
                  <Mono className="text-xs font-medium text-slate-700 flex-1 truncate">{acc.phone_number}</Mono>
                  {acc.bm_id ? (
                    <Mono className="text-[10px] text-slate-400 truncate max-w-[70px]">{acc.bm_id.slice(0, 8)}…</Mono>
                  ) : (
                    <span className="text-[10px] text-slate-300">Sin BM</span>
                  )}
                  <WarmingBar startDate={acc.start_date} status={acc.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tareas y alertas — col-span-4 */}
        <div className="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-slate-500" />
            <Label>Tareas y alertas hoy</Label>
          </div>
          {metrics.alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
              <Info size={20} />
              <p className="text-xs text-slate-400">Sin alertas por ahora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.alerts.map((alert, i) => {
                const borderColor = alert.type === 'danger' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'
                const bgColor = alert.type === 'danger' ? '#FEF2F2' : alert.type === 'warning' ? '#FFFBEB' : '#EFF6FF'
                const textColor = alert.type === 'danger' ? '#B91C1C' : alert.type === 'warning' ? '#92400E' : '#1D4ED8'
                return (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5 border-l-4 text-xs font-medium"
                    style={{ borderLeftColor: borderColor, backgroundColor: bgColor, color: textColor }}
                  >
                    {alert.message}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Meta objetivo — col-span-3 */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-slate-500" />
            <Label>Meta del mes</Label>
          </div>

          {/* Big number */}
          <div>
            <Mono className="text-3xl font-bold" style={{ color: '#22C55E' }}>
              {formatCurrency(monthlyTarget)}
            </Mono>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Objetivo mensual</p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Mono className="text-xs font-semibold text-slate-700">{formatCurrency(metrics.revenueMtd)}</Mono>
              <span className="text-[10px] font-bold" style={{ color: targetPct >= 80 ? '#22C55E' : targetPct >= 50 ? '#F59E0B' : '#EF4444' }}>
                {targetPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${targetPct}%`,
                  backgroundColor: targetPct >= 80 ? '#22C55E' : targetPct >= 50 ? '#F59E0B' : '#EF4444',
                }}
              />
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            {[
              { label: 'Inversión ads', value: metrics.expenseBreakdownMtd.ad_spend },
              { label: 'Apps / Tools', value: metrics.expenseBreakdownMtd.tools_software + metrics.expenseBreakdownMtd.platform_fees },
              { label: 'Equipo', value: metrics.expenseBreakdownMtd.team_salaries },
              { label: 'Margen neto', value: metrics.profitMtd, highlight: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</span>
                <Mono
                  className="text-xs font-semibold"
                  style={{ color: item.highlight ? (metrics.profitMtd >= 0 ? '#22C55E' : '#EF4444') : '#475569' }}
                >
                  {formatCurrency(item.value)}
                </Mono>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 3 — Creativos | Pipeline */}
      <div className="grid grid-cols-2 gap-4">

        {/* Creativos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon size={15} className="text-slate-500" />
              <Label>Creativos activos</Label>
            </div>
            <span className="text-xs font-semibold text-slate-400">{activeCreatives.length}</span>
          </div>
          {activeCreatives.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin creativos activos</p>
          ) : (
            <div className="space-y-1">
              {activeCreatives.slice(0, 6).map(c => {
                const TypeIcon = c.asset_type === 'video' ? Video : c.asset_type === 'copy' ? FileText : c.asset_type === 'image' ? ImageIcon : Package
                return (
                  <div key={c.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <TypeIcon size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-700 flex-1 truncate font-medium">{c.name}</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
                    >
                      Activo
                    </span>
                  </div>
                )
              })}
              {activeCreatives.length > 6 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">+{activeCreatives.length - 6} más</p>
              )}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-slate-500" />
              <Label>Pipeline activo</Label>
            </div>
            <span className="text-xs font-semibold text-slate-400">{activeOffers.length}</span>
          </div>
          {activeOffers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin ofertas activas</p>
          ) : (
            <div className="space-y-1">
              {activeOffers.slice(0, 6).map(offer => (
                <div key={offer.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                  <span className="text-sm">{countryFlag(offer.country)}</span>
                  <span className="text-xs text-slate-700 flex-1 truncate font-medium">{offer.name}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{offer.channel}</span>
                  {offer.current_roas != null && (
                    <Mono
                      className="text-xs font-bold"
                      style={{
                        color: offer.target_roas != null && offer.current_roas >= offer.target_roas
                          ? '#22C55E' : '#F59E0B',
                      }}
                    >
                      {formatROAS(offer.current_roas)}
                    </Mono>
                  )}
                </div>
              ))}
              {activeOffers.length > 6 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">+{activeOffers.length - 6} más</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 — Activos Meta full width */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone size={15} className="text-slate-500" />
          <Label>Activos Meta — Business Managers</Label>
        </div>

        {Object.keys(bmGroups).length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin cuentas WA registradas</p>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(bmGroups).map(([bmKey, accounts]) => {
              const isNoBm = bmKey === '__none__'
              const manyChatConnected = accounts.some(a => a.manychat_name)
              return (
                <div key={bmKey} className="border border-slate-200 rounded-xl p-3 space-y-3">
                  {/* BM header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">BM</p>
                      <Mono className="text-xs font-bold text-slate-700 truncate">
                        {isNoBm ? 'Sin BM asignado' : bmKey.slice(0, 14) + (bmKey.length > 14 ? '…' : '')}
                      </Mono>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${manyChatConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        MC
                      </span>
                    </div>
                  </div>

                  {/* Slot visualization */}
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map(acc => (
                      <div
                        key={acc.id}
                        className="relative group"
                        title={`${acc.phone_number} · ${acc.status}`}
                      >
                        <div
                          className="h-5 w-5 rounded"
                          style={{ backgroundColor: statusColor[acc.status] + '30', border: `2px solid ${statusColor[acc.status]}` }}
                        />
                        <div
                          className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: statusColor[acc.status] + '60' }}
                        />
                      </div>
                    ))}
                    {/* Empty slots up to 5 */}
                    {Array.from({ length: Math.max(0, 5 - accounts.length) }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="h-5 w-5 rounded border-2 border-dashed border-slate-200"
                      />
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: 'Listas', value: accounts.filter(a => a.status === 'ready').length, color: '#22C55E' },
                      { label: 'Calentando', value: accounts.filter(a => a.status === 'warming').length, color: '#F59E0B' },
                      { label: 'Baneadas', value: accounts.filter(a => a.status === 'banned').length, color: '#EF4444' },
                    ].map(s => (
                      <div key={s.label}>
                        <Mono className="text-base font-bold" style={{ color: s.color }}>{s.value}</Mono>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ManyChat names */}
                  {accounts.some(a => a.manychat_name) && (
                    <div className="pt-1 border-t border-slate-100">
                      {accounts.filter(a => a.manychat_name).map(a => (
                        <div key={a.id} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500 truncate">{a.manychat_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          {[
            { color: '#22C55E', label: 'Activa' },
            { color: '#F59E0B', label: 'Calentando' },
            { color: '#EF4444', label: 'Baneada' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: l.color + '30', border: `2px solid ${l.color}` }} />
              <span className="text-[10px] text-slate-500">{l.label}</span>
            </div>
          ))}
          <span className="text-[10px] text-slate-400 ml-2">· MC = ManyChat conectado</span>
        </div>
      </div>
    </div>
  )
}
