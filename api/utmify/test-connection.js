// api/utmify/test-connection.js — Test UTMify MCP connection
// GET /api/utmify/test-connection

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data: configs } = await supabase.from('utmify_config').select('*').limit(1)
    if (!configs || configs.length === 0) {
      return res.status(400).json({ ok: false, error: 'UTMify not configured' })
    }

    const { mcp_url } = configs[0]

    // Try SDK first
    let dashboards
    try {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
      const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js')

      const transport = new SSEClientTransport(new URL(mcp_url))
      const client = new Client({ name: '5kday-ops-center', version: '1.0.0' })
      await client.connect(transport)

      const result = await client.callTool({ name: 'get_dashboards', arguments: {} })
      await client.close()

      if (result.content && result.content[0] && result.content[0].text) {
        dashboards = JSON.parse(result.content[0].text)
      } else {
        dashboards = result
      }
    } catch (sdkErr) {
      console.warn('SDK failed, trying HTTP:', sdkErr.message)

      // HTTP fallback
      const httpRes = await fetch(mcp_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'get_dashboards', arguments: {} },
          id: Date.now(),
        }),
      })

      if (!httpRes.ok) {
        const text = await httpRes.text()
        return res.json({ ok: false, error: `HTTP ${httpRes.status}: ${text.slice(0, 300)}`, method: 'http_fallback' })
      }

      const data = await httpRes.json()
      dashboards = data.result || data
    }

    return res.json({
      ok: true,
      method: 'sdk',
      dashboards: Array.isArray(dashboards) ? dashboards.length : 1,
      data: dashboards,
    })
  } catch (err) {
    return res.json({ ok: false, error: err.message })
  }
}
