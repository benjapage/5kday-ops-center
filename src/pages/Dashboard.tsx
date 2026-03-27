import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Smartphone, AlertTriangle, Info, Target, ImageIcon, Video, FileText, Package, Zap, CheckCircle2, Circle, CheckSquare, Plus, Square, CheckSquare2 } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useOffers } from '@/hooks/useOffers'
import { useCalendarTasks } from '@/hooks/useCalendar'
import { useCreatives } from '@/hooks/useCreatives'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatCurrency, formatROAS, getDaysSince } from '@/lib/formatters'
import { COUNTRIES } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function Num({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span style={style} className={`num ${className}`}>{children}</span>
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-slate-400" />}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>
    </div>
  )
}

function countryFlag(code: string) {
  return COUNTRIES.find(c => c.code === code)?.flag ?? '🌍'
}

const STATUS_COLOR: Record<string, string> = {
  cold: '#94A3B8',
  warming: '#F59E0B',
  ready: '#22C55E',
  active: '#22C55E',
  banned: '#EF4444',
}

function WarmingBar({ startDate, status }: { startDate: string; status: string }) {
  if (status !== 'warming') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-20 rounded-full bg-slate-200/60 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: STATUS_COLOR[status] ?? '#94A3B8' }} />
        </div>
        <span className="text-[10px] text-slate-400 num">{status === 'ready' ? '7/7d' : '—'}</span>
      </div>
    )
  }
  const days = Math.min(getDaysSince(startDate), 7)
  const pct = (days / 7) * 100
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-slate-200/60 dark:bg-slate-700 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#F59E0B' }} />
      </div>
      <span className="text-[10px] num" style={{ color: '#F59E0B' }}>{days}/7d</span>
    </div>
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

