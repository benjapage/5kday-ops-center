// api/utmify/sync.js — Sync UTMify data via MCP
// GET /api/utmify/sync?days=1 (default: today only)
// GET /api/utmify/sync?from=2026-03-01&to=2026-03-27

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Call UTMify MCP via HTTP JSON-RPC (works in serverless without SSE)
async function callMcpTool(mcpUrl, toolName, args) {
  // MCP over SSE: first establish SSE to get the session endpoint, then POST
  // For simplicity in serverless, we do direct JSON-RPC POST
  const baseUrl = mcpUrl.split('?')[0]
  const token = new URL(mcpUrl).searchParams.get('token')

  // Try direct POST to the MCP endpoint
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: Date.now(),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 500)}`)
  }

  const contentType = res.headers.get('content-type') || ''

  // Handle SSE response
  if (contentType.includes('text/event-stream')) {
    const text = await res.text()
    // Parse SSE events — look for data lines with JSON
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.result) return data.result
          if (data.content) return data
        } catch {}
      }
    }
    throw new Error('No valid data in SSE response')
  }

  // Handle JSON response
  const data = await res.json()
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`)
  return data.result || data
}

// Alternative: use MCP SDK with SSE transport
async function callMcpToolWithSdk(mcpUrl, toolName, args) {
  try {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
    const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js')

    const transport = new SSEClientTransport(new URL(mcpUrl))
    const client = new Client({ name: '5kday-ops-center', version: '1.0.0' })
    await client.connect(transport)

    const result = await client.callTool({ name: toolName, arguments: args })
    await client.close()

    if (result.content && result.content[0] && result.content[0].text) {
      return JSON.parse(result.content[0].text)
    }
    return result
  } catch (err) {
    console.error('MCP SDK failed, trying HTTP fallback:', err.message)
    return callMcpTool(mcpUrl, toolName, args)
  }
}

function formatDate(date, tz = -3) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  const tzStr = tz < 0 ? `-${pad(Math.abs(tz))}:00` : `+${pad(tz)}:00`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDateISO(dateStr, time, tz = -3) {
  const tzStr = tz < 0 ? `-${String(Math.abs(tz)).padStart(2, '0')}:00` : `+${String(tz).padStart(2, '0')}:00`
  return `${dateStr}T${time}${tzStr}`
}

module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Get UTMify config
    const { data: configs, error: cfgErr } = await supabase
      .from('utmify_config')
      .select('*')
      .limit(1)

    if (cfgErr || !configs || configs.length === 0) {
      return res.status(400).json({ error: 'UTMify not configured. Add config in Integraciones.' })
    }

    const config = configs[0]
    const { mcp_url, dashboard_id, timezone } = config

    // Date range
    const days = parseInt(req.query?.days || '1')
    const now = new Date()
    let fromDate, toDate

    if (req.query?.from && req.query?.to) {
      fromDate = req.query.from
      toDate = req.query.to
    } else {
      toDate = formatDate(now)
      const from = new Date(now)
      from.setDate(from.getDate() - (days - 1))
      fromDate = formatDate(from)
    }

    const dateFrom = formatDateISO(fromDate, '00:00:00', timezone)
    const dateTo = formatDateISO(toDate, '23:59:59', timezone)

    console.log(`UTMify sync: ${fromDate} to ${toDate}`)

    // Call UTMify MCP
    let campaigns
    try {
      campaigns = await callMcpToolWithSdk(mcp_url, 'get_meta_ad_objects', {
        dashboardId: dashboard_id,
        level: 'campaign',
        dateRange: { from: dateFrom, to: dateTo },
        orderBy: 'greater_profit',
      })
    } catch (err) {
      return res.status(502).json({ error: `UTMify connection failed: ${err.message}` })
    }

    // Handle different response shapes
    let campaignList = []
    if (Array.isArray(campaigns)) {
      campaignList = campaigns
    } else if (campaigns && campaigns.data && Array.isArray(campaigns.data)) {
      campaignList = campaigns.data
    } else if (campaigns && typeof campaigns === 'object') {
      // Try to find the array in the response
      const keys = Object.keys(campaigns)
      for (const key of keys) {
        if (Array.isArray(campaigns[key])) {
          campaignList = campaigns[key]
          break
        }
      }
    }

    if (campaignList.length === 0) {
      // Update last_sync even if no data
      await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)
      return res.json({ synced: 0, dateRange: { from: fromDate, to: toDate }, message: 'No campaigns found for this period' })
    }

    // Upsert to utmify_sync
    const rows = campaignList.map(c => ({
      date: toDate, // Use the end date as the sync date
      campaign_id: c.id || c.campaignId || c.name || 'unknown',
      campaign_name: c.name || 'Unknown Campaign',
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
    }))

    // Upsert
    const { error: upsertErr } = await supabase
      .from('utmify_sync')
      .upsert(rows, { onConflict: 'date,campaign_id' })

    if (upsertErr) {
      console.error('Upsert error:', upsertErr)
      return res.status(500).json({ error: `DB upsert failed: ${upsertErr.message}` })
    }

    // Update last sync
    await supabase.from('utmify_config').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)

    // Summary
    const totalRevenue = rows.reduce((s, r) => s + r.revenue_cents, 0)
    const totalSpend = rows.reduce((s, r) => s + r.spend_cents, 0)
    const totalProfit = rows.reduce((s, r) => s + r.profit_cents, 0)

    return res.json({
      synced: rows.length,
      dateRange: { from: fromDate, to: toDate },
      summary: {
        revenue: (totalRevenue / 100).toFixed(2),
        spend: (totalSpend / 100).toFixed(2),
        profit: (totalProfit / 100).toFixed(2),
        campaigns: rows.length,
      },
    })
  } catch (err) {
    console.error('UTMify sync error:', err)
    return res.status(500).json({ error: err.message })
  }
}
