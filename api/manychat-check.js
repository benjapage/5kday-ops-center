// api/manychat-check.js — Check ManyChat account status for ban detection
// GET /api/manychat-check — called hourly via Vercel Cron
// For each WA account with a manychat_api_key, queries ManyChat API
// and marks account as banned if status != "Connected"

const { createClient } = require('@supabase/supabase-js')

async function getManyChatStatus(apiKey) {
  // ManyChat API: GET /fb/page/getInfo
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

    // Get all WA accounts that have a ManyChat API key and are not already banned
    const { data: accounts, error: fetchErr } = await supabase
      .from('wa_accounts')
      .select('id, phone_number, manychat_name, manychat_api_key, status')
      .not('manychat_api_key', 'is', null)
      .neq('manychat_api_key', '')

    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message })
    }

    const results = { checked: 0, banned: 0, errors: [], details: [] }

    for (const account of (accounts || [])) {
      try {
        const mcData = await getManyChatStatus(account.manychat_api_key)
        results.checked++

        // ManyChat returns data.status for the page/account status
        // The status field can be: "active", "inactive", etc.
        // We also check data.data.status or nested fields
        const pageData = mcData.data || mcData
        const pageStatus = pageData.status || ''
        const pageName = pageData.name || account.manychat_name || 'Unknown'

        // Determine if connected - ManyChat uses "active" for connected accounts
        const isConnected = pageStatus === 'active'

        const detail = {
          phone: account.phone_number,
          name: pageName,
          mcStatus: pageStatus,
          wasStatus: account.status,
          action: 'none',
        }

        // AUTO-BAN DISABLED — only log, do NOT change status automatically.
        // Re-enable after reviewing ManyChat status mapping with Benja.
        if (!isConnected && account.status !== 'banned') {
          // Log the detection but do NOT update status
          await supabase.from('meta_ban_events').insert({
            wa_account_id: account.id,
            phone_number: account.phone_number,
            source: 'polling',
            quality_score: pageStatus || 'disconnected',
            details: { source: 'manychat', page_name: pageName, mc_status: pageStatus, raw: pageData, auto_ban: false },
          })

          detail.action = 'FLAGGED_NOT_BANNED'
          results.banned++
        }

        // If connected and currently banned, restore to ready
        if (isConnected && account.status === 'banned') {
          await supabase
            .from('wa_accounts')
            .update({ status: 'ready', updated_at: new Date().toISOString() })
            .eq('id', account.id)

          detail.action = 'RESTORED'
        }

        results.details.push(detail)
      } catch (err) {
        results.errors.push({ phone: account.phone_number, error: err.message })
      }
    }

    console.log('[manychat-check] Results:', JSON.stringify(results))

    return res.status(200).json({
      ok: true,
      ...results,
    })
  } catch (err) {
    console.error('[manychat-check] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
