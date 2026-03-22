import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface DashboardMetrics {
  revenue30d: number
  expenses30d: number
  adSpend30d: number
  profit30d: number
  roas: number | null
  waAccounts: {
    total: number
    active: number
    warming: number
    banned: number
  }
  alerts: Alert[]
}

interface Alert {
  type: 'warning' | 'danger' | 'info'
  message: string
  entityId?: string
}

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        const since30d = new Date()
        since30d.setDate(since30d.getDate() - 30)
        const since30dStr = since30d.toISOString().split('T')[0]
        const today = new Date().toISOString().split('T')[0]

        const [revenueRes, expensesRes, adSpendRes, waRes, bannedRes, readyRes] = await Promise.all([
          supabase
            .from('revenue_entries')
            .select('amount')
            .gte('revenue_date', since30dStr),
          supabase
            .from('expenses')
            .select('amount')
            .gte('expense_date', since30dStr),
          supabase
            .from('expenses')
            .select('amount')
            .eq('category', 'ad_spend')
            .gte('expense_date', since30dStr),
          supabase
            .from('wa_accounts')
            .select('status'),
          supabase
            .from('wa_accounts')
            .select('id, phone_number')
            .eq('status', 'banned'),
          // Accounts that are warming but already past 7 days
          supabase
            .from('wa_accounts')
            .select('id, phone_number, start_date')
            .eq('status', 'warming')
            .lte('start_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]),
        ])

        const revenue30d = (revenueRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
        const expenses30d = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
        const adSpend30d = (adSpendRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
        const profit30d = revenue30d - expenses30d
        const roas = adSpend30d > 0 ? revenue30d / adSpend30d : null

        const waData = waRes.data ?? []
        const waAccounts = {
          total: waData.length,
          active: waData.filter(w => w.status === 'active').length,
          warming: waData.filter(w => w.status === 'warming').length,
          banned: waData.filter(w => w.status === 'banned').length,
        }

        const alerts: Alert[] = []

        for (const acc of (bannedRes.data ?? [])) {
          alerts.push({
            type: 'danger',
            message: `Número ${acc.phone_number} fue baneado`,
            entityId: acc.id,
          })
        }

        for (const acc of (readyRes.data ?? [])) {
          alerts.push({
            type: 'warning',
            message: `Número ${acc.phone_number} completó los 7 días de calentamiento y puede activarse`,
            entityId: acc.id,
          })
        }

        if (today) {
          // Suppresses unused warning
        }

        setMetrics({ revenue30d, expenses30d, adSpend30d, profit30d, roas, waAccounts, alerts })
      } catch (err) {
        setError('Error al cargar métricas')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [])

  return { metrics, isLoading, error }
}
