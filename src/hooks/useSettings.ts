import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useSettings() {
  const [monthlyTarget, setMonthlyTarget] = useState<number>(5000)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchTarget() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'monthly_targets')
        .single()
      if (data?.value?.monthly_revenue) {
        setMonthlyTarget(Number(data.value.monthly_revenue))
      }
    } catch {
      // table may not exist yet — fall back to default
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTarget() }, [])

  async function saveMonthlyTarget(amount: number): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 'monthly_targets', value: { monthly_revenue: amount }, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (error) return { error: error.message }
      setMonthlyTarget(amount)
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  return { monthlyTarget, isLoading, saveMonthlyTarget }
}
