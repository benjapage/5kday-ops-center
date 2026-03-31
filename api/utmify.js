// api/utmify.js — UTMify integration via Streamable HTTP MCP (multi-dashboard)
// GET  /api/utmify?action=test-connection
// GET  /api/utmify?action=sync&days=1&dashboard=testeos|condimentos|whatsapp|all
// GET  /api/utmify?action=dashboard-data&days=30
// POST /api/utmify?action=push  — manual push from Claude.ai

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const MCP_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' }

// ─── 3 Dashboard configs ───
const MCP_URL = 'https://mcp.utmify.com.br/mcp/?token=FpTxQLafNzmbDyBktMlYiCO6h3ehha6GkkGNjN7dpCbmRT5EwuuF0rjdbZeranIa'

const DASHBOARDS = [
  { id: '69a78ca2501d38fceac48178', name: 'TESTEOS - CP 3-4-5', type: 'testeos', useRevenue: true, useSpend: true },
  { id: '69caa2d1fc27d69a9dd2e687', name: 'CONDI ARG CP 2', type: 'condimentos', useRevenue: true, useSpend: true },
  { id: '69caa763a4a3b9ab12036d90', name: 'Whatsapp', type: 'whatsapp', useRevenue: false, useSpend: true },
]

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
  const text = data.result?.content?.[0]?.text
  if (text) return JSON.parse(text)
  return data.result
}

function formatDateISO(dateStr, time, tz = -3) {
  const tzStr = tz < 0 ? `-${String(Math.abs(tz)).padStart(2, '0')}:00` : `+${String(tz).padStart(2, '0')}:00`
  return `${dateStr}T${time}${tzStr}`
}

function todayStr() { return new Date().toISOString().split('T')[0] }

