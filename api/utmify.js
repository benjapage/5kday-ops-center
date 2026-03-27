// api/utmify.js — UTMify integration via Streamable HTTP MCP
// GET  /api/utmify?action=test-connection
// GET  /api/utmify?action=sync&days=1
// GET  /api/utmify?action=dashboard-data&days=30
// POST /api/utmify?action=push  — manual push from Claude.ai

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const MCP_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' }

// ─── MCP Streamable HTTP client ───
async function mcpInitialize(mcpUrl) {
  const res = await fetch(mcpUrl, {
    method: 'POST', headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: '5kday-ops-center', version: '1.0.0' } },
    }),
  })
  if (!res.ok) throw new Error(`MCP init failed: ${res.status}`)
  const data = await res.json()
  return data.result?.serverInfo || data.result
}

async function mcpCallTool(mcpUrl, toolName, args) {
  const res = await fetch(mcpUrl, {
    method: 'POST', headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MCP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  if (data.error) throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`)
  // Extract text content
  const text = data.result?.content?.[0]?.text
  if (text) return JSON.parse(text)
  return data.result
}

function formatDateISO(dateStr, time, tz = -3) {
  const tzStr = tz < 0 ? `-${String(Math.abs(tz)).padStart(2, '0')}:00` : `+${String(tz).padStart(2, '0')}:00`
  return `${dateStr}T${time}${tzStr}`
}

function todayStr() { return new Date().toISOString().split('T')[0] }

function campaignToRow(c, date) {
  return {
    date,
    campaign_id: c.campaignId || c.id || c.name || `c_${Date.now()}`,
    campaign_name: c.name || 'Unknown',
    ad_account_id: c.accountId || c.adAccountId || null,
    ad_account_name: c.ca || c.adAccountName || null,
    level: 'campaign',
    revenue_cents: Math.round(parseFloat(c.revenue) || 0),
    spend_cents: Math.round(parseInt(c.spend) || 0),
    profit_cents: Math.round(parseInt(c.profit) || 0),
    roas: c.roas != null ? parseFloat(c.roas) : null,
    profit_margin: c.profitMargin != null ? parseFloat(c.profitMargin) : null,
    approved_orders: parseInt(c.approvedOrdersCount) || 0,
    total_orders: parseInt(c.totalOrdersCount) || 0,
    cpa_cents: c.cpa != null ? Math.round(parseInt(c.cpa)) : null,
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

function summarize(rows) {
  return {
    revenue: (rows.reduce((s, r) => s + r.revenue_cents, 0) / 100).toFixed(2),
    spend: (rows.reduce((s, r) => s + r.spend_cents, 0) / 100).toFixed(2),
    profit: (rows.reduce((s, r) => s + r.profit_cents, 0) / 100).toFixed(2),
    campaigns: rows.length,
  }
}

// ─── ACTION: test-connection ───
async function handleTestConnection(supabase) {
  const { data: configs } = await supabase.from('utmify_config').select('*').limit(1)
  if (!configs?.length) return { ok: false, error: 'UTMify not configured' }
  try {
    const serverInfo = await mcpInitialize(configs[0].mcp_url)
    const dashboards = await mcpCallTool(configs[0].mcp_url, 'get_dashboards', {})
    return { ok: true, serverInfo, dashboards }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── ACTION: sync ───
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

  // Initialize MCP
  await mcpInitialize(config.mcp_url)

  // Call get_meta_ad_objects
  const response = await mcpCallTool(config.mcp_url, 'get_meta_ad_objects', {
    dashboardId: config.dashboard_id,
    level: 'campaign',
    dateRange: { from: dateFrom, to: dateTo },
    orderBy: 'greater_profit',
  })

  // Data is in response.results
  const list = response?.results || []

  if (!list.length) {
    await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)
    return { synced: 0, dateRange: { from: fromDate, to: toDate }, message: 'No campaigns found' }
  }

  const rows = list.map(c => campaignToRow(c, toDate))
  const { error: upsertErr } = await supabase.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' })
  if (upsertErr) return { error: `DB upsert: ${upsertErr.message}` }

  await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)

  return { synced: rows.length, dateRange: { from: fromDate, to: toDate }, summary: summarize(rows) }
}

// ─── ACTION: push ───
async function handlePush(supabase, body) {
  if (!body?.campaigns && !body?.results) {
    return { error: 'Body must contain { date, campaigns: [...] } or { date, results: [...] }' }
  }
  const date = body.date || todayStr()
  const list = body.campaigns || body.results || []
  if (!list.length) return { error: 'No campaigns in body' }

  const rows = list.map(c => campaignToRow(c, date))
  const { error: upsertErr } = await supabase.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' })
  if (upsertErr) return { error: `DB upsert: ${upsertErr.message}` }

  const { data: configs } = await supabase.from('utmify_config').select('id').limit(1)
  if (configs?.length) await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', configs[0].id)

  return { synced: rows.length, date, summary: summarize(rows) }
}

// ─── ACTION: dashboard-data ───
async function handleDashboardData(supabase, query) {
  const days = parseInt(query.days || '30')
  const now = new Date()
  const from = new Date(now); from.setDate(from.getDate() - days)
  const fromDate = from.toISOString().split('T')[0]
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = todayStr()

  const { data: rows, error } = await supabase.from('utmify_sync').select('*').gte('date', fromDate).order('date')
  if (error) return { error: error.message }

  const byDate = {}
  for (const r of (rows || [])) {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, revenue: 0, spend: 0, profit: 0, orders: 0 }
    byDate[r.date].revenue += r.revenue_cents
    byDate[r.date].spend += r.spend_cents
    byDate[r.date].profit += r.profit_cents
    byDate[r.date].orders += r.approved_orders
  }

  const dailyChart = Object.values(byDate).map(d => ({
    date: d.date, label: d.date.split('-').slice(1).join('/'),
    revenue: d.revenue / 100, spend: d.spend / 100, profit: d.profit / 100, orders: d.orders,
  }))

  const mtd = (rows || []).filter(r => r.date >= mtdFrom)
  const mtdRev = mtd.reduce((s, r) => s + r.revenue_cents, 0) / 100
  const mtdSpend = mtd.reduce((s, r) => s + r.spend_cents, 0) / 100
  const todayR = (rows || []).filter(r => r.date === today)

  const { data: configs } = await supabase.from('utmify_config').select('last_sync_at').limit(1)

  return {
    dailyChart,
    mtd: {
      revenue: mtdRev, spend: mtdSpend,
      profit: mtd.reduce((s, r) => s + r.profit_cents, 0) / 100,
      roas: mtdSpend > 0 ? mtdRev / mtdSpend : null,
      orders: mtd.reduce((s, r) => s + r.approved_orders, 0),
      waRevenue: mtd.filter(r => r.conversations > 0).reduce((s, r) => s + r.revenue_cents, 0) / 100,
      landingRevenue: mtd.filter(r => r.conversations === 0).reduce((s, r) => s + r.revenue_cents, 0) / 100,
    },
    today: {
      revenue: todayR.reduce((s, r) => s + r.revenue_cents, 0) / 100,
      spend: todayR.reduce((s, r) => s + r.spend_cents, 0) / 100,
      profit: todayR.reduce((s, r) => s + r.profit_cents, 0) / 100,
    },
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
      case 'test-connection': return res.json(await handleTestConnection(supabase))
      case 'sync': return res.json(await handleSync(supabase, req.query || {}))
      case 'push':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handlePush(supabase, req.body))
      case 'dashboard-data': return res.json(await handleDashboardData(supabase, req.query || {}))
      default: return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('UTMify error:', err)
    return res.status(500).json({ error: err.message })
  }
}
