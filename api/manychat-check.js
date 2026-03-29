// api/manychat-check.js — Check ManyChat account status for ban detection
// GET /api/manychat-check — called daily via Vercel Cron
// Smart ban detection: only marks as banned after 3 consecutive failed checks
// API errors or single failures are logged but do NOT trigger bans

const { createClient } = require('@supabase/supabase-js')

const CONSECUTIVE_FAILURES_TO_BAN = 3

async function getManyChatStatus(apiKey) {
  const res = await fetch('https://api.manychat.com/fb/page/getInfo', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ManyChat API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data
}

module.exports = async function handler(req, res) {
  try {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // ?fix=unban — one-time fix: reset all falsely banned numbers to warming
    const { fix } = req.query || {}
    if (fix === 'unban') {
      const { data: banned } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, status')
        .eq('status', 'banned')

      if (!banned || banned.length === 0) {
        return res.status(200).json({ ok: true, message: 'No banned accounts found', fixed: 0 })
      }

      const { error: updateErr } = await supabase
        .from('wa_accounts')
        .update({ status: 'warming', updated_at: new Date().toISOString() })
        .eq('status', 'banned')

      if (updateErr) {
        return res.status(500).json({ error: updateErr.message })
      }

      return res.status(200).json({
        ok: true,
        message: `Reset ${banned.length} account(s) from banned → warming`,
        fixed: banned.length,
        accounts: banned.map(a => a.phone_number),
      })
    }

    // ?fix=status — show current status of all WA accounts (diagnostic)
    if (fix === 'status') {
      const { data: all } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, status, start_date, manychat_name')
        .order('created_at')

      return res.status(200).json({ ok: true, accounts: all })
    }

    // --- Normal cron check ---
    const { data: accounts, error: fetchErr } = await supabase
      .from('wa_accounts')
      .select('id, phone_number, manychat_name, manychat_api_key, status')
      .not('manychat_api_key', 'is', null)
      .neq('manychat_api_key', '')

    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message })
    }

    const results = { checked: 0, banned: 0, restored: 0, flagged: 0, errors: [], details: [] }

    for (const account of (accounts || [])) {
      let mcData, pageData, pageStatus, pageName

      try {
        mcData = await getManyChatStatus(account.manychat_api_key)
      } catch (err) {
        // API errors NEVER trigger bans — just log and skip
        results.errors.push({ phone: account.phone_number, error: err.message })
        continue
      }

      results.checked++

      pageData = mcData.data || mcData
      pageStatus = pageData.status || ''
      pageName = pageData.name || account.manychat_name || 'Unknown'

      const isConnected = pageStatus === 'active'

      const detail = {
        phone: account.phone_number,
        name: pageName,
        mcStatus: pageStatus,
        wasStatus: account.status,
        action: 'none',
      }

      if (!isConnected && account.status !== 'banned') {
        // Log this failed check
        await supabase.from('meta_ban_events').insert({
          wa_account_id: account.id,
          phone_number: account.phone_number,
          source: 'polling',
          quality_score: pageStatus || 'disconnected',
          details: { source: 'manychat', page_name: pageName, mc_status: pageStatus, raw: pageData },
        })

        // Count consecutive recent failures for this account (last 7 days)
        const since = new Date(Date.now() - 7 * 86400000).toISOString()
        const { count } = await supabase
          .from('meta_ban_events')
          .select('id', { count: 'exact', head: true })
          .eq('wa_account_id', account.id)
          .gte('detected_at', since)

        const consecutiveFailures = (count || 0)

        if (consecutiveFailures >= CONSECUTIVE_FAILURES_TO_BAN) {
          // 3+ consecutive failures = real ban, update status
          await supabase
            .from('wa_accounts')
            .update({ status: 'banned', updated_at: new Date().toISOString() })
            .eq('id', account.id)

          detail.action = 'BANNED'
          detail.consecutiveFailures = consecutiveFailures
          results.banned++
        } else {
          // Not enough failures yet — flag only
          detail.action = 'FLAGGED'
          detail.consecutiveFailures = consecutiveFailures
          results.flagged++
        }
      }

      // If connected and currently banned, restore
      if (isConnected && account.status === 'banned') {
        await supabase
          .from('wa_accounts')
          .update({ status: 'ready', updated_at: new Date().toISOString() })
          .eq('id', account.id)

        // Clear old ban events so counter resets
        await supabase
          .from('meta_ban_events')
          .delete()
          .eq('wa_account_id', account.id)

        detail.action = 'RESTORED'
        results.restored++
      }

      results.details.push(detail)
    }

    console.log('[manychat-check] Results:', JSON.stringify(results))

    return res.status(200).json({ ok: true, ...results })
  } catch (err) {
    console.error('[manychat-check] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