function DashboardTasks() {
  const { tasks, isLoading, calendarConnected, toggleComplete, createTask } = useCalendarTasks()
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newTask.trim()) return
    setAdding(true)
    await createTask(newTask.trim())
    setNewTask('')
    setAdding(false)
  }

  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel icon={CheckSquare}>Tareas del dia</SectionLabel>
        {!calendarConnected && (
          <span className="text-[9px] text-amber-500 uppercase tracking-wider">Sin Calendar</span>
        )}
      </div>

      {/* New task input */}
      <div className="flex gap-1.5 mb-3">
        <input
          className="flex-1 text-xs h-7 px-2 rounded-md border border-slate-200 dark:border-slate-600 bg-transparent dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          placeholder="+ Nueva tarea..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          disabled={adding}
        />
        {newTask.trim() && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="h-7 w-7 rounded-md bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-emerald-600 transition-colors"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <p className="text-xs text-slate-400 text-center py-4">Cargando...</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          {calendarConnected ? 'Sin tareas para hoy' : 'Conecta Google Calendar en Integraciones'}
        </p>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => {
                if (task.id.startsWith('gcal_')) return // Can't complete pure calendar events
                toggleComplete(task.id, !task.completed)
              }}
              className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${task.completed ? 'opacity-50' : ''}`}
            >
              {task.completed ? (
                <CheckSquare2 size={14} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <Square size={14} className="text-slate-300 dark:text-slate-500 flex-shrink-0" />
              )}
              <span className="text-[10px] text-slate-400 num w-10 flex-shrink-0">{task.time || ''}</span>
              <span className={`text-xs flex-1 truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {task.title}
              </span>
              {task.source !== 'manual' && task.source !== 'google_calendar' && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 uppercase tracking-wider flex-shrink-0">
                  auto
                </span>
              )}
            </button>
          ))}
        </div>
      )}
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
    if (h < 12) return 'Buenos dias'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  if (isLoading || !metrics) return <LoadingSpinner />

  const activeOffers = offers.filter(o => o.status === 'active')
  const activeCreatives = creatives.filter(c => c.status === 'active')
  const targetPct = monthlyTarget > 0 ? Math.min((metrics.revenueMtd / monthlyTarget) * 100, 100) : 0

  return (
    <div className="space-y-5">
      {/* ═══════════════════ HEADER — Corrección 21 ═══════════════════ */}
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {greeting()}, {profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'usuario'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider">
            Resumen operativo · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {metrics.dolarBlue && <span className="ml-3 normal-case">Blue: <span className="num">${metrics.dolarBlue.toLocaleString('es-AR')}</span></span>}
          </p>
        </div>

        {/* Meta del mes — inline, sin box */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Meta del mes</p>
            <div className="flex items-baseline gap-1.5 justify-end">
              <Num className="text-lg" style={{ color: '#22C55E' }}>{formatCurrency(metrics.revenueMtd)}</Num>
              <span className="text-xs text-slate-500/60">/ {formatCurrency(monthlyTarget)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="num text-xs" style={{ color: targetPct >= 80 ? '#22C55E' : targetPct >= 50 ? '#F59E0B' : '#E8816D' }}>
              {targetPct.toFixed(0)}%
            </span>
            <div className="h-1.5 w-32 rounded-full bg-slate-200/50 dark:bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${targetPct}%`,
                  backgroundColor: targetPct >= 80 ? '#22C55E' : targetPct >= 50 ? '#F59E0B' : '#E8816D',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ ROW 1 — Gráfico + WhatsApp ═══════════════════ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Gráfico de barras — Cambio 3+4 */}
        <div className="col-span-7 card-base p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionLabel icon={BarChart3}>Facturacion y Profit — 30 dias</SectionLabel>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#6366F1' }} /> Facturacion
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#22C55E' }} /> Profit
              </span>
            </div>
          </div>
          {/* Mini KPIs */}
          <div className="flex items-center gap-6 mb-3">
            {[
              { label: 'Profit mes', value: metrics.profitMtd, color: metrics.profitMtd >= 0 ? '#22C55E' : '#E8816D' },
              { label: 'Facturacion', value: metrics.revenueMtd, color: '#6366F1' },
              { label: 'ROAS 30d', value: null, roas: metrics.roas30d, color: metrics.roas30d != null && metrics.roas30d >= 3 ? '#22C55E' : metrics.roas30d != null && metrics.roas30d >= 1.5 ? '#F59E0B' : '#94A3B8' },
            ].map(kpi => (
              <div key={kpi.label}>
                <Num className="text-base" style={{ color: kpi.color }}>
                  {kpi.roas !== undefined ? formatROAS(kpi.roas) : formatCurrency(kpi.value!)}
                </Num>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">{kpi.label}</p>
              </div>
            ))}
          </div>
          {metrics.dailyChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              Sin datos de los ultimos 30 dias
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.dailyChart} barGap={1} barSize={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Facturacion" fill="#6366F1" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="profit" name="Profit" fill="#22C55E" radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* WhatsApp + Alertas — Cambio 6 */}
        <div className="col-span-5 flex flex-col gap-4">

          {/* WhatsApp */}
          <div className="card-base p-5 space-y-3 flex-1">
            <SectionLabel icon={Smartphone}>WhatsApp</SectionLabel>

            {/* 3 counter badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Listas', count: metrics.waAccounts.active, bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
                { label: 'Calentando', count: metrics.waAccounts.warming, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
                { label: 'Baneadas', count: metrics.waAccounts.banned, bg: 'rgba(232,129,109,0.12)', color: '#E8816D' },
              ].map(item => (
                <div key={item.label} className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: item.bg }}>
                  <Num className="text-xl" style={{ color: item.color }}>{item.count}</Num>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: item.color }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* WA accounts list */}
            {metrics.waAccounts.list.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sin cuentas WA registradas</p>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                {metrics.waAccounts.list.map(acc => (
                  <div key={acc.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[acc.status] }} />
                    <Num className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{acc.phone_number}</Num>
                    {acc.bm_id ? (
                      <span className="text-[10px] text-slate-400 truncate max-w-[70px] num">{acc.bm_id.slice(0, 8)}...</span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Sin BM</span>
                    )}
                    <WarmingBar startDate={acc.start_date} status={acc.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas hoy */}
          <div className="card-base p-5">
            <SectionLabel icon={AlertTriangle}>Alertas hoy</SectionLabel>
            <div className="mt-2">
              {metrics.alerts.length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-slate-400">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <p className="text-xs">Todo en orden</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {metrics.alerts.map((alert, i) => {
                    const borderColor = alert.type === 'danger' ? '#E8816D' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'
                    return (
                      <div
                        key={i}
                        className="rounded-lg px-3 py-2 border-l-3 text-xs font-medium bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300"
                        style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
                      >
                        {alert.message}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ ROW 2 — Pipeline | Tareas | Creativos ═══════════════════ */}
      <div className="grid grid-cols-3 gap-4">

        {/* Pipeline activo — Cambio 8 */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={TrendingUp}>Pipeline activo</SectionLabel>
            <span className="num text-xs text-slate-400">{activeOffers.length}</span>
          </div>
          {activeOffers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin ofertas activas</p>
          ) : (
            <div className="space-y-1">
              {activeOffers.slice(0, 6).map(offer => (
                <div key={offer.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <span className="text-sm">{countryFlag(offer.country)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate block">{offer.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider">{offer.channel}</span>
                    </div>
                  </div>
                  {offer.current_roas != null && (
                    <Num
                      className="text-xs"
                      style={{
                        color: offer.target_roas != null && offer.current_roas >= offer.target_roas
                          ? '#22C55E' : '#F59E0B',
                      }}
                    >
                      {formatROAS(offer.current_roas)}
                    </Num>
                  )}
                </div>
              ))}
              {activeOffers.length > 6 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">+{activeOffers.length - 6} mas</p>
              )}
            </div>
          )}
        </div>

        {/* Tareas del dia — Google Calendar */}
        <DashboardTasks />

        {/* Creativos — Cambio 10 */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={ImageIcon}>Creativos</SectionLabel>
            <span className="num text-xs text-slate-400">{activeCreatives.length}</span>
          </div>
          {activeCreatives.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin creativos activos</p>
          ) : (
            <div className="space-y-1">
              {activeCreatives.slice(0, 6).map(c => {
                const TypeIcon = c.asset_type === 'video' ? Video : c.asset_type === 'copy' ? FileText : c.asset_type === 'image' ? ImageIcon : Package
                const linkedOffer = offers.find(o => o.id === c.offer_id)
                return (
                  <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <TypeIcon size={13} className="text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate block">{c.name}</span>
                      {linkedOffer && <span className="text-[10px] text-slate-400 truncate block">{linkedOffer.name}</span>}
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
                      Activo
                    </span>
                  </div>
                )
              })}
              {activeCreatives.length > 6 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">+{activeCreatives.length - 6} mas</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ ROW 3 — Activos Meta full width ═══════════════════ */}
      {(() => {
        const bmGroups: Record<string, typeof metrics.waAccounts.list> = {}
        for (const acc of metrics.waAccounts.list) {
          const key = acc.bm_id ?? '__none__'
          if (!bmGroups[key]) bmGroups[key] = []
          bmGroups[key].push(acc)
        }

        return (
          <div className="card-base p-5">
            <SectionLabel icon={Smartphone}>Activos Meta — Business Managers</SectionLabel>

            {Object.keys(bmGroups).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 mt-3">Sin cuentas WA registradas</p>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                {Object.entries(bmGroups).map(([bmKey, accounts]) => {
                  const isNoBm = bmKey === '__none__'
                  const manyChatConnected = accounts.some(a => a.manychat_name)
                  return (
                    <div key={bmKey} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">BM</p>
                          <Num className="text-xs text-slate-700 dark:text-slate-200 truncate">
                            {isNoBm ? 'Sin BM asignado' : bmKey.slice(0, 14) + (bmKey.length > 14 ? '...' : '')}
                          </Num>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${manyChatConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                          MC
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {accounts.map(acc => (
                          <div key={acc.id} className="relative group" title={`${acc.phone_number} · ${acc.status}`}>
                            <div className="h-5 w-5 rounded" style={{ backgroundColor: (STATUS_COLOR[acc.status] ?? '#94A3B8') + '30', border: `2px solid ${STATUS_COLOR[acc.status] ?? '#94A3B8'}` }} />
                          </div>
                        ))}
                        {Array.from({ length: Math.max(0, 5 - accounts.length) }).map((_, i) => (
                          <div key={`empty-${i}`} className="h-5 w-5 rounded border-2 border-dashed border-slate-200 dark:border-slate-600" />
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-center">
                        {[
                          { label: 'Listas', value: accounts.filter(a => a.status === 'ready').length, color: '#22C55E' },
                          { label: 'Calentando', value: accounts.filter(a => a.status === 'warming').length, color: '#F59E0B' },
                          { label: 'Baneadas', value: accounts.filter(a => a.status === 'banned').length, color: '#E8816D' },
                        ].map(s => (
                          <div key={s.label}>
                            <Num className="text-base" style={{ color: s.color }}>{s.value}</Num>
                            <p className="text-[9px] uppercase tracking-wider text-slate-400">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {accounts.some(a => a.manychat_name) && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          {accounts.filter(a => a.manychat_name).map(a => (
                            <div key={a.id} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{a.manychat_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
              {[
                { color: '#22C55E', label: 'Lista' },
                { color: '#F59E0B', label: 'Calentando' },
                { color: '#E8816D', label: 'Baneada' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded" style={{ backgroundColor: l.color + '30', border: `2px solid ${l.color}` }} />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{l.label}</span>
                </div>
              ))}
              <span className="text-[10px] text-slate-400 ml-2">· MC = ManyChat conectado</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
