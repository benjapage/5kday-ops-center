// api/editor-payments.js — Editor weekly payments: fixed per video + variable per winning ad
// GET  /api/editor-payments?action=calculate&week_start=2026-03-23  — calculate for a week
// GET  /api/editor-payments?action=editors                          — list editors
// POST /api/editor-payments?action=update-editor                    — update editor config
// POST /api/editor-payments?action=add-editor                       — add new editor
// POST /api/editor-payments?action=mark-paid                        — mark week as paid
// POST /api/editor-payments?action=save                             — persist calculated payment

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const UTMIFY_MCP_URL = (process.env.UTMIFY_MCP_URL || 'https://mcp.utmify.com.br/mcp/?token=FpTxQLafNzmbDyBktMlYiCO6h3ehha6GkkGNjN7dpCbmRT5EwuuF0rjdbZeranIa').trim()
const UTMIFY_DASHBOARD_ID = (process.env.UTMIFY_DASHBOARD_ID || '69a78ca2501d38fceac48178').trim()

// ─── Helper: get Monday of a given week ───
function getWeekBounds(weekStartStr) {
  // weekStartStr is a Monday date YYYY-MM-DD
  const start = new Date(weekStartStr + 'T00:00:00-03:00')
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Sunday
  return {
    start: weekStartStr,
    end: end.toISOString().split('T')[0],
    fromISO: `${weekStartStr}T00:00:00-03:00`,
    toISO: `${end.toISOString().split('T')[0]}T23:59:59-03:00`,
  }
}

// Get last Monday from any date
function getLastMonday(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

// ─── Call UTMify MCP to get ad-level data ───
async function fetchWinningAds(fromISO, toISO, thresholdCents) {
  try {
    // Call UTMify MCP endpoint using JSON-RPC
    const res = await fetch(UTMIFY_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_meta_ad_objects',
          arguments: {
            dashboardId: UTMIFY_DASHBOARD_ID,
            level: 'ad',
            dateRange: { from: fromISO, to: toISO },
          },
        },
        id: 1,
      }),
    })

    if (!res.ok) {
      console.warn('[editor-payments] UTMify HTTP error:', res.status)
      return []
    }

    const data = await res.json()

    // MCP response: { result: { content: [{ type: "text", text: "..." }] } }
    let results = []
    if (data?.result?.content) {
      for (const block of data.result.content) {
        if (block.type === 'text') {
          try {
            const parsed = JSON.parse(block.text)
            results = parsed.results || parsed
          } catch { /* not JSON */ }
        }
      }
    } else if (data?.result?.results) {
      results = data.result.results
    } else if (Array.isArray(data?.results)) {
      results = data.results
    }

    // Filter winning ads: spend > threshold
    return results
      .filter(ad => ad.spend > thresholdCents)
      .map(ad => ({
        ad_name: ad.name,
        ad_id: ad.adId || ad.id,
        spend_cents: ad.spend,
        revenue_cents: ad.revenue || 0,
      }))
  } catch (err) {
    console.error('[editor-payments] UTMify fetch error:', err.message)
    return []
  }
}

// ─── Match winning ads to editors via drive_creatives ───
function matchWinnersToEditors(winners, driveCreatives, editors) {
  const editorNames = editors.map(e => e.name.toLowerCase())
  const editorMap = {} // editorName -> [winners]
  const unmatched = []

  for (const winner of winners) {
    const adNameLower = (winner.ad_name || '').toLowerCase()
    let matched = false

    // Strategy 1: Check if ad name contains editor name
    for (const editor of editors) {
      if (adNameLower.includes(editor.name.toLowerCase())) {
        if (!editorMap[editor.name]) editorMap[editor.name] = []
        editorMap[editor.name].push(winner)
        matched = true
        break
      }
    }
    if (matched) continue

    // Strategy 2: Try to match ad name patterns to drive_creatives
    // Look for AD number patterns like "Ad 20", "AD20", "AD 1" in the ad name
    const adNumMatch = adNameLower.match(/ad\s*(\d+)/)
    if (adNumMatch) {
      const adNum = parseInt(adNumMatch[1])
      // Find a creative with matching ad number or similar name pattern
      for (const creative of driveCreatives) {
        const fnLower = (creative.file_name || '').toLowerCase()
        const creativeAdMatch = fnLower.match(/ad\s*(\d+)/)
        if (creativeAdMatch && parseInt(creativeAdMatch[1]) === adNum && creative.uploaded_by) {
          const editorName = creative.uploaded_by.charAt(0).toUpperCase() + creative.uploaded_by.slice(1).toLowerCase()
          if (!editorMap[editorName]) editorMap[editorName] = []
          editorMap[editorName].push(winner)
          matched = true
          break
        }
      }
    }
    if (matched) continue

    // Strategy 3: Check TT (testeo) number pattern
    const ttMatch = adNameLower.match(/tt\s*(\d+)/)
    if (ttMatch) {
      const ttNum = parseInt(ttMatch[1])
      for (const creative of driveCreatives) {
        if (creative.testeo_number === ttNum && creative.uploaded_by) {
          const editorName = creative.uploaded_by.charAt(0).toUpperCase() + creative.uploaded_by.slice(1).toLowerCase()
          if (!editorMap[editorName]) editorMap[editorName] = []
          editorMap[editorName].push(winner)
          matched = true
          break
        }
      }
    }
    if (!matched) unmatched.push(winner)
  }

  return { editorMap, unmatched }
}