function campaignToRow(c, date, dashboardType) {
  const rawId = c.campaignId || c.id || c.name || `c_${Date.now()}`
  return {
    date,
    campaign_id: `${dashboardType}:${rawId}`,
    campaign_name: c.name || 'Unknown',
    ad_account_id: c.accountId || c.adAccountId || null,
    ad_account_name: c.ca || c.adAccountName || null,
    level: dashboardType, // Store dashboard type in level field
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

// Get dashboard type from campaign_id prefix
function getDashType(campaignId) {
  const colon = (campaignId || '').indexOf(':')
  return colon > 0 ? campaignId.slice(0, colon) : 'testeos' // default for legacy data
}

// ─── ACTION: test-connection ───
async function handleTestConnection() {
  try {
    const serverInfo = await mcpInitialize(MCP_URL)
    const dashboards = await mcpCallTool(MCP_URL, 'get_dashboards', {})
    return { ok: true, serverInfo, dashboards, configured: DASHBOARDS.map(d => d.name) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── ACTION: sync (one or all dashboards) ───
// Uses get_dashboard_summary for accurate totals (includes unattributed revenue)
async function handleSync(supabase, query) {
  const targetType = query.dashboard || 'all'
  const dashboardsToSync = targetType === 'all'
    ? DASHBOARDS
    : DASHBOARDS.filter(d => d.type === targetType)

  if (!dashboardsToSync.length) return { error: `Unknown dashboard: ${targetType}` }

  const days = parseInt(query.days || '1')
  const now = new Date()
  const toDate = query.to || todayStr()
  const fromD = new Date(now); fromD.setDate(fromD.getDate() - (days - 1))
  const fromDate = query.from || fromD.toISOString().split('T')[0]

  await mcpInitialize(MCP_URL)

  // Clean legacy data without prefix (one-time)
  const { data: legacyRows } = await supabase
    .from('utmify_sync')
    .select('id, campaign_id')
    .not('campaign_id', 'like', '%:%')
    .limit(500)
  if (legacyRows?.length) {
    await supabase.from('utmify_sync').delete().in('id', legacyRows.map(r => r.id))
  }

  // Build date list
  const dates = []
  const d = new Date(fromDate + 'T12:00:00Z')
  const end = new Date(toDate + 'T12:00:00Z')
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }

  const results = []
  let totalSynced = 0

  for (const db of dashboardsToSync) {
    let dbError = null

    for (const date of dates) {
      try {
        const dateFrom = formatDateISO(date, '00:00:00')
        const dateTo = formatDateISO(date, '23:59:59')

        // Use get_dashboard_summary for accurate totals
        const summary = await mcpCallTool(MCP_URL, 'get_dashboard_summary', {
          dashboardId: db.id,
          dateRange: { from: dateFrom, to: dateTo },
        })

        const revenueCents = Math.round(summary?.comissions?.gross || 0)
        const spendCents = summary?.ads?.spent || 0
        const orders = summary?.ordersCount?.approved || 0
        const clicks = summary?.ads?.clicks || 0
        const impressions = summary?.ads?.meta?.pageViews || 0
        const conversations = summary?.analytics?.conversations || 0

        // Store one summary row per dashboard per day
        const row = {
          date,
          campaign_id: `${db.type}:daily`,
          campaign_name: db.name,
          ad_account_id: null,
          ad_account_name: db.type,
          level: db.type,
          revenue_cents: revenueCents,
          spend_cents: spendCents,
          profit_cents: revenueCents - spendCents,
          roas: spendCents > 0 ? revenueCents / spendCents : null,
          profit_margin: revenueCents > 0 ? (revenueCents - spendCents) / revenueCents : null,
          approved_orders: orders,
          total_orders: summary?.ordersCount?.total || 0,
          cpa_cents: orders > 0 ? Math.round(spendCents / orders) : null,
          impressions,
          clicks,
          ctr: clicks > 0 && impressions > 0 ? clicks / impressions : null,
          landing_page_views: summary?.ads?.meta?.pageViews || 0,
          initiate_checkout: summary?.ads?.meta?.initiateCheckouts || 0,
          conversations,
          video_views: 0,
          hook_rate: null,
          retention_rate: null,
          status: null,
          daily_budget_cents: null,
          untracked_count: 0,
          products: '[]',
          synced_at: new Date().toISOString(),
        }

        const { error: upsertErr } = await supabase.from('utmify_sync').upsert(row, { onConflict: 'date,campaign_id' })
        if (upsertErr) { dbError = upsertErr.message; break }
      } catch (err) {
        dbError = err.message
        break
      }
    }

    totalSynced += dates.length
    results.push({
      dashboard: db.name, type: db.type, days: dates.length,
      ...(dbError ? { error: dbError } : {}),
    })
  }

  await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).neq('id', '')

  return { synced: totalSynced, dateRange: { from: fromDate, to: toDate }, dashboards: results }
}

// ─── ACTION: push ───
async function handlePush(supabase, body) {
  if (!body?.campaigns && !body?.results) {
    return { error: 'Body must contain { date, campaigns: [...], dashboard?: "testeos" }' }
  }
  const date = body.date || todayStr()
  const dashType = body.dashboard || 'testeos'
  const list = body.campaigns || body.results || []
  if (!list.length) return { error: 'No campaigns in body' }

  const rows = list.map(c => campaignToRow(c, date, dashType))
  const { error: upsertErr } = await supabase.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' })
  if (upsertErr) return { error: `DB upsert: ${upsertErr.message}` }

  await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).neq('id', '')

  return { synced: rows.length, date, dashboard: dashType, summary: summarize(rows) }
}

// ─── ACTION: dashboard-data ───
async function handleDashboardData(supabase, query) {
  const days = parseInt(query.days || '30')
  const now = new Date()
  const from = new Date(now); from.setDate(from.getDate() - days)
  const fromDate = from.toISOString().split('T')[0]
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = todayStr()

  const [{ data: rows, error }, { data: waSalesMtdRows }, { data: waSalesTodayRows }] = await Promise.all([
    supabase.from('utmify_sync').select('*').gte('date', fromDate).order('date'),
    supabase.from('wa_sales').select('amount_cents, sale_date').gte('sale_date', mtdFrom),
    supabase.from('wa_sales').select('amount_cents').eq('sale_date', today),
  ])
  if (error) return { error: error.message }

  // WA revenue from Sheets
  const waRevenueMtdCents = (waSalesMtdRows || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const waRevenueTodayCents = (waSalesTodayRows || []).reduce((s, r) => s + (r.amount_cents || 0), 0)

  // Categorize rows by dashboard type
  const allRows = rows || []

  const byDate = {}
  for (const r of allRows) {
    const type = getDashType(r.campaign_id)
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, revenue: 0, spend: 0, profit: 0, orders: 0 }

    // Revenue: only testeos + condimentos (NOT whatsapp — WA revenue comes from Sheets)
    if (type === 'testeos' || type === 'condimentos') {
      byDate[r.date].revenue += r.revenue_cents
    }
    // Spend: ALL 3 dashboards
    byDate[r.date].spend += r.spend_cents
    // Profit recalculated
    byDate[r.date].orders += r.approved_orders
  }

  // Add WA revenue from Sheets to daily chart
  for (const r of (waSalesMtdRows || [])) {
    if (byDate[r.sale_date]) {
      byDate[r.sale_date].revenue += r.amount_cents
    } else {
      byDate[r.sale_date] = { date: r.sale_date, revenue: r.amount_cents, spend: 0, profit: 0, orders: 0 }
    }
  }

  // Recalculate profit per day
  for (const d of Object.values(byDate)) {
    d.profit = d.revenue - d.spend
  }

  const dailyChart = Object.values(byDate).map(d => ({
    date: d.date, label: d.date.split('-').slice(1).join('/'),
    revenue: d.revenue / 100, spend: d.spend / 100, profit: d.profit / 100, orders: d.orders,
  }))

  // MTD calculations
  const mtdRows = allRows.filter(r => r.date >= mtdFrom)
  let mtdShopifyRev = 0, mtdSpend = 0, mtdOrders = 0, mtdWaSpend = 0
  for (const r of mtdRows) {
    const type = getDashType(r.campaign_id)
    if (type === 'testeos' || type === 'condimentos') mtdShopifyRev += r.revenue_cents
    mtdSpend += r.spend_cents
    mtdOrders += r.approved_orders
    if (type === 'whatsapp') mtdWaSpend += r.spend_cents
  }

  // Today
  const todayRows = allRows.filter(r => r.date === today)
  let todayRev = 0, todaySpend = 0
  for (const r of todayRows) {
    const type = getDashType(r.campaign_id)
    if (type === 'testeos' || type === 'condimentos') todayRev += r.revenue_cents
    todaySpend += r.spend_cents
  }

  // Per-dashboard breakdown
  const byDashboard = {}
  for (const db of DASHBOARDS) {
    const dbRows = mtdRows.filter(r => getDashType(r.campaign_id) === db.type)
    byDashboard[db.type] = {
      name: db.name,
      revenue: dbRows.reduce((s, r) => s + r.revenue_cents, 0) / 100,
      spend: dbRows.reduce((s, r) => s + r.spend_cents, 0) / 100,
      campaigns: dbRows.length,
    }
  }

  const { data: configs } = await supabase.from('utmify_config').select('last_sync_at').limit(1)

  return {
    dailyChart,
    mtd: {
      revenue: (mtdShopifyRev + waRevenueMtdCents) / 100,
      shopifyRevenue: mtdShopifyRev / 100,
      waRevenue: waRevenueMtdCents / 100,
      spend: mtdSpend / 100,
      profit: (mtdShopifyRev + waRevenueMtdCents - mtdSpend) / 100,
      roas: mtdSpend > 0 ? (mtdShopifyRev + waRevenueMtdCents) / mtdSpend : null,
      orders: mtdOrders,
      waSpend: mtdWaSpend / 100,
      landingRevenue: mtdShopifyRev / 100,
    },
    today: {
      revenue: (todayRev + waRevenueTodayCents) / 100,
      shopifyRevenue: todayRev / 100,
      waRevenue: waRevenueTodayCents / 100,
      spend: todaySpend / 100,
      profit: (todayRev + waRevenueTodayCents - todaySpend) / 100,
    },
    byDashboard,
    dashboards: DASHBOARDS.map(d => ({ ...d })),
    lastSync: configs?.[0]?.last_sync_at || null,
    totalRows: allRows.length,
  }
}

// ─── ACTION: wa-check (debug wa_sales data) ───
async function handleWaCheck(supabase) {
  const today = todayStr()
  const mtdFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const { data: allSales, count } = await supabase.from('wa_sales').select('sale_date, amount_cents, product_name', { count: 'exact' }).order('sale_date', { ascending: false }).limit(200)
  const { data: mtdSales } = await supabase.from('wa_sales').select('amount_cents, sale_date').gte('sale_date', mtdFrom)
  const { data: todaySales } = await supabase.from('wa_sales').select('amount_cents').eq('sale_date', today)
  const mtdTotal = (mtdSales || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  const todayTotal = (todaySales || []).reduce((s, r) => s + (r.amount_cents || 0), 0)
  // Group by date
  const byDate = {}
  for (const r of (mtdSales || [])) {
    if (!byDate[r.sale_date]) byDate[r.sale_date] = { count: 0, totalCents: 0 }
    byDate[r.sale_date].count++
    byDate[r.sale_date].totalCents += r.amount_cents || 0
  }
  const dailyBreakdown = Object.entries(byDate).sort().map(([d, v]) => ({ date: d, sales: v.count, usd: (v.totalCents / 100).toFixed(2) }))
  return { totalRows: count, mtdRevenueCents: mtdTotal, mtdRevenueUSD: mtdTotal / 100, todayRevenueCents: todayTotal, todayRevenueUSD: todayTotal / 100, dailyBreakdown, lastSales: (allSales || []).slice(0, 10) }
}

// ─── ACTION: dashboards (list configured dashboards) ───
function handleDashboards() {
  return { dashboards: DASHBOARDS.map(d => ({ ...d, mcp_url: MCP_URL })) }
}

// ─── HANDLER ───
module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const action = req.query?.action || 'dashboard-data'

    switch (action) {
      case 'test-connection': return res.json(await handleTestConnection())
      case 'sync': return res.json(await handleSync(supabase, req.query || {}))
      case 'wipe': {
        // Delete all utmify_sync data
        const { error: delErr } = await supabase.from('utmify_sync').delete().gte('date', '2000-01-01')
        return res.json({ wiped: true, error: delErr?.message || null })
      }
      case 'push':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handlePush(supabase, req.body))
      case 'dashboard-data': return res.json(await handleDashboardData(supabase, req.query || {}))
      case 'wa-check': return res.json(await handleWaCheck(supabase))
      case 'dashboards': return res.json(handleDashboards())
      default: return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('UTMify error:', err)
    return res.status(500).json({ error: err.message })
  }
}
