// api/utmify.js — Consolidated UTMify API endpoint
// GET  /api/utmify?action=test-connection
// GET  /api/utmify?action=sync&days=1
// GET  /api/utmify?action=dashboard-data&days=30
// POST /api/utmify?action=push  — receives campaign data as JSON body (from Claude.ai MCP)

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

// ─── MCP Connection (Streamable HTTP — no SSE) ───
async function callMcpTool(mcpUrl, toolName, args) {
  // Approach 1: Streamable HTTP — POST with JSON-RPC, expect JSON back
  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        id: Date.now(),
      }),
    })

    const contentType = res.headers.get('content-type') || ''

    // If server returns JSON directly
    if (contentType.includes('application/json')) {
      const data = await res.json()
      if (data.error) throw new Error(`MCP JSON-RPC error: ${JSON.stringify(data.error)}`)
      // Extract content from result
      const result = data.result
      if (result?.content?.[0]?.text) return JSON.parse(result.content[0].text)
      return result
    }

    // If server returns SSE stream, read it fully
    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      const text = await res.text()
      const lines = text.split('\n')
      let lastData = null
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6))
            lastData = parsed
          } catch {}
        }
      }
      if (lastData) {
        if (lastData.result?.content?.[0]?.text) return JSON.parse(lastData.result.content[0].text)
        if (lastData.result) return lastData.result
        if (lastData.content?.[0]?.text) return JSON.parse(lastData.content[0].text)
        return lastData
      }
      throw new Error('No parseable data in SSE stream')
    }

    // Unknown content type — try to read as text
    const text = await res.text()
    try { return JSON.parse(text) } catch {}
    throw new Error(`Unexpected response (${res.status} ${contentType}): ${text.slice(0, 300)}`)
  } catch (httpErr) {
    console.warn('HTTP approach failed:', httpErr.message)
  }

  // Approach 2: MCP SDK with SSE transport (may timeout in serverless)
  try {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
    const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js')

    const transport = new SSEClientTransport(new URL(mcpUrl))
    const client = new Client({ name: '5kday-ops-center', version: '1.0.0' })
    await client.connect(transport)

    const result = await client.callTool({ name: toolName, arguments: args })
    await client.close()

    if (result?.content?.[0]?.text) return JSON.parse(result.content[0].text)
    return result
  } catch (sdkErr) {
    throw new Error(`All MCP approaches failed. HTTP: ${sdkErr.message}`)
  }
}

