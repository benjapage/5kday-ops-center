import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WaAccountSummary {
  id: string
  phone_number: string
  status: 'cold' | 'warming' | 'ready' | 'banned'
  start_date: string
  bm_id: string | null
  manychat_name: string | null
}

export interface Alert {
  type: 'warning' | 'danger' | 'info'
  message: string
  entityId?: string
}

export interface DashboardMetrics {
  // Today
  revenueToday: number
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
}

async function fetchDolarBlue(): Promise<number> {
  try {
    const res = await fetch('/api/dolar-blue')
    if (res.ok) {
      const data = await res.json()
      return data.venta || 1300
    }
  } catch {}
  return 1300 // fallback
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

        const [
          revTodayRes, expTodayRes,
          revMtdRes, expMtdRes,
          rev30dRes, adSpend30dRes,
          waRes, bannedRes, readyRes,
          blueRate,
        ] = await Promise.all([
          supabase.from('revenue_entries').select('amount, currency').eq('revenue_date', today),
          supabase.from('expenses').select('amount, currency, category').eq('expense_date', today),
          supabase.from('revenue_entries').select('amount, currency').gte('revenue_date', mtdFrom),
          supabase.from('expenses').select('amount, currency, category').gte('expense_date', mtdFrom),
          supabase.from('revenue_entries').select('amount, currency').gte('revenue_date', since30d),
          supabase.from('expenses').select('amount, currency').eq('category', 'ad_spend').gte('expense_date', since30d),
          supabase.from('wa_accounts').select('id, phone_number, status, start_date, bm_id, manychat_name').order('status').order('start_date', { ascending: false }),
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

        const revenueToday = sumUSD(revTodayRes.data)
        const expTodayAll = expTodayRes.data ?? []
        const expensesToday = sumUSD(expTodayAll)
        const adSpendToday = sumUSD(expTodayAll.filter(e => e.category === 'ad_spend'))
        const profitToday = revenueToday - expensesToday

        const revenueMtd = sumUSD(revMtdRes.data)
        const expMtdAll = expMtdRes.data ?? []
        const expensesMtd = sumUSD(expMtdAll)
        const adSpendMtd = sumUSD(expMtdAll.filter(e => e.category === 'ad_spend'))
        const profitMtd = revenueMtd - expensesMtd
        const roasMtd = adSpendMtd > 0 ? revenueMtd / adSpendMtd : null

        const expBreakdown = {
          ad_spend: sumUSD(expMtdAll.filter(e => e.category === 'ad_spend')),
          tools_software: sumUSD(expMtdAll.filter(e => e.category === 'tools_software')),
          platform_fees: sumUSD(expMtdAll.filter(e => e.category === 'platform_fees')),
          team_salaries: sumUSD(expMtdAll.filter(e => e.category === 'team_salaries')),
          creative_production: sumUSD(expMtdAll.filter(e => e.category === 'creative_production')),
          other: sumUSD(expMtdAll.filter(e => e.category === 'other')),
        }

        const rev30d = sumUSD(rev30dRes.data)
        const adSpend30d = sumUSD(adSpend30dRes.data)
        const roas30d = adSpend30d > 0 ? rev30d / adSpend30d : null

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
          revenueToday, expensesToday, adSpendToday, profitToday,
          revenueMtd, expensesMtd, adSpendMtd, profitMtd, roasMtd,
          expenseBreakdownMtd: expBreakdown,
          roas30d,
          waAccounts,
          alerts,
          dolarBlue: blueRate,
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
