// api/manychat-check.js — WhatsApp ban detection via ManyChat
// GET  /api/manychat-check         — poll all accounts (cron + frontend auto-check)
// GET  /api/manychat-check?fix=X   — diagnostic/fix tools
// POST /api/manychat-check         — webhook receiver from ManyChat automations (instant ban detection)

const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  const url = (process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return createClient(url, key)
}

// Call multiple ManyChat endpoints to get comprehensive status
async function getManyChatFullStatus(apiKey) {
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }

  // Call page info (general account status)
  const pageRes = await fetch('https://api.manychat.com/fb/page/getInfo', { headers })
  const pageData = pageRes.ok ? await pageRes.json() : null

  // Call WhatsApp-specific endpoints
  let waChannelData = null
  try {
    const waRes = await fetch('https://api.manychat.com/fb/page/getChannels', { headers })
    if (waRes.ok) waChannelData = await waRes.json()
  } catch {}

  // Try to get bot fields / errors (some ManyChat accounts expose this)
  let botInfo = null
  try {
    const botRes = await fetch('https://api.manychat.com/fb/page/getBotFields', { headers })
    if (botRes.ok) botInfo = await botRes.json()
  } catch {}

  return { pageData, waChannelData, botInfo }
}

// Analyze all ManyChat data to determine if WA channel is active
function analyzeStatus(mcStatus) {
  const { pageData, waChannelData } = mcStatus
  const page = pageData?.data || pageData || {}

  const result = {
    pageStatus: page.status || 'unknown',
    pageName: page.name || 'Unknown',
    waChannelActive: null,  // true/false/null if can't determine
    deactivationSignals: [],
    raw: { page, waChannelData },
  }

  // Signal 1: Page status not active
  if (page.status && page.status !== 'active') {
    result.deactivationSignals.push(`page.status="${page.status}"`)
  }

  // Signal 2: WhatsApp channel explicitly deactivated
  if (waChannelData?.data) {
    const channels = Array.isArray(waChannelData.data) ? waChannelData.data : [waChannelData.data]
    for (const ch of channels) {
      if (ch.type === 'whatsapp' || ch.channel === 'whatsapp' || ch.name?.toLowerCase().includes('whatsapp')) {
        if (ch.status === 'deactivated' || ch.status === 'disconnected' || ch.status === 'disabled' || ch.active === false) {
          result.waChannelActive = false
          result.deactivationSignals.push(`wa_channel.status="${ch.status}"`)
        } else if (ch.status === 'active' || ch.status === 'connected' || ch.active === true) {
          result.waChannelActive = true
        }
      }
    }
  }

  // Signal 3: Check nested channel info in page data
  if (page.channels) {
    const waCh = page.channels.whatsapp || page.channels.wa
    if (waCh) {
      if (waCh.status === 'deactivated' || waCh.status === 'disconnected' || waCh.active === false) {
        result.waChannelActive = false
        result.deactivationSignals.push(`page.channels.whatsapp="${waCh.status}"`)
      }
    }
  }

  // Signal 4: is_active field
  if (page.is_active === false) {
    result.deactivationSignals.push('page.is_active=false')
  }

  // Determine overall: is the WhatsApp channel working?
  // If we have explicit WA channel info, use that
  // Otherwise fall back to page status
  if (result.waChannelActive === false) {
    result.isHealthy = false
  } else if (result.waChannelActive === true) {
    result.isHealthy = true
  } else {
    // Can't determine WA specifically, use page status
    result.isHealthy = page.status === 'active'
  }

  return result
}

// Auto-ban a number: update status + log event + create urgent task
async function autoBan(supabase, account, source, details) {
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // 1. Update status
  await supabase.from('wa_accounts')
    .update({ status: 'banned', updated_at: now })
    .eq('id', account.id)

  // 2. Log ban event
  await supabase.from('meta_ban_events').insert({
    wa_account_id: account.id,
    phone_number: account.phone_number,
    source,
    quality_score: 'banned',
    details,
  })

  // 3. Create urgent task (if not already created today)
  const { data: existing } = await supabase
    .from('app_tasks')
    .select('id')
    .eq('related_number_id', account.id)
    .eq('source', 'system_wa_ban')
    .eq('scheduled_date', today)
    .limit(1)

  if (!existing?.length) {
    await supabase.from('app_tasks').insert({
      title: `URGENTE: Numero ${account.phone_number} baneado — reemplazar`,
      scheduled_date: today,
      scheduled_time: '08:00',
      source: 'system_wa_ban',
      is_urgent: true,
      related_number_id: account.id,
    })
  }
}

