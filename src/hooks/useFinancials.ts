import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type Expense = Database['public']['Tables']['expenses']['Row']
type RevenueEntry = Database['public']['Tables']['revenue_entries']['Row']

export interface DailyPnlRow {
  date: string
  total_revenue: number
  total_expenses: number
  ad_spend: number
  profit: number
}

interface ExpenseInsert {
  amount: number
  currency: 'USD' | 'ARS'
  category: Expense['category']
  description?: string
  expense_date: string
  offer_id?: string | null
}

interface RevenueInsert {
  amount: number
  currency: 'USD' | 'ARS'
  channel: RevenueEntry['channel']
  revenue_date: string
  offer_id?: string | null
  notes?: string
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

export function useFinancials(dateFrom?: string, dateTo?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [revenues, setRevenues] = useState<RevenueEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [blueRate, setBlueRate] = useState<number>(1300)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  const fetchAll = useCallback(async () => {
    setIsLoading(true)

    let expQuery = supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (dateFrom) expQuery = expQuery.gte('expense_date', dateFrom)
    if (dateTo) expQuery = expQuery.lte('expense_date', dateTo)

    let revQuery = supabase.from('revenue_entries').select('*').order('revenue_date', { ascending: false })
    if (dateFrom) revQuery = revQuery.gte('revenue_date', dateFrom)
    if (dateTo) revQuery = revQuery.lte('revenue_date', dateTo)

    const [expRes, revRes, rate] = await Promise.all([expQuery, revQuery, fetchDolarBlue()])

    setBlueRate(rate)
    if (!expRes.error) setExpenses(expRes.data ?? [])
    if (!revRes.error) setRevenues(revRes.data ?? [])
    setIsLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Convert amount to USD
  function toUSD(amount: number, currency: string): number {
    return currency === 'ARS' ? amount / blueRate : amount
  }

  // Compute daily P&L from raw data with currency conversion
  const dailyPnl: DailyPnlRow[] = useMemo(() => {
    const byDate: Record<string, { revenue: number; expenses: number; adSpend: number }> = {}

    for (const r of revenues) {
      const d = r.revenue_date
      if (!byDate[d]) byDate[d] = { revenue: 0, expenses: 0, adSpend: 0 }
      byDate[d].revenue += toUSD(Number(r.amount), r.currency)
    }

    for (const e of expenses) {
      const d = e.expense_date
      if (!byDate[d]) byDate[d] = { revenue: 0, expenses: 0, adSpend: 0 }
      const amt = toUSD(Number(e.amount), e.currency)
      byDate[d].expenses += amt
      if (e.category === 'ad_spend') byDate[d].adSpend += amt
    }

    return Object.entries(byDate)
      .map(([date, v]) => ({
        date,
        total_revenue: v.revenue,
        total_expenses: v.expenses,
        ad_spend: v.adSpend,
        profit: v.revenue - v.expenses,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [revenues, expenses, blueRate])

  async function addExpense(data: ExpenseInsert): Promise<{ error: string | null }> {
    if (!data.category) return { error: 'La categoria es obligatoria' }

    const { data: inserted, error } = await supabase
      .from('expenses')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()

    if (error) return { error: error.message }

    await logAction('expense.created', 'expense', inserted.id, {
      amount: data.amount,
      currency: data.currency,
      category: data.category,
    })
    await fetchAll()
    return { error: null }
  }

  async function addRevenue(data: RevenueInsert): Promise<{ error: string | null }> {
    const { data: inserted, error } = await supabase
      .from('revenue_entries')
      .insert({ ...data, created_by: profile?.id ?? null })
      .select()
      .single()

    if (error) return { error: error.message }

    await logAction('revenue.created', 'revenue_entry', inserted.id, {
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
    })
    await fetchAll()
    return { error: null }
  }

  async function deleteExpense(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }

  // MTD summary with currency conversion
  const today = new Date()
  const mtdFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const mtdRevenues = revenues.filter(r => r.revenue_date >= mtdFrom)
  const mtdExpensesList = expenses.filter(e => e.expense_date >= mtdFrom)

  const mtdRevenue = mtdRevenues.reduce((s, r) => s + toUSD(Number(r.amount), r.currency), 0)
  const mtdExpenses = mtdExpensesList.reduce((s, e) => s + toUSD(Number(e.amount), e.currency), 0)
  const mtdAdSpend = mtdExpensesList.filter(e => e.category === 'ad_spend').reduce((s, e) => s + toUSD(Number(e.amount), e.currency), 0)
  const mtdProfit = mtdRevenue - mtdExpenses
  const mtdRoas = mtdAdSpend > 0 ? mtdRevenue / mtdAdSpend : null

  return {
    dailyPnl,
    expenses,
    revenues,
    isLoading,
    addExpense,
    addRevenue,
    deleteExpense,
    refresh: fetchAll,
    blueRate,
    toUSD,
    mtd: { revenue: mtdRevenue, expenses: mtdExpenses, adSpend: mtdAdSpend, profit: mtdProfit, roas: mtdRoas },
  }
}
