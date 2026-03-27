import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WaAccountSummary {
  id: string
  phone_number: string
  status: 'cold' | 'warming' | 'ready' | 'banned'
  start_date: string
  bm_id: string | null
  manychat_name: string | null
  country?: string | null
}

export interface Alert {
  type: 'warning' | 'danger' | 'info'
  message: string
  entityId?: string
}

export interface DailyChartPoint {
  date: string
  label: string
  revenue: number
  profit: number
}

export interface DashboardMetrics {
  revenueToday: number
  shopifyRevenueToday: number
  expensesToday: number
  adSpendToday: number
  profitToday: number
  revenueMtd: number
  expensesMtd: number
  adSpendMtd: number
  profitMtd: number
  roasMtd: number | null
  expenseBreakdownMtd: {
    ad_spend: number
    tools_software: number
    platform_fees: number
    team_salaries: number
    creative_production: number
    other: number
  }
  roas30d: number | null
  waAccounts: {
    total: number
    active: number
    warming: number
    banned: number
    list: WaAccountSummary[]
  }
  alerts: Alert[]
  dolarBlue: number | null
  dailyChart: DailyChartPoint[]
}

async function fetchDolarBlue(): Promise<number> {
  try {
    const res = await fetch('/api/dolar-blue')
    if (res.ok) {
      const data = await res.json()
      return data.venta || 1300
    }
  } catch {}
  return 1300
}

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const readyCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

        // Fetch UTMify data (SOLE financial source) + non-ads expenses + WA accounts in parallel
        const [
          utmRes,
          expMtdRes, expTodayRes,
          waRes, bannedRes, readyRes,
          blueRate,
        ] = await Promise.all([
          fetch('/api/utmify?action=dashboard-data&days=30').then(r => r.ok ? r.json() : null).catch(() => null),
          supabase.from('expenses').select('amount, currency, category, expense_date').gte('expense_date', mtdFrom),
          supabase.from('expenses').select('amount, currency, category').eq('expense_date', today),
          supabase.from('wa_accounts').select('id, phone_number, status, start_date, bm_id, manychat_name, country').order('status').order('start_date', { ascending: false }),
          supabase.from('wa_accounts').select('id, phone_number').eq('status', 'banned'),
          supabase.from('wa_accounts').select('id, phone_number, start_date').eq('status', 'warming').lte('start_date', readyCutoff),
          fetchDolarBlue(),
        ])

        const sumUSD = (rows: { amount: unknown; currency?: unknown }[] | null) =>
          (rows ?? []).reduce((s, r) => {
            const amt = Number(r.amount)
            return s + (r.currency === 'ARS' ? amt / blueRate : amt)
          }, 0)

        // Non-ads expenses (subscriptions, team, tools) from expenses table
        const expMtdAll = expMtdRes.data ?? []
        const nonAdsExpensesMtd = sumUSD(expMtdAll.filter((e: any) => e.category !== 'ad_spend'))
        const expTodayAll = expTodayRes.data ?? []
        const nonAdsExpensesToday = sumUSD(expTodayAll.filter((e: any) => e.category !== 'ad_spend'))

        // Financial data from UTMify exclusively
        const utmify = utmRes && utmRes.totalRows > 0 ? utmRes : null

        const revenueToday = utmify?.today?.revenue ?? 0
        const adSpendToday = utmify?.today?.spend ?? 0
        const profitToday = (utmify?.today?.profit ?? 0) - nonAdsExpensesToday
        const expensesToday = adSpendToday + nonAdsExpensesToday

        const revenueMtd = utmify?.mtd?.revenue ?? 0
        const adSpendMtd = utmify?.mtd?.spend ?? 0
        const profitMtd = (utmify?.mtd?.profit ?? 0) - nonAdsExpensesMtd
        const expensesMtd = adSpendMtd + nonAdsExpensesMtd
        const roasMtd = utmify?.mtd?.roas ?? null
        const roas30d = roasMtd

        const dailyChart: DailyChartPoint[] = (utmify?.dailyChart ?? []).map((d: any) => ({
          date: d.date,
          label: d.label,
          revenue: d.revenue,
          profit: d.profit,
        }))

        const expBreakdown = {
          ad_spend: adSpendMtd,
          tools_software: sumUSD(expMtdAll.filter((e: any) => e.category === 'tools_software')),
          platform_fees: sumUSD(expMtdAll.filter((e: any) => e.category === 'platform_fees')),
          team_salaries: sumUSD(expMtdAll.filter((e: any) => e.category === 'team_salaries')),
          creative_production: sumUSD(expMtdAll.filter((e: any) => e.category === 'creative_production')),
          other: sumUSD(expMtdAll.filter((e: any) => e.category === 'other')),
        }

        // WA accounts
        const waList = (waRes.data ?? []) as WaAccountSummary[]
        const waAccounts = {
          total: waList.length,
          active: waList.filter(w => w.status === 'ready').length,
          warming: waList.filter(w => w.status === 'warming').length,
          banned: waList.filter(w => w.status === 'banned').length,
          list: waList,
        }

        // Alerts
        const alerts: Alert[] = []
        for (const acc of (bannedRes.data ?? [])) {
          alerts.push({ type: 'danger', message: `Numero ${acc.phone_number} fue baneado`, entityId: acc.id })
        }
        for (const acc of (readyRes.data ?? [])) {
          alerts.push({ type: 'warning', message: `${acc.phone_number} completo calentamiento — listo para activar`, entityId: acc.id })
        }
        if (waAccounts.active === 0 && waAccounts.total > 0) {
          alerts.push({ type: 'info', message: 'No hay cuentas WA activas en este momento' })
        }
        if (!utmify) {
          alerts.push({ type: 'info', message: 'Sin datos de UTMify — sincroniza desde Integraciones' })
        }

        setMetrics({
          revenueToday, shopifyRevenueToday: revenueToday, expensesToday, adSpendToday, profitToday,
          revenueMtd, expensesMtd, adSpendMtd, profitMtd, roasMtd,
          expenseBreakdownMtd: expBreakdown,
          roas30d,
          waAccounts,
          alerts,
          dolarBlue: blueRate,
          dailyChart,
        })
      } catch (err) {
        setError('Error al cargar metricas')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [])

  return { metrics, isLoading, error }
}