module.exports = async function handler(req, res) {
  try {
    const supabase = getSupabase()

    // ═══════════════════════════════════════════════════════════
    // POST: Webhook receiver — ManyChat automation sends errors here
    // This is INSTANT detection — no polling delay
    // ═══════════════════════════════════════════════════════════
    if (req.method === 'POST') {
      const body = req.body || {}

      // ManyChat can send: phone_number, event_type, error_message, etc.
      // Accept flexible formats from ManyChat automations
      const phone = body.phone_number || body.phone || body.wa_phone || body.subscriber?.phone || ''
      const eventType = body.event_type || body.type || body.error_type || 'critical_error'
      const errorMsg = body.error_message || body.message || body.error || JSON.stringify(body)

      if (!phone) {
        return res.status(200).json({ ok: true, action: 'ignored', reason: 'no phone_number in payload' })
      }

      // Find the account by phone number (flexible matching)
      const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '')
      const { data: accounts } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, status')

      const account = (accounts || []).find(a => {
        const clean = a.phone_number.replace(/[\s\-\+\(\)]/g, '')
        return clean === cleanPhone || clean.endsWith(cleanPhone) || cleanPhone.endsWith(clean)
      })

      if (!account) {
        return res.status(200).json({ ok: true, action: 'ignored', reason: `phone ${phone} not found in wa_accounts` })
      }

      if (account.status === 'banned') {
        return res.status(200).json({ ok: true, action: 'already_banned', phone: account.phone_number })
      }

      // Auto-ban immediately — ManyChat is telling us there's a critical error
      await autoBan(supabase, account, 'webhook', {
        event_type: eventType,
        error_message: errorMsg,
        raw_payload: body,
        detected_at: new Date().toISOString(),
      })

      console.log(`[manychat-webhook] BANNED ${account.phone_number} — ${eventType}: ${errorMsg}`)

      return res.status(200).json({
        ok: true,
        action: 'BANNED',
        phone: account.phone_number,
        event: eventType,
      })
    }

    // ═══════════════════════════════════════════════════════════
    // GET: Fix/diagnostic tools
    // ═══════════════════════════════════════════════════════════
    const { fix } = req.query || {}

    if (fix === 'unban') {
      const { data: banned } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, status')
        .eq('status', 'banned')

      if (!banned?.length) return res.status(200).json({ ok: true, message: 'No banned accounts', fixed: 0 })

      await supabase.from('wa_accounts')
        .update({ status: 'warming', updated_at: new Date().toISOString() })
        .eq('status', 'banned')

      return res.status(200).json({
        ok: true, fixed: banned.length,
        accounts: banned.map(a => a.phone_number),
      })
    }

    if (fix === 'status') {
      const { data } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, status, start_date, manychat_name, manychat_api_key')
        .order('created_at')

      return res.status(200).json({
        ok: true,
        accounts: (data || []).map(a => ({
          ...a,
          has_api_key: !!a.manychat_api_key,
          manychat_api_key: undefined, // don't expose
        })),
      })
    }

    // Diagnostic: show raw ManyChat API responses for each account
    if (fix === 'diagnose') {
      const { data: accounts } = await supabase
        .from('wa_accounts')
        .select('id, phone_number, manychat_name, manychat_api_key, status')
        .not('manychat_api_key', 'is', null)
        .neq('manychat_api_key', '')

      const diagnostics = []
      for (const account of (accounts || [])) {
        try {
          const mcStatus = await getManyChatFullStatus(account.manychat_api_key)
          const analysis = analyzeStatus(mcStatus)
          diagnostics.push({
            phone: account.phone_number,
            name: account.manychat_name,
            currentStatus: account.status,
            analysis: {
              isHealthy: analysis.isHealthy,
              pageStatus: analysis.pageStatus,
              waChannelActive: analysis.waChannelActive,
              deactivationSignals: analysis.deactivationSignals,
            },
            rawResponses: {
              pageInfo: mcStatus.pageData,
              channels: mcStatus.waChannelData,
              botInfo: mcStatus.botInfo,
            },
          })
        } catch (err) {
          diagnostics.push({ phone: account.phone_number, error: err.message })
        }
      }

      return res.status(200).json({ ok: true, diagnostics })
    }

    // ═══════════════════════════════════════════════════════════
    // GET: Normal polling check (cron + frontend auto-check)
    // ═══════════════════════════════════════════════════════════
    const { data: accounts, error: fetchErr } = await supabase
      .from('wa_accounts')
      .select('id, phone_number, manychat_name, manychat_api_key, status')
      .not('manychat_api_key', 'is', null)
      .neq('manychat_api_key', '')

    if (fetchErr) return res.status(500).json({ error: fetchErr.message })

    const results = { checked: 0, banned: 0, restored: 0, flagged: 0, errors: [], details: [] }

    for (const account of (accounts || [])) {
      let mcStatus, analysis

      try {
        mcStatus = await getManyChatFullStatus(account.manychat_api_key)
        analysis = analyzeStatus(mcStatus)
      } catch (err) {
        results.errors.push({ phone: account.phone_number, error: err.message })
        continue
      }

      results.checked++

      const detail = {
        phone: account.phone_number,
        name: analysis.pageName,
        mcStatus: analysis.pageStatus,
        waChannelActive: analysis.waChannelActive,
        deactivationSignals: analysis.deactivationSignals,
        wasStatus: account.status,
        action: 'none',
      }

      // Unhealthy and not already banned
      if (!analysis.isHealthy && account.status !== 'banned') {
        // If we have CLEAR WhatsApp deactivation signal → auto-ban
        if (analysis.waChannelActive === false) {
          await autoBan(supabase, account, 'polling', {
            source: 'manychat_polling',
            signals: analysis.deactivationSignals,
            raw: analysis.raw,
          })
          detail.action = 'BANNED'
          results.banned++
        } else {
          // No explicit WA signal, just page not active → flag only
          await supabase.from('meta_ban_events').insert({
            wa_account_id: account.id,
            phone_number: account.phone_number,
            source: 'polling',
            quality_score: analysis.pageStatus || 'unhealthy',
            details: { signals: analysis.deactivationSignals, raw: analysis.raw },
          })
          detail.action = 'FLAGGED'
          results.flagged++
        }
      }

      // Healthy but currently banned → restore
      if (analysis.isHealthy && account.status === 'banned') {
        await supabase.from('wa_accounts')
          .update({ status: 'ready', updated_at: new Date().toISOString() })
          .eq('id', account.id)

        await supabase.from('meta_ban_events').delete().eq('wa_account_id', account.id)

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