// ─── CALCULATE: compute payment for a week ───
async function handleCalculate(supabase, weekStartParam) {
  const weekStart = weekStartParam || getLastMonday()
  const week = getWeekBounds(weekStart)

  // 1. Get editors
  const { data: editors } = await supabase.from('editors').select('*').eq('active', true).order('name')
  if (!editors?.length) return { error: 'No active editors found' }

  // 2. Check if payment already saved
  const { data: existing } = await supabase
    .from('editor_payments')
    .select('*')
    .eq('week_start', week.start)

  if (existing?.length) {
    // Return saved data
    const result = editors.map(editor => {
      const payment = existing.find(p => p.editor_id === editor.id)
      return {
        editor,
        payment: payment || null,
      }
    })
    return { week, editors: result, saved: true }
  }

  // 3. Count videos per editor from drive_creatives for this week
  const { data: weekCreatives } = await supabase
    .from('drive_creatives')
    .select('*')
    .eq('creative_type', 'video')
    .gte('detected_at', week.fromISO)
    .lte('detected_at', week.toISO)

  // 4. Get all drive_creatives (for matching winners)
  const { data: allCreatives } = await supabase
    .from('drive_creatives')
    .select('*')
    .eq('creative_type', 'video')

  // 5. Fetch winning ads from UTMify
  const thresholdCents = editors[0]?.winner_threshold_cents || 10000
  const winners = await fetchWinningAds(week.fromISO, week.toISO, thresholdCents)

  // 6. Match winners to editors
  const { editorMap, unmatched } = matchWinnersToEditors(winners, allCreatives || [], editors)

  // 7. Build result per editor
  const result = editors.map(editor => {
    const editorNameLower = editor.name.toLowerCase()
    const videoCount = (weekCreatives || []).filter(c =>
      (c.uploaded_by || '').toLowerCase() === editorNameLower
    ).length

    const editorWinners = editorMap[editor.name] || []
    const fixedPay = videoCount * editor.rate_per_video_cents
    const variablePay = editorWinners.length * editor.rate_per_winner_cents
    const totalPay = fixedPay + variablePay

    return {
      editor,
      payment: {
        editor_id: editor.id,
        week_start: week.start,
        week_end: week.end,
        videos_count: videoCount,
        fixed_pay_cents: fixedPay,
        winners: editorWinners,
        winners_count: editorWinners.length,
        variable_pay_cents: variablePay,
        total_pay_cents: totalPay,
        paid: false,
        paid_at: null,
      },
    }
  })

  return { week, editors: result, saved: false, unmatched_winners: unmatched }
}

// ─── SAVE: persist calculated payment ───
async function handleSave(supabase, body) {
  const { payments } = body // array of { editor_id, week_start, week_end, ... }
  if (!payments?.length) return { error: 'No payments to save' }

  const results = []
  for (const p of payments) {
    const { data, error } = await supabase.from('editor_payments').upsert({
      editor_id: p.editor_id,
      week_start: p.week_start,
      week_end: p.week_end,
      videos_count: p.videos_count,
      fixed_pay_cents: p.fixed_pay_cents,
      winners: p.winners,
      winners_count: p.winners_count,
      variable_pay_cents: p.variable_pay_cents,
      total_pay_cents: p.total_pay_cents,
      paid: p.paid || false,
    }, { onConflict: 'editor_id,week_start' }).select().single()

    if (error) results.push({ editor_id: p.editor_id, error: error.message })
    else results.push({ editor_id: p.editor_id, ok: true, id: data.id })
  }

  return { saved: results.length, results }
}

// ─── MARK PAID ───
async function handleMarkPaid(supabase, body) {
  const { week_start } = body
  if (!week_start) return { error: 'week_start required' }

  const { data, error } = await supabase
    .from('editor_payments')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('week_start', week_start)
    .eq('paid', false)
    .select()

  if (error) return { error: error.message }
  return { ok: true, marked: data?.length || 0 }
}

// ─── EDITORS: list/update/add ───
async function handleEditors(supabase) {
  const { data } = await supabase.from('editors').select('*').order('name')
  return { editors: data || [] }
}

async function handleUpdateEditor(supabase, body) {
  const { id, name, rate_per_video_cents, rate_per_winner_cents, winner_threshold_cents, active } = body
  if (!id) return { error: 'id required' }

  const update = {}
  if (name !== undefined) update.name = name
  if (rate_per_video_cents !== undefined) update.rate_per_video_cents = rate_per_video_cents
  if (rate_per_winner_cents !== undefined) update.rate_per_winner_cents = rate_per_winner_cents
  if (winner_threshold_cents !== undefined) update.winner_threshold_cents = winner_threshold_cents
  if (active !== undefined) update.active = active

  const { data, error } = await supabase.from('editors').update(update).eq('id', id).select().single()
  if (error) return { error: error.message }
  return { ok: true, editor: data }
}

async function handleAddEditor(supabase, body) {
  const { name } = body
  if (!name) return { error: 'name required' }

  const { data, error } = await supabase.from('editors').insert({ name }).select().single()
  if (error) return { error: error.message }
  return { ok: true, editor: data }
}

// ─── HANDLER ───
module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const action = req.query?.action || 'calculate'

    switch (action) {
      case 'calculate':
        return res.json(await handleCalculate(supabase, req.query?.week_start))
      case 'save':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleSave(supabase, req.body))
      case 'mark-paid':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleMarkPaid(supabase, req.body))
      case 'editors':
        return res.json(await handleEditors(supabase))
      case 'update-editor':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleUpdateEditor(supabase, req.body))
      case 'add-editor':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleAddEditor(supabase, req.body))
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[editor-payments] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
