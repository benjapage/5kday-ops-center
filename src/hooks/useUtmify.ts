import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface UtmifyConfig {
  id: string
  mcp_url: string
  dashboard_id: string
  timezone: number
  currency: string
  auto_sync: boolean
  sync_interval_minutes: number
  last_sync_at: string | null
}

export interface UtmifyDashboardData {
  dailyChart: { date: string; label: string; revenue: number; spend: number; profit: number; orders: number }[]
  mtd: {
    revenue: number
    spend: number
    profit: number
    roas: number | null
    orders: number
    waRevenue: number
    landingRevenue: number
  }
  today: { revenue: number; spend: number; profit: number }
  lastSync: string | null
  totalRows: number
}

export function useUtmifyConfig() {
  const [config, setConfig] = useState<UtmifyConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from('utmify_config').select('*').limit(1)
    setConfig(data?.[0] ?? null)
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function saveConfig(updates: Partial<UtmifyConfig>) {
    if (!config) return { error: 'No config found' }
    const { error } = await supabase.from('utmify_config').update(updates).eq('id', config.id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { config, isLoading, refresh: fetch, saveConfig }
}

export function useUtmifyData() {
  const [data, setData] = useState<UtmifyDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await window.fetch('/api/utmify?action=dashboard-data?days=30')
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Error fetching UTMify data')
        setIsLoading(false)
        return
      }
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { data, isLoading, error, refresh: fetch }
}
