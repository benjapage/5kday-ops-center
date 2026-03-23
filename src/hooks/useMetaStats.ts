import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface MetaAdStat {
  account_id: string
  account_name: string | null
  stat_date: string
  spend: number
  impressions: number
  clicks: number
  purchases: number
  purchase_value: number
  cpc: number | null
  cpm: number | null
  ctr: number | null
  cost_per_purchase: number | null
  currency: string | null
}

export interface MetaCampaignStat {
  campaign_id: string
  campaign_name: string | null
  account_id: string
  stat_date: string
  spend: number
  impressions: number
  clicks: number
  purchases: number
  purchase_value: number
  cpc: number | null
  cost_per_purchase: number | null
}

export interface MetaAdsetStat {
  adset_id: string
  adset_name: string | null
  campaign_id: string
  account_id: string
  stat_date: string
  spend: number
  impressions: number
  clicks: number
  purchases: number
  purchase_value: number
  cpc: number | null
  cost_per_purchase: number | null
}

export function useMetaStats(days = 7) {
  const [accountStats, setAccountStats] = useState<MetaAdStat[]>([])
  const [campaignStats, setCampaignStats] = useState<MetaCampaignStat[]>([])
  const [adsetStats, setAdsetStats] = useState<MetaAdsetStat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const [acctRes, campRes, adsetRes] = await Promise.all([
      supabase.from('meta_ad_stats').select('*').gte('stat_date', since).order('stat_date', { ascending: false }),
      supabase.from('meta_campaign_stats').select('*').gte('stat_date', since).order('stat_date', { ascending: false }),
      supabase.from('meta_adset_stats').select('*').gte('stat_date', since).order('stat_date', { ascending: false }),
    ])
    setAccountStats((acctRes.data as MetaAdStat[]) || [])
    setCampaignStats((campRes.data as MetaCampaignStat[]) || [])
    setAdsetStats((adsetRes.data as MetaAdsetStat[]) || [])
    setIsLoading(false)
  }, [since])

  useEffect(() => { refresh() }, [refresh])

  // Aggregated metrics
  const today = new Date().toISOString().split('T')[0]
  const spendToday = accountStats.filter(s => s.stat_date === today).reduce((sum, s) => sum + Number(s.spend), 0)
  const spendTotal = accountStats.reduce((sum, s) => sum + Number(s.spend), 0)
  const impressionsTotal = accountStats.reduce((sum, s) => sum + Number(s.impressions), 0)
  const clicksTotal = accountStats.reduce((sum, s) => sum + Number(s.clicks), 0)
  const purchasesTotal = accountStats.reduce((sum, s) => sum + Number(s.purchases), 0)
  const purchaseValueTotal = accountStats.reduce((sum, s) => sum + Number(s.purchase_value), 0)
  const avgCpc = clicksTotal > 0 ? spendTotal / clicksTotal : null
  const avgCostPerPurchase = purchasesTotal > 0 ? spendTotal / purchasesTotal : null
  const metaRoas = spendTotal > 0 ? purchaseValueTotal / spendTotal : null

  return {
    accountStats,
    campaignStats,
    adsetStats,
    isLoading,
    refresh,
    summary: {
      spendToday,
      spendTotal,
      impressionsTotal,
      clicksTotal,
      purchasesTotal,
      purchaseValueTotal,
      avgCpc,
      avgCostPerPurchase,
      metaRoas,
    },
  }
}
