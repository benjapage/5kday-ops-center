// api/utmify/dashboard-data.js — Get aggregated UTMify data for dashboard/financial
// GET /api/utmify/dashboard-data?days=30

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    const days = parseInt(req.query?.days || '30')
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    const fromDate = from.toISOString().split('T')[0]

    // MTD range
    const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    // Get all sync data for the period
    const { data: syncData, error } = await supabase
      .from('utmify_sync')
      .select('*')
      .gte('date', fromDate)
      .order('date', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const rows = syncData || []

    // Daily aggregation for chart
    const byDate = {}
    for (const row of rows) {
      const d = row.date
      if (!byDate[d]) byDate[d] = { date: d, revenue: 0, spend: 0, profit: 0, orders: 0 }
      byDate[d].revenue += row.revenue_cents
      byDate[d].spend += row.spend_cents
      byDate[d].profit += row.profit_cents
      byDate[d].orders += row.approved_orders
    }

    const dailyChart = Object.values(byDate).map(d => ({
      date: d.date,
      label: d.date.split('-').slice(1).join('/'),
      revenue: d.revenue / 100,
      spend: d.spend / 100,
      profit: d.profit / 100,
      orders: d.orders,
    }))

    // MTD totals
    const mtdRows = rows.filter(r => r.date >= mtdFrom)
    const mtdRevenue = mtdRows.reduce((s, r) => s + r.revenue_cents, 0) / 100
    const mtdSpend = mtdRows.reduce((s, r) => s + r.spend_cents, 0) / 100
    const mtdProfit = mtdRows.reduce((s, r) => s + r.profit_cents, 0) / 100
    const mtdOrders = mtdRows.reduce((s, r) => s + r.approved_orders, 0)
    const mtdRoas = mtdSpend > 0 ? mtdRevenue / mtdSpend : null

    // WA vs Landing split (conversations > 0 = WA)
    const waRevenue = mtdRows.filter(r => r.conversations > 0).reduce((s, r) => s + r.revenue_cents, 0) / 100
    const landingRevenue = mtdRows.filter(r => r.conversations === 0).reduce((s, r) => s + r.revenue_cents, 0) / 100

    // Today
    const todayRows = rows.filter(r => r.date === today)
    const todayRevenue = todayRows.reduce((s, r) => s + r.revenue_cents, 0) / 100
    const todaySpend = todayRows.reduce((s, r) => s + r.spend_cents, 0) / 100
    const todayProfit = todayRows.reduce((s, r) => s + r.profit_cents, 0) / 100

    // Last sync
    const { data: configs } = await supabase.from('utmify_config').select('last_sync_at').limit(1)
    const lastSync = configs?.[0]?.last_sync_at || null

    return res.json({
      dailyChart,
      mtd: {
        revenue: mtdRevenue,
        spend: mtdSpend,
        profit: mtdProfit,
        roas: mtdRoas,
        orders: mtdOrders,
        waRevenue,
        landingRevenue,
      },
      today: {
        revenue: todayRevenue,
        spend: todaySpend,
        profit: todayProfit,
      },
      lastSync,
      totalRows: rows.length,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
