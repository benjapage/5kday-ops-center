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
  waRevenueToday: number
  waRevenueMtd: number
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

// Cutoff: before this date = meta_ad_stats, from this date = UTMify
const UTMIFY_CUTOFF = '2026-03-27'

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

        const [
          utmRes,
          // Historical revenue from Meta pixel (purchase_value) — BEFORE cutoff
          metaMtdRes, meta30dRes,
          // Expenses (all dates — subs, team, tools, ad_spend)
          expTodayRes, expMtdRes, adSpend30dRes,
          // WA
          waRes, bannedRes, readyRes,
          blueRate,
          // WA Sales (from Google Sheets via ManyChat)
          waSalesTodayRes, waSalesMtdRes,
        ] = await Promise.all([
          fetch('/api/utmify?action=dashboard-data&days=30').then(r => r.ok ? r.json() : null).catch(() => null),
          // Meta revenue for MTD before cutoff
          supabase.from('meta_ad_stats').select('purchase_value, currency').gte('stat_date', mtdFrom).lt('stat_date', UTMIFY_CUTOFF),
          // Meta revenue for 30d before cutoff
          supabase.from('meta_ad_stats').select('purchase_value, spend, currency, stat_date').gte('stat_date', since30d).lt('stat_date', UTMIFY_CUTOFF),
          supabase.from('expenses').select('amount, currency, category').eq('expense_date', today),
          supabase.from('expenses').select('amount, currency, category, expense_date').gte('expense_date', mtdFrom),
          supabase.from('expenses').select('amount, currency, expense_date').eq('category', 'ad_spend').gte('expense_date', since30d).lt('expense_date', UTMIFY_CUTOFF),
          supabase.from('wa_accounts').select('id, phone_number, status, start_date, bm_id, manychat_name, country').order('status').order('start_date', { ascending: false }),
          supabase.from('wa_accounts').select('id, phone_number').eq('status', 'banned'),
          supabase.from('wa_accounts').select('id, phone_number, start_date').eq('status', 'warming').lte('start_date', readyCutoff),
          fetchDolarBlue(),
          // WA Sales from Sheets
          supabase.from('wa_sales').select('amount_cents').eq('sale_date', today),
          supabase.from('wa_sales').select('amount_cents').gte('sale_date', mtdFrom),
        ])

        const sumUSD = (rows: { amount: unknown; currency?: unknown }[] | null) =>
          (rows ?? []).reduce((s, r) => {
            const amt = Number(r.amount)
            return s + (r.currency === 'ARS' ? amt / blueRate : amt)
          }, 0)

        const sumMetaRevenue = (rows: { purchase_value: unknown; currency?: unknown }[] | null) =>
          (rows ?? []).reduce((s, r) => {
            const amt = Number(r.purchase_value ?? 0)
            return s + (r.currency === 'ARS' ? amt / blueRate : amt)
          }, 0)

        const utmify = utmRes && utmRes.totalRows > 0 ? utmRes : null

        // ── Historical (before cutoff): revenue from meta_ad_stats ──
        const histRevMtd = sumMetaRevenue(metaMtdRes.data)
        const histRev30d = sumMetaRevenue(meta30dRes.data)

        // Expenses
        const expMtdAll = expMtdRes.data ?? []
        const histAdSpendMtd = sumUSD(expMtdAll.filter((e: any) => e.category === 'ad_spend' && e.expense_date < UTMIFY_CUTOFF))
        const histAdSpend30d = sumUSD(adSpend30dRes.data)
        const nonAdsExpensesMtd = sumUSD(expMtdAll.filter((e: any) => e.category !== 'ad_spend'))
        const expTodayAll = expTodayRes.data ?? []
        const nonAdsExpensesToday = sumUSD(expTodayAll.filter((e: any) => e.category !== 'ad_spend'))

        // ── UTMify (from cutoff onward) ──
        const utmRevMtd = utmify?.mtd?.revenue ?? 0
        const utmSpendMtd = utmify?.mtd?.spend ?? 0
        const utmProfitMtd = utmify?.mtd?.profit ?? 0
        const utmRevToday = utmify?.today?.revenue ?? 0
        const utmSpendToday = utmify?.today?.spend ?? 0

        // ── WA Sales (from Google Sheets) ──
        const waRevenueToday = (waSalesTodayRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_cents || 0), 0) / 100
        const waRevenueMtd = (waSalesMtdRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_cents || 0), 0) / 100

        // ── MERGED totals (UTMify/Shopify + WA Sales) ──
        const revenueMtd = histRevMtd + utmRevMtd + waRevenueMtd
        const adSpendMtd = histAdSpendMtd + utmSpendMtd
        const expensesMtd = adSpendMtd + nonAdsExpensesMtd
        const profitMtd = revenueMtd - expensesMtd
        const roasMtd = adSpendMtd > 0 ? revenueMtd / adSpendMtd : null

        const revenueToday = utmRevToday + waRevenueToday
        const adSpendToday = utmSpendToday
        const expensesToday = adSpendToday + nonAdsExpensesToday
        const profitToday = revenueToday - expensesToday

        const totalRev30d = histRev30d + utmRevMtd
        const totalAdSpend30d = histAdSpend30d + utmSpendMtd
        const roas30d = totalAdSpend30d > 0 ? totalRev30d / totalAdSpend30d : null

        // ── Chart: merge historical (meta_ad_stats) + UTMify ──
        const chartByDate: Record<string, { revenue: number; profit: number }> = {}

        // Historical from meta_ad_stats
        const metaRows = meta30dRes.data ?? []
        const histExpByDate: Record<string, number> = {}
        for (const e of expMtdAll) {
          const d = (e as any).expense_date
          if (d < UTMIFY_CUTOFF) {
            if (!histExpByDate[d]) histExpByDate[d] = 0
            const amt = Number((e as any).amount)
            histExpByDate[d] += (e as any).currency === 'ARS' ? amt / blueRate : amt
          }
        }
        for (const m of metaRows) {
          const d = (m as any).stat_date
          if (!chartByDate[d]) chartByDate[d] = { revenue: 0, profit: 0 }
          const rev = Number((m as any).purchase_value ?? 0)
          const usd = (m as any).currency === 'ARS' ? rev / blueRate : rev
          chartByDate[d].revenue += usd
        }
        for (const [d, v] of Object.entries(chartByDate)) {
          v.profit = v.revenue - (histExpByDate[d] || 0)
        }

        // UTMify chart data (from cutoff onward)
        if (utmify?.dailyChart) {
          for (const d of utmify.dailyChart) {
            if (d.date >= UTMIFY_CUTOFF) {
              chartByDate[d.date] = { revenue: d.revenue, profit: d.profit }
            }
          }
        }

        const dailyChart: DailyChartPoint[] = Object.entries(chartByDate)
          .map(([date, v]) => ({ date, label: date.split('-').slice(1).join('/'), revenue: v.revenue, profit: v.profit }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30)

        const expBreakdown = {
          ad_spend: adSpendMtd,
          tools_software: sumUSD(expMtdAll.filter((e: any) => e.category === 'tools_software')),
          platform_fees: sumUSD(expMtdAll.filter((e: any) => e.category === 'platform_fees')),
          team_salaries: sumUSD(expMtdAll.filter((e: any) => e.category === 'team_salaries')),
          creative_production: sumUSD(expMtdAll.filter((e: any) => e.category === 'creative_production')),
          other: sumUSD(expMtdAll.filter((e: any) => e.category === 'other')),
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
          revenueToday, shopifyRevenueToday: utmRevToday, waRevenueToday, waRevenueMtd, expensesToday, adSpendToday, profitToday,
          revenueMtd, expensesMtd, adSpendMtd, profitMtd, roasMtd,
          expenseBreakdownMtd: expBreakdown,
          roas30d, waAccounts, alerts, dolarBlue: blueRate, dailyChart,
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
