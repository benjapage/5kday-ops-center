// api/meta-sync.js — Sync Meta Ads data: spend, impressions, clicks, purchases
// GET /api/meta-sync?days=1&level=all (default: days=1, level=account)
// level=account: only account stats (fast, <10s)
// level=all: account + campaign + adset (slow, may timeout on Hobby)

const { createClient } = require('@supabase/supabase-js')

const META_API = 'https://graph.facebook.com/v22.0'

async function metaGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`${META_API}${path}?${qs}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API ${res.status}: ${err.slice(0, 300)}`)
  }
  return res.json()
}

function extractPurchases(day) {
  // Buscar en action_values el valor total de conversiones de compras
  // Meta puede reportar como 'purchase', 'omni_purchase', o 'offsite_conversion.fb_pixel_purchase'
  const purchaseTypes = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']
  const actionTypes = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']

  let count = 0
  let value = 0

  // Tomar el primer tipo que tenga datos (omni_purchase es el mas completo)
  for (const type of actionTypes) {
    const action = (day.actions || []).find(a => a.action_type === type)
    if (action) { count = parseInt(action.value); break }
  }
  for (const type of purchaseTypes) {
    const actionVal = (day.action_values || []).find(a => a.action_type === type)
    if (actionVal) { value = parseFloat(actionVal.value); break }
  }

  return { count, value }
}

module.exports = async function handler(req, res) {
  try {
    const token = (process.env.META_ACCESS_TOKEN || '').trim()
    if (!token) return res.status(500).json({ error: 'META_ACCESS_TOKEN not configured' })

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' })

    const supabase = createClient(supabaseUrl, serviceKey)
    const days = parseInt(req.query.days) || 1
    const level = req.query.level || 'account'
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    const timeRange = JSON.stringify({ since, until: today })

    // Get ad accounts
    const adAccountsRes = await metaGet('/me/adaccounts', token, {
      fields: 'id,name,account_id,currency',
      limit: '50',
    })
    const adAccounts = adAccountsRes.data || []
    const results = { accounts: 0, campaigns: 0, adsets: 0, errors: [] }

    // Fetch account-level stats in parallel (fast)
    const accountPromises = adAccounts.map(async (account) => {
      const actId = account.id
      const accountId = account.account_id
      const currency = account.currency || 'USD'

      try {
        const statsRes = await metaGet(`/${actId}/insights`, token, {
          fields: 'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr',
          time_range: timeRange,
          time_increment: '1',
          level: 'account',
          action_attribution_windows: '["7d_click","1d_view"]',
          limit: '100',
        })

        for (const day of (statsRes.data || [])) {
          const p = extractPurchases(day)
          const spend = parseFloat(day.spend || '0')

          await supabase.from('meta_ad_stats').upsert({
            account_id: accountId,
            account_name: account.name,
            stat_date: day.date_start,
            spend,
            impressions: parseInt(day.impressions || '0'),
            clicks: parseInt(day.clicks || '0'),
            purchases: p.count,
            purchase_value: p.value,
            cpc: day.cpc ? parseFloat(day.cpc) : null,
            cpm: day.cpm ? parseFloat(day.cpm) : null,
            ctr: day.ctr ? parseFloat(day.ctr) : null,
            cost_per_purchase: p.count > 0 ? spend / p.count : null,
            currency,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'account_id,stat_date' })

          // Also insert/update as expense (ad_spend category) for Dashboard/Financial
          if (spend > 0) {
            const marker = `Meta Ads: ${account.name} — ${day.date_start}`
            // Check if expense already exists for this account+date
            const { data: existing } = await supabase
              .from('expenses')
              .select('id, amount')
              .eq('description', marker)
              .eq('expense_date', day.date_start)
              .maybeSingle()

            if (existing) {
              // Update if amount changed
              if (Number(existing.amount) !== spend) {
                await supabase.from('expenses').update({
                  amount: spend,
                  currency,
                  updated_at: new Date().toISOString(),
                }).eq('id', existing.id)
              }
            } else {
              await supabase.from('expenses').insert({
                amount: spend,
                currency,
                category: 'ad_spend',
                description: marker,
                expense_date: day.date_start,
              })
            }
          }

          results.accounts++
        }
      } catch (err) {
        results.errors.push({ type: 'account', id: accountId, error: err.message })
      }
    })

    await Promise.all(accountPromises)

    // Campaign + Adset only if level=all (may timeout on Hobby plan)
    if (level === 'all') {
      for (const account of adAccounts) {
        const actId = account.id
        const accountId = account.account_id

        try {
          const campRes = await metaGet(`/${actId}/insights`, token, {
            fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,cpc',
            time_range: timeRange, time_increment: '1', level: 'campaign', limit: '500',
          })
          for (const day of (campRes.data || [])) {
            const p = extractPurchases(day)
            const spend = parseFloat(day.spend || '0')
            await supabase.from('meta_campaign_stats').upsert({
              campaign_id: day.campaign_id, campaign_name: day.campaign_name,
              account_id: accountId, stat_date: day.date_start, spend,
              impressions: parseInt(day.impressions || '0'), clicks: parseInt(day.clicks || '0'),
              purchases: p.count, purchase_value: p.value,
              cpc: day.cpc ? parseFloat(day.cpc) : null,
              cost_per_purchase: p.count > 0 ? spend / p.count : null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'campaign_id,stat_date' })
            results.campaigns++
          }
        } catch (err) {
          results.errors.push({ type: 'campaign', id: accountId, error: err.message })
        }

        try {
          const adsetRes = await metaGet(`/${actId}/insights`, token, {
            fields: 'adset_id,adset_name,campaign_id,spend,impressions,clicks,actions,action_values,cpc',
            time_range: timeRange, time_increment: '1', level: 'adset', limit: '500',
          })
          for (const day of (adsetRes.data || [])) {
            const p = extractPurchases(day)
            const spend = parseFloat(day.spend || '0')
            await supabase.from('meta_adset_stats').upsert({
              adset_id: day.adset_id, adset_name: day.adset_name,
              campaign_id: day.campaign_id, account_id: accountId,
              stat_date: day.date_start, spend,
              impressions: parseInt(day.impressions || '0'), clicks: parseInt(day.clicks || '0'),
              purchases: p.count, purchase_value: p.value,
              cpc: day.cpc ? parseFloat(day.cpc) : null,
              cost_per_purchase: p.count > 0 ? spend / p.count : null,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'adset_id,stat_date' })
            results.adsets++
          }
        } catch (err) {
          results.errors.push({ type: 'adset', id: accountId, error: err.message })
        }
      }
    }

    return res.status(200).json({
      ok: true,
      adAccounts: adAccounts.length,
      level,
      synced: { accountDays: results.accounts, campaignDays: results.campaigns, adsetDays: results.adsets },
      errors: results.errors,
    })
  } catch (err) {
    console.error('[meta-sync] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
