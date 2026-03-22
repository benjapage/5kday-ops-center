import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useActivityLog } from './useActivityLog'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type Expense = Database['public']['Tables']['expenses']['Row']
type RevenueEntry = Database['public']['Tables']['revenue_entries']['Row']
type DailyPnl = Database['public']['Views']['daily_pnl']['Row']

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

export function useFinancials(dateFrom?: string, dateTo?: string) {
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [revenues, setRevenues] = useState<RevenueEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { logAction } = useActivityLog()
  const { profile } = useAuth()

  const fetchAll = useCallback(async () => {
    setIsLoading(true)

    const pnlQuery = supabase.from('daily_pnl').select('*').order('date', { ascending: false })
    if (dateFrom) pnlQuery.gte('date', dateFrom)
    if (dateTo) pnlQuery.lte('date', dateTo)

    const expQuery = supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (dateFrom) expQuery.gte('expense_date', dateFrom)
    if (dateTo) expQuery.lte('expense_date', dateTo)

    const revQuery = supabase.from('revenue_entries').select('*').order('revenue_date', { ascending: false })
    if (dateFrom) revQuery.gte('revenue_date', dateFrom)
    if (dateTo) revQuery.lte('revenue_date', dateTo)

    const [pnlRes, expRes, revRes] = await Promise.all([pnlQuery, expQuery, revQuery])

    setDailyPnl(pnlRes.data ?? [])
    setExpenses(expRes.data ?? [])
    setRevenues(revRes.data ?? [])
    setIsLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addExpense(data: ExpenseInsert): Promise<{ error: string | null }> {
    if (!data.category) return { error: 'La categoría es obligatoria' }

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

  // MTD summary
  const today = new Date()
  const mtdFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const mtdPnl = dailyPnl.filter(d => d.date && d.date >= mtdFrom)
  const mtdRevenue = mtdPnl.reduce((s, d) => s + Number(d.total_revenue ?? 0), 0)
  const mtdExpenses = mtdPnl.reduce((s, d) => s + Number(d.total_expenses ?? 0), 0)
  const mtdAdSpend = mtdPnl.reduce((s, d) => s + Number(d.ad_spend ?? 0), 0)
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
    mtd: { revenue: mtdRevenue, expenses: mtdExpenses, adSpend: mtdAdSpend, profit: mtdProfit, roas: mtdRoas },
  }
}
