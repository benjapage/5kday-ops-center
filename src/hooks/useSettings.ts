import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AppTargets {
  daily_profit: number
  monthly_revenue: number
  daily_videos: number
  daily_images: number
  default_max_cpa: number
  default_min_roas: number
}

const DEFAULT_TARGETS: AppTargets = {
  daily_profit: 200,
  monthly_revenue: 60000,
  daily_videos: 5,
  daily_images: 15,
  default_max_cpa: 15,
  default_min_roas: 1.5,
}

export function useSettings() {
  const [targets, setTargets] = useState<AppTargets>(DEFAULT_TARGETS)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchTarget() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'monthly_targets')
        .single()
      if (data?.value) {
        setTargets(prev => ({
          ...prev,
          daily_profit: Number(data.value.daily_profit) || prev.daily_profit,
          monthly_revenue: Number(data.value.monthly_revenue) || prev.monthly_revenue,
          daily_videos: Number(data.value.daily_videos) || prev.daily_videos,
          daily_images: Number(data.value.daily_images) || prev.daily_images,
          default_max_cpa: Number(data.value.default_max_cpa) || prev.default_max_cpa,
          default_min_roas: Number(data.value.default_min_roas) || prev.default_min_roas,
        }))
      }
    } catch {
      // table may not exist yet — fall back to defaults
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTarget() }, [])

  const dailyProfitTarget = targets.daily_profit

  async function saveDailyProfitTarget(amount: number): Promise<{ error: string | null }> {
    return saveTargets({ daily_profit: amount })
  }

  async function saveTargets(updates: Partial<AppTargets>): Promise<{ error: string | null }> {
    try {
      const merged = { ...targets, ...updates }
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 'monthly_targets', value: merged, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (error) return { error: error.message }
      setTargets(merged)
      return { error: null }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  return { dailyProfitTarget, targets, isLoading, saveDailyProfitTarget, saveTargets }
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
