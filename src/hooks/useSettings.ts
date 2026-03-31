import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useSettings() {
  const [dailyProfitTarget, setDailyProfitTarget] = useState<number>(200)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchTarget() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'monthly_targets')
        .single()
      if (data?.value?.daily_profit) {
        setDailyProfitTarget(Number(data.value.daily_profit))
      } else if (data?.value?.monthly_revenue) {
        // Migration: convert old monthly revenue to daily profit estimate
        setDailyProfitTarget(Math.round(Number(data.value.monthly_revenue) / 30))
      }
    } catch {
      // table may not exist yet — fall back to default
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTarget() }, [])

  async function saveDailyProfitTarget(amount: number): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 'monthly_targets', value: { daily_profit: amount }, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (error) return { error: error.message }
      setDailyProfitTarget(amount)
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  return { dailyProfitTarget, isLoading, saveDailyProfitTarget }
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

// Per-offer testeo tracker — stores { [offer_id]: { testeo, week_start } }
export function useOfferTesteos() {
  const [testeos, setTesteos] = useState<Record<string, number>>({})
  const [raw, setRaw] = useState<Record<string, { testeo: number; week_start: string }>>({})
  const [isLoading, setIsLoading] = useState(true)

  async function fetchTesteos() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'offer_testeos')
        .single()

      if (data?.value) {
        const saved = data.value as Record<string, { testeo: number; week_start: string }>
        const currentMonday = getCurrentMonday()
        const updated: Record<string, { testeo: number; week_start: string }> = {}
        const nums: Record<string, number> = {}
        let needsWrite = false

        for (const [offerId, entry] of Object.entries(saved)) {
          if (entry.week_start && entry.week_start < currentMonday) {
            const savedDate = new Date(entry.week_start)
            const currentDate = new Date(currentMonday)
            const weeksPassed = Math.round((currentDate.getTime() - savedDate.getTime()) / (7 * 86400000))
            const newTesteo = entry.testeo + weeksPassed
            updated[offerId] = { testeo: newTesteo, week_start: currentMonday }
            nums[offerId] = newTesteo
            needsWrite = true
          } else {
            updated[offerId] = entry
            nums[offerId] = entry.testeo
          }
        }

        if (needsWrite) {
          await supabase.from('settings').upsert({
            id: 'offer_testeos',
            value: updated,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
        }

        setRaw(updated)
        setTesteos(nums)
      }
    } catch {}
    setIsLoading(false)
  }

  useEffect(() => { fetchTesteos() }, [])

  function getTesteo(offerId: string): number {
    return testeos[offerId] || 1
  }

  async function setOfferTesteo(offerId: string, num: number): Promise<{ error: string | null }> {
    try {
      const newRaw = { ...raw, [offerId]: { testeo: num, week_start: getCurrentMonday() } }
      const { error } = await supabase.from('settings').upsert({
        id: 'offer_testeos',
        value: newRaw,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) return { error: error.message }
      setRaw(newRaw)
      setTesteos(prev => ({ ...prev, [offerId]: num }))
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  return { testeos, isLoading, getTesteo, setOfferTesteo }
}
