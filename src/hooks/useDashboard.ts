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
  // Today
  revenueToday: number
  shopifyRevenueToday: number
  expensesToday: number
  adSpendToday: number
  profitToday: number
  // MTD
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
  // 30d ROAS
  roas30d: number | null
  // WA
  waAccounts: {
    total: number
    active: number
    warming: number
    banned: number
    list: WaAccountSummary[]
  }
  alerts: Alert[]
  dolarBlue: number | null
  // Chart data (last 30 days)
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
        const since30d = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
        const readyCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

        // Try UTMify first for financial data
        let utmifyData: any = null
        try {
          const utmRes = await fetch('/api/utmify?action=dashboard-data?days=30')
          if (utmRes.ok) {
            const json = await utmRes.json()
            if (json.totalRows > 0) utmifyData = json
          }
        } catch {}

        const [
          // Revenue from revenue_entries (fallback if no UTMify)
          revTodayRes, revMtdRes, rev30dRes,
          // Expenses (subscriptions, team, etc — non-ads)
          expTodayRes, expMtdRes, adSpend30dRes,
          // WA
          waRes, bannedRes, readyRes,
          blueRate,
        ] = await Promise.all([
          supabase.from('revenue_entries').select('amount, currency, channel').eq('revenue_date', today),
          supabase.from('revenue_entries').select('amount, currency, channel, revenue_date').gte('revenue_date', mtdFrom),
          supabase.from('revenue_entries').select('amount, currency, channel, revenue_date').gte('revenue_date', since30d),
          supabase.from('expenses').select('amount, currency, category').eq('expense_date', today),
          supabase.from('expenses').select('amount, currency, category, expense_date').gte('expense_date', mtdFrom),
          supabase.from('expenses').select('amount, currency, expense_date').eq('category', 'ad_spend').gte('expense_date', since30d),
          supabase.from('wa_accounts').select('id, phone_number, status, start_date, bm_id, manychat_name, country').order('status').order('start_date', { ascending: false }),
          supabase.from('wa_accounts').select('id, phone_number').eq('status', 'banned'),
          supabase.from('wa_accounts').select('id, phone_number, start_date').eq('status', 'warming').lte('start_date', readyCutoff),
          fetchDolarBlue(),
        ])

        // Sum with currency conversion: ARS → USD via blue rate
        const sumUSD = (rows: { amount: unknown; currency?: unknown }[] | null) =>
          (rows ?? []).reduce((s, r) => {
            const amt = Number(r.amount)
            return s + (r.currency === 'ARS' ? amt / blueRate : amt)
          }, 0)

        // Use UTMify data if available, otherwise fall back to revenue_entries
        let revenueToday: number, shopifyRevenueToday: number, revenueMtd: number
        let adSpendToday: number, adSpendMtd: number, adSpend30d: number
        let profitToday: number, profitMtd: number, roas30d: number | null, roasMtd: number | null
        let expensesToday: number, expensesMtd: number
        let dailyChart: DailyChartPoint[] = []

        // Non-ads expenses (subscriptions, team, tools) always from expenses table
        const expMtdAll = expMtdRes.data ?? []
        const nonAdsExpensesMtd = sumUSD(expMtdAll.filter((e: any) => e.category !== 'ad_spend'))
        const expTodayAll = expTodayRes.data ?? []
        const nonAdsExpensesToday = sumUSD(expTodayAll.filter((e: any) => e.category !== 'ad_spend'))

        if (utmifyData) {
          // UTMify is primary source for revenue, ad spend, profit
          revenueToday = utmifyData.today.revenue
          shopifyRevenueToday = utmifyData.today.revenue
          revenueMtd = utmifyData.mtd.revenue
          adSpendToday = utmifyData.today.spend
          adSpendMtd = utmifyData.mtd.spend
          adSpend30d = utmifyData.mtd.spend // approximate
          profitToday = utmifyData.today.profit - nonAdsExpensesToday
          profitMtd = utmifyData.mtd.profit - nonAdsExpensesMtd
          expensesToday = adSpendToday + nonAdsExpensesToday
          expensesMtd = adSpendMtd + nonAdsExpensesMtd
          roasMtd = utmifyData.mtd.roas
          roas30d = utmifyData.mtd.roas // approximate from MTD
          dailyChart = utmifyData.dailyChart.map((d: any) => ({
            date: d.date,
            label: d.label,
            revenue: d.revenue,
            profit: d.profit,
          }))
        } else {
          // Fallback: revenue_entries + expenses
          const revTodayAll = revTodayRes.data ?? []
          revenueToday = sumUSD(revTodayAll)
          shopifyRevenueToday = sumUSD(revTodayAll.filter((r: any) => r.channel === 'shopify'))
          const revMtdAll = revMtdRes.data ?? []
          revenueMtd = sumUSD(revMtdAll)
          const rev30dAll = rev30dRes.data ?? []

          expensesToday = sumUSD(expTodayAll)
          adSpendToday = sumUSD(expTodayAll.filter((e: any) => e.category === 'ad_spend'))
          profitToday = revenueToday - expensesToday
          expensesMtd = sumUSD(expMtdAll)
          adSpendMtd = sumUSD(expMtdAll.filter((e: any) => e.category === 'ad_spend'))
          profitMtd = revenueMtd - expensesMtd
          roasMtd = adSpendMtd > 0 ? revenueMtd / adSpendMtd : null
          adSpend30d = sumUSD(adSpend30dRes.data)
          const rev30dTotal = sumUSD(rev30dAll)
          roas30d = adSpend30d > 0 ? rev30dTotal / adSpend30d : null
        }

        const expBreakdown = {
          ad_spend: utmifyData ? adSpendMtd : sumUSD(expMtdAll.filter((e: any) => e.category === 'ad_spend')),
          tools_software: sumUSD(expMtdAll.filter((e: any) => e.category === 'tools_software')),
          platform_fees: sumUSD(expMtdAll.filter((e: any) => e.category === 'platform_fees')),
          team_salaries: sumUSD(expMtdAll.filter((e: any) => e.category === 'team_salaries')),
          creative_production: sumUSD(expMtdAll.filter((e: any) => e.category === 'creative_production')),
          other: sumUSD(expMtdAll.filter((e: any) => e.category === 'other')),
        }

        // Build daily chart data (last 30 days) — only if UTMify didn't provide it
        if (dailyChart.length === 0) {
          const rev30dAll = rev30dRes.data ?? []
          const chartByDate: Record<string, { revenue: number; expenses: number }> = {}
          for (const r of rev30dAll) {
            const d = (r as any).revenue_date
            if (!chartByDate[d]) chartByDate[d] = { revenue: 0, expenses: 0 }
            const amt = Number((r as any).amount)
            chartByDate[d].revenue += (r as any).currency === 'ARS' ? amt / blueRate : amt
          }
          for (const e of expMtdAll) {
            const d = (e as any).expense_date
            if (!chartByDate[d]) chartByDate[d] = { revenue: 0, expenses: 0 }
            const amt = Number((e as any).amount)
            chartByDate[d].expenses += (e as any).currency === 'ARS' ? amt / blueRate : amt
          }
          dailyChart = Object.entries(chartByDate)
            .map(([date, v]) => ({
              date,
              label: date.split('-').slice(1).join('/'),
              revenue: v.revenue,
              profit: v.revenue - v.expenses,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30)
        }

        const waList = (waRes.data ?? []) as WaAccountSummary[]
        const waAccounts = {
          total: waList.length,
          active: waList.filter(w => w.status === 'ready').length,
          warming: waList.filter(w => w.status === 'warming').length,
          banned: waList.filter(w => w.status === 'banned').length,
          list: waList,
        }

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

        setMetrics({
          revenueToday, shopifyRevenueToday, expensesToday, adSpendToday, profitToday,
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
