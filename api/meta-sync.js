// api/meta-sync.js — Sync Meta Ads data: spend, impressions, clicks, purchases
// GET /api/meta-sync?days=7 (default 7 days)

const { createClient } = require('@supabase/supabase-js')

const META_API = 'https://graph.facebook.com/v21.0'

async function metaGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`${META_API}${path}?${qs}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API ${res.status}: ${err}`)
  }
  return res.json()
}

module.exports = async function handler(req, res) {
  try {
    const token = (process.env.META_ACCESS_TOKEN || '').trim()
    if (!token) {
      return res.status(500).json({ error: 'META_ACCESS_TOKEN not configured' })
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const days = parseInt(req.query.days) || 7
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    const timeRange = JSON.stringify({ since, until: today })

    console.log('[meta-sync] Syncing', days, 'days from', since, 'to', today)

    // 1. Get ad accounts the token has access to
    const meRes = await metaGet('/me', token, { fields: 'id,name' })
    console.log('[meta-sync] User:', meRes.name, meRes.id)

    const adAccountsRes = await metaGet(`/me/adaccounts`, token, {
      fields: 'id,name,account_id,currency,account_status',
      limit: '50',
    })
    const adAccounts = adAccountsRes.data || []
    console.log('[meta-sync] Ad accounts:', adAccounts.length)

    const results = { accounts: 0, campaigns: 0, adsets: 0, errors: [] }

    for (const account of adAccounts) {
      const actId = account.id // format: act_123456
      const accountId = account.account_id
      const currency = account.currency || 'USD'

      // 2. Account-level daily stats
      try {
        const statsRes = await metaGet(`/${actId}/insights`, token, {
          fields: 'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr',
          time_range: timeRange,
          time_increment: '1',
          level: 'account',
          limit: '100',
        })

        for (const day of (statsRes.data || [])) {
          const purchases = (day.actions || []).find(a => a.action_type === 'purchase')
          const purchaseValue = (day.action_values || []).find(a => a.action_type === 'purchase')
          const purchaseCount = purchases ? parseInt(purchases.value) : 0
          const purchaseVal = purchaseValue ? parseFloat(purchaseValue.value) : 0
          const spend = parseFloat(day.spend || '0')

          await supabase.from('meta_ad_stats').upsert({
            account_id: accountId,
            account_name: account.name,
            stat_date: day.date_start,
            spend,
            impressions: parseInt(day.impressions || '0'),
            clicks: parseInt(day.clicks || '0'),
            purchases: purchaseCount,
            purchase_value: purchaseVal,
            cpc: day.cpc ? parseFloat(day.cpc) : null,
            cpm: day.cpm ? parseFloat(day.cpm) : null,
            ctr: day.ctr ? parseFloat(day.ctr) : null,
            cost_per_purchase: purchaseCount > 0 ? spend / purchaseCount : null,
            currency,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'account_id,stat_date' })

          results.accounts++
        }
      } catch (err) {
        console.error('[meta-sync] Account stats error for', accountId, err.message)
        results.errors.push({ type: 'account', id: accountId, error: err.message })
      }

      // 3. Campaign-level daily stats
      try {
        const campRes = await metaGet(`/${actId}/insights`, token, {
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,cpc',
          time_range: timeRange,
          time_increment: '1',
          level: 'campaign',
          limit: '500',
        })

        for (const day of (campRes.data || [])) {
          const purchases = (day.actions || []).find(a => a.action_type === 'purchase')
          const purchaseValue = (day.action_values || []).find(a => a.action_type === 'purchase')
          const purchaseCount = purchases ? parseInt(purchases.value) : 0
          const purchaseVal = purchaseValue ? parseFloat(purchaseValue.value) : 0
          const spend = parseFloat(day.spend || '0')

          await supabase.from('meta_campaign_stats').upsert({
            campaign_id: day.campaign_id,
            campaign_name: day.campaign_name,
            account_id: accountId,
            stat_date: day.date_start,
            spend,
            impressions: parseInt(day.impressions || '0'),
            clicks: parseInt(day.clicks || '0'),
            purchases: purchaseCount,
            purchase_value: purchaseVal,
            cpc: day.cpc ? parseFloat(day.cpc) : null,
            cost_per_purchase: purchaseCount > 0 ? spend / purchaseCount : null,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'campaign_id,stat_date' })

          results.campaigns++
        }
      } catch (err) {
        console.error('[meta-sync] Campaign stats error for', accountId, err.message)
        results.errors.push({ type: 'campaign', id: accountId, error: err.message })
      }

      // 4. Adset-level daily stats
      try {
        const adsetRes = await metaGet(`/${actId}/insights`, token, {
          fields: 'adset_id,adset_name,campaign_id,spend,impressions,clicks,actions,action_values,cpc',
          time_range: timeRange,
          time_increment: '1',
          level: 'adset',
          limit: '500',
        })

        for (const day of (adsetRes.data || [])) {
          const purchases = (day.actions || []).find(a => a.action_type === 'purchase')
          const purchaseValue = (day.action_values || []).find(a => a.action_type === 'purchase')
          const purchaseCount = purchases ? parseInt(purchases.value) : 0
          const purchaseVal = purchaseValue ? parseFloat(purchaseValue.value) : 0
          const spend = parseFloat(day.spend || '0')

          await supabase.from('meta_adset_stats').upsert({
            adset_id: day.adset_id,
            adset_name: day.adset_name,
            campaign_id: day.campaign_id,
            account_id: accountId,
            stat_date: day.date_start,
            spend,
            impressions: parseInt(day.impressions || '0'),
            clicks: parseInt(day.clicks || '0'),
            purchases: purchaseCount,
            purchase_value: purchaseVal,
            cpc: day.cpc ? parseFloat(day.cpc) : null,
            cost_per_purchase: purchaseCount > 0 ? spend / purchaseCount : null,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'adset_id,stat_date' })

          results.adsets++
        }
      } catch (err) {
        console.error('[meta-sync] Adset stats error for', accountId, err.message)
        results.errors.push({ type: 'adset', id: accountId, error: err.message })
      }
    }

    console.log('[meta-sync] Done:', results)
    return res.status(200).json({
      ok: true,
      user: meRes.name,
      adAccounts: adAccounts.length,
      synced: {
        accountDays: results.accounts,
        campaignDays: results.campaigns,
        adsetDays: results.adsets,
      },
      errors: results.errors,
    })
  } catch (err) {
    console.error('[meta-sync] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
