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

// Get the Monday of the current week as YYYY-MM-DD
function getCurrentMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toISOString().split('T')[0]
}

export function useCurrentTesteo() {
  const [testeo, setTesteo] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchTesteo() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'current_testeo')
        .single()

      if (data?.value) {
        const saved = data.value as { testeo: number; week_start: string }
        const currentMonday = getCurrentMonday()

        if (saved.week_start && saved.week_start < currentMonday) {
          // Calculate how many weeks passed and increment
          const savedDate = new Date(saved.week_start)
          const currentDate = new Date(currentMonday)
          const weeksPassed = Math.round((currentDate.getTime() - savedDate.getTime()) / (7 * 86400000))
          const newTesteo = saved.testeo + weeksPassed

          await supabase.from('settings').upsert({
            id: 'current_testeo',
            value: { testeo: newTesteo, week_start: currentMonday },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
          setTesteo(newTesteo)
        } else {
          setTesteo(saved.testeo)
        }
      }
    } catch {
      // table may not exist — default to 1
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTesteo() }, [])

  async function setCurrentTesteo(num: number): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'current_testeo',
        value: { testeo: num, week_start: getCurrentMonday() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) return { error: error.message }
      setTesteo(num)
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  return { testeo, isLoading, setCurrentTesteo }
}