function formatDateISO(dateStr, time, tz = -3) {
  const tzStr = tz < 0 ? `-${String(Math.abs(tz)).padStart(2, '0')}:00` : `+${String(tz).padStart(2, '0')}:00`
  return `${dateStr}T${time}${tzStr}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function campaignToRow(c, date) {
  return {
    date,
    campaign_id: c.id || c.campaignId || c.name || `camp_${Date.now()}`,
    campaign_name: c.name || 'Unknown',
    ad_account_id: c.adAccountId || c.accountId || null,
    ad_account_name: c.ca || c.adAccountName || null,
    level: 'campaign',
    revenue_cents: parseInt(c.revenue) || 0,
    spend_cents: parseInt(c.spend) || 0,
    profit_cents: parseInt(c.profit) || 0,
    roas: c.roas != null ? parseFloat(c.roas) : null,
    profit_margin: c.profitMargin != null ? parseFloat(c.profitMargin) : null,
    approved_orders: parseInt(c.approvedOrdersCount) || 0,
    total_orders: parseInt(c.totalOrdersCount) || 0,
    cpa_cents: c.cpa != null ? parseInt(c.cpa) : null,
    impressions: parseInt(c.impressions) || 0,
    clicks: parseInt(c.inlineLinkClicks) || 0,
    ctr: c.inlineLinkClickCtr != null ? parseFloat(c.inlineLinkClickCtr) : null,
    landing_page_views: parseInt(c.landingPageViews) || 0,
    initiate_checkout: parseInt(c.initiateCheckout) || 0,
    conversations: parseInt(c.conversations) || 0,
    video_views: parseInt(c.videoViews) || 0,
    hook_rate: c.hook != null ? parseFloat(c.hook) : null,
    retention_rate: c.retention != null ? parseFloat(c.retention) : null,
    status: c.status || null,
    daily_budget_cents: c.dailyBudget != null ? parseInt(c.dailyBudget) : null,
    untracked_count: parseInt(c.untrackedCount) || 0,
    products: c.approvedOrdersByProductId ? JSON.stringify(c.approvedOrdersByProductId) : '[]',
    synced_at: new Date().toISOString(),
  }
}

// ─── ACTION: test-connection ───
async function handleTestConnection(supabase) {
  const { data: configs } = await supabase.from('utmify_config').select('*').limit(1)
  if (!configs?.length) return { ok: false, error: 'UTMify not configured' }

  try {
    const dashboards = await callMcpTool(configs[0].mcp_url, 'get_dashboards', {})
    return { ok: true, data: dashboards }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── ACTION: sync (via MCP from serverless — may be unreliable) ───
async function handleSync(supabase, query) {
  const { data: configs } = await supabase.from('utmify_config').select('*').limit(1)
  if (!configs?.length) return { error: 'UTMify not configured' }

  const config = configs[0]
  const days = parseInt(query.days || '1')
  const now = new Date()
  const toDate = query.to || todayStr()
  const fromD = new Date(now); fromD.setDate(fromD.getDate() - (days - 1))
  const fromDate = query.from || fromD.toISOString().split('T')[0]

  const dateFrom = formatDateISO(fromDate, '00:00:00', config.timezone)
  const dateTo = formatDateISO(toDate, '23:59:59', config.timezone)

  let campaigns
  try {
    campaigns = await callMcpTool(config.mcp_url, 'get_meta_ad_objects', {
      dashboardId: config.dashboard_id,
      level: 'campaign',
      dateRange: { from: dateFrom, to: dateTo },
      orderBy: 'greater_profit',
    })
  } catch (err) {
    return {
      error: `MCP connection failed: ${err.message}`,
      hint: 'Use the PUSH method instead: POST /api/utmify?action=push with campaign data from Claude.ai',
    }
  }

  let list = Array.isArray(campaigns) ? campaigns
    : campaigns?.data && Array.isArray(campaigns.data) ? campaigns.data
    : []
  if (!list.length && campaigns && typeof campaigns === 'object') {
    for (const k of Object.keys(campaigns)) {
      if (Array.isArray(campaigns[k])) { list = campaigns[k]; break }
    }
  }

  if (!list.length) {
    await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)
    return { synced: 0, dateRange: { from: fromDate, to: toDate }, message: 'No campaigns found', rawResponse: typeof campaigns === 'object' ? Object.keys(campaigns) : typeof campaigns }
  }

  const rows = list.map(c => campaignToRow(c, toDate))
  const { error: upsertErr } = await supabase.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' })
  if (upsertErr) return { error: `DB upsert failed: ${upsertErr.message}` }

  await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)

  return {
    synced: rows.length,
    dateRange: { from: fromDate, to: toDate },
    summary: {
      revenue: (rows.reduce((s, r) => s + r.revenue_cents, 0) / 100).toFixed(2),
      spend: (rows.reduce((s, r) => s + r.spend_cents, 0) / 100).toFixed(2),
      profit: (rows.reduce((s, r) => s + r.profit_cents, 0) / 100).toFixed(2),
    },
  }
}

// ─── ACTION: push (receive data from external source like Claude.ai) ───
// POST body: { date: "2026-03-27", campaigns: [...array of campaign objects from UTMify...] }
async function handlePush(supabase, body) {
  if (!body || !body.campaigns || !Array.isArray(body.campaigns)) {
    return { error: 'Body must contain { date: "YYYY-MM-DD", campaigns: [...] }' }
  }

  const date = body.date || todayStr()
  const rows = body.campaigns.map(c => campaignToRow(c, date))

  if (rows.length === 0) {
    return { error: 'No campaigns in body' }
  }

  const { error: upsertErr } = await supabase.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' })
  if (upsertErr) return { error: `DB upsert failed: ${upsertErr.message}` }

  // Update last sync
  const { data: configs } = await supabase.from('utmify_config').select('id').limit(1)
  if (configs?.length) {
    await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', configs[0].id)
  }

  return {
    synced: rows.length,
    date,
    summary: {
      revenue: (rows.reduce((s, r) => s + r.revenue_cents, 0) / 100).toFixed(2),
      spend: (rows.reduce((s, r) => s + r.spend_cents, 0) / 100).toFixed(2),
      profit: (rows.reduce((s, r) => s + r.profit_cents, 0) / 100).toFixed(2),
      campaigns: rows.length,
    },
  }
}

// ─── ACTION: dashboard-data ───
async function handleDashboardData(supabase, query) {
  const days = parseInt(query.days || '30')
  const now = new Date()
  const from = new Date(now); from.setDate(from.getDate() - days)
  const fromDate = from.toISOString().split('T')[0]
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = todayStr()

  const { data: rows, error } = await supabase.from('utmify_sync').select('*').gte('date', fromDate).order('date', { ascending: true })
  if (error) return { error: error.message }

  const byDate = {}
  for (const r of (rows || [])) {
    const d = r.date
    if (!byDate[d]) byDate[d] = { date: d, revenue: 0, spend: 0, profit: 0, orders: 0 }
    byDate[d].revenue += r.revenue_cents
    byDate[d].spend += r.spend_cents
    byDate[d].profit += r.profit_cents
    byDate[d].orders += r.approved_orders
  }

  const dailyChart = Object.values(byDate).map(d => ({
    date: d.date, label: d.date.split('-').slice(1).join('/'),
    revenue: d.revenue / 100, spend: d.spend / 100, profit: d.profit / 100, orders: d.orders,
  }))

  const mtdRows = (rows || []).filter(r => r.date >= mtdFrom)
  const mtdRevenue = mtdRows.reduce((s, r) => s + r.revenue_cents, 0) / 100
  const mtdSpend = mtdRows.reduce((s, r) => s + r.spend_cents, 0) / 100
  const mtdProfit = mtdRows.reduce((s, r) => s + r.profit_cents, 0) / 100
  const mtdOrders = mtdRows.reduce((s, r) => s + r.approved_orders, 0)
  const waRev = mtdRows.filter(r => r.conversations > 0).reduce((s, r) => s + r.revenue_cents, 0) / 100
  const landingRev = mtdRows.filter(r => r.conversations === 0).reduce((s, r) => s + r.revenue_cents, 0) / 100

  const todayRows = (rows || []).filter(r => r.date === today)

  const { data: configs } = await supabase.from('utmify_config').select('last_sync_at').limit(1)

  return {
    dailyChart,
    mtd: { revenue: mtdRevenue, spend: mtdSpend, profit: mtdProfit, roas: mtdSpend > 0 ? mtdRevenue / mtdSpend : null, orders: mtdOrders, waRevenue: waRev, landingRevenue: landingRev },
    today: { revenue: todayRows.reduce((s, r) => s + r.revenue_cents, 0) / 100, spend: todayRows.reduce((s, r) => s + r.spend_cents, 0) / 100, profit: todayRows.reduce((s, r) => s + r.profit_cents, 0) / 100 },
    lastSync: configs?.[0]?.last_sync_at || null,
    totalRows: (rows || []).length,
  }
}

// ─── HANDLER ───
module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const action = req.query?.action || 'dashboard-data'

    switch (action) {
      case 'test-connection':
        return res.json(await handleTestConnection(supabase))
      case 'sync':
        return res.json(await handleSync(supabase, req.query || {}))
      case 'push':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required for push' })
        return res.json(await handlePush(supabase, req.body))
      case 'dashboard-data':
        return res.json(await handleDashboardData(supabase, req.query || {}))
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('UTMify error:', err)
    return res.status(500).json({ error: err.message })
  }
}
