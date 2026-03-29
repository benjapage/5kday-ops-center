// api/external/[...path].js — Unified handler for external API + chat + dolar-blue
// Single serverless function to stay within Vercel 12-function limit
// External endpoints require OPS_API_KEY; chat/dolar-blue are internal

const { createClient } = require('@supabase/supabase-js')
const dolarBlueHandler = require('../_lib/dolar-blue')
const { fullSync, testConnection, checkBanSignals } = require('../_lib/sheets-sync')

// ── Helpers ──────────────────────────────────────────────────

function getSupabase() {
  const url = (process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return createClient(url, key)
}

function ok(res, data) {
  return res.status(200).json({ success: true, data, timestamp: new Date().toISOString() })
}

function err(res, status, message) {
  return res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() })
}

function checkAuth(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  return token === (process.env.OPS_API_KEY || '').trim()
}

// Simple in-memory rate limiter for chat
const chatLimiter = { counts: {}, reset: 0 }
function checkChatRate(ip) {
  const now = Date.now()
  if (now - chatLimiter.reset > 3600000) { chatLimiter.counts = {}; chatLimiter.reset = now }
  const key = ip || 'unknown'
  chatLimiter.counts[key] = (chatLimiter.counts[key] || 0) + 1
  return chatLimiter.counts[key] <= 20
}

// ── Route handlers ───────────────────────────────────────────

async function handleDashboard(req, res) {
  const sb = getSupabase()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [offersRes, waRes, tasksRes, utmifyRes, expMtdRes, alertsRes, settingsRes] = await Promise.all([
    sb.from('offers').select('id, name, country, channel, status, current_roas, start_date').eq('status', 'active'),
    sb.from('wa_accounts').select('id, phone_number, status, start_date, bm_id, manychat_name, country'),
    sb.from('app_tasks').select('id, title, scheduled_date, scheduled_time, completed, is_urgent, source').eq('scheduled_date', today),
    sb.from('utmify_sync').select('revenue_cents, spend_cents, profit_cents, campaign_name').eq('date', today),
    sb.from('expenses').select('amount, currency, category').gte('expense_date', mtdFrom),
    sb.from('wa_accounts').select('id, phone_number').eq('status', 'banned'),
    sb.from('settings').select('value').eq('id', 'monthly_targets').single(),
  ])

  const todayUtm = (utmifyRes.data || [])
  const revenueToday = todayUtm.reduce((s, r) => s + (r.revenue_cents || 0), 0) / 100
  const spendToday = todayUtm.reduce((s, r) => s + (r.spend_cents || 0), 0) / 100

  const waList = waRes.data || []
  const wa = {
    total: waList.length,
    active: waList.filter(w => w.status === 'ready').length,
    warming: waList.filter(w => w.status === 'warming').length,
    banned: waList.filter(w => w.status === 'banned').length,
    list: waList,
  }

  const alerts = (alertsRes.data || []).map(a => ({
    type: 'danger',
    message: `Numero ${a.phone_number} fue baneado`,
  }))

  const tasks = (tasksRes.data || [])
  const monthlyTarget = settingsRes.data?.value?.revenue_target || 5000

  return ok(res, {
    revenueToday, spendToday, profitToday: revenueToday - spendToday,
    monthlyTarget,
    activeOffers: (offersRes.data || []).length,
    offers: offersRes.data || [],
    waAccounts: wa,
    todayTasks: { total: tasks.length, completed: tasks.filter(t => t.completed).length, list: tasks },
    alerts,
    todayCampaigns: todayUtm.length,
  })
}

async function handleOffers(req, res, id) {
  const sb = getSupabase()
  if (req.method === 'POST') {
    const { name, product, country, channel, status, drive_folder_id, notes } = req.body || {}
    if (!name || !country) return err(res, 400, 'name and country are required')
    const { data, error } = await sb.from('offers').insert({
      name, country, channel: channel || 'whatsapp', status: status || 'active',
      start_date: new Date().toISOString().split('T')[0], notes,
    }).select().single()
    if (error) return err(res, 500, error.message)
    return ok(res, data)
  }
  if (req.method === 'PUT' && id) {
    const { error, data } = await sb.from('offers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) return err(res, 500, error.message)
    return ok(res, data)
  }
  // GET
  if (id) {
    const { data: offer } = await sb.from('offers').select('*').eq('id', id).single()
    if (!offer) return err(res, 404, 'Offer not found')
    const { data: creatives } = await sb.from('drive_creatives')
      .select('*, drive_offer_folders!inner(offer_id)')
      .eq('drive_offer_folders.offer_id', id)
    return ok(res, { ...offer, creatives: creatives || [] })
  }
  const { data } = await sb.from('offers').select('*').order('created_at', { ascending: false })
  return ok(res, data || [])
}

async function handleCreatives(req, res, sub) {
  const sb = getSupabase()
  if (sub === 'summary') {
    const { data } = await sb.from('drive_creatives')
      .select('creative_type, status, offer_folder_id, drive_offer_folders(offer_id, offers(name))')
    const items = data || []
    const byOffer = {}
    for (const c of items) {
      const name = c.drive_offer_folders?.offers?.name || 'Sin oferta'
      if (!byOffer[name]) byOffer[name] = { videos: 0, images: 0, subido: 0, publicado: 0 }
      if (c.creative_type === 'video') byOffer[name].videos++
      else byOffer[name].images++
      byOffer[name][c.status]++
    }
    return ok(res, {
      total: items.length,
      videos: items.filter(c => c.creative_type === 'video').length,
      images: items.filter(c => c.creative_type === 'imagen').length,
      pendientes: items.filter(c => c.status === 'subido').length,
      publicados: items.filter(c => c.status === 'publicado').length,
      byOffer,
    })
  }
  const { data } = await sb.from('drive_creatives')
    .select('*, drive_offer_folders(offer_id, drive_folder_name, offers(name))')
    .order('detected_at', { ascending: false })
  return ok(res, data || [])
}

async function handleWhatsapp(req, res, id) {
  const sb = getSupabase()
  if (req.method === 'POST') {
    const { phone_number, country, status, bm_id, manychat_name, notes } = req.body || {}
    if (!phone_number || !country) return err(res, 400, 'phone_number and country are required')
    const { data, error } = await sb.from('wa_accounts').insert({
      phone_number, country, status: status || 'warming',
      start_date: new Date().toISOString().split('T')[0],
      bm_id, manychat_name, notes,
    }).select().single()
    if (error) return err(res, 500, error.message)
    return ok(res, data)
  }
  if (req.method === 'PUT' && id) {
    const { error, data } = await sb.from('wa_accounts')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) return err(res, 500, error.message)
    return ok(res, data)
  }
  const { data } = await sb.from('wa_accounts').select('*').order('status').order('start_date', { ascending: false })
  return ok(res, data || [])
}

async function handleEditors(req, res, sub, query) {
  const sb = getSupabase()
  if (sub === 'payments') {
    const week = query.week || new Date().toISOString().split('T')[0]
    const { data } = await sb.from('editor_payments')
      .select('*, editors(name)')
      .lte('week_start', week).gte('week_end', week)
    return ok(res, data || [])
  }
  const { data: editors } = await sb.from('editors').select('*').eq('active', true)
  const { data: payments } = await sb.from('editor_payments')
    .select('*, editors(name)')
    .order('week_start', { ascending: false }).limit(20)
  return ok(res, { editors: editors || [], recentPayments: payments || [] })
}

async function handleFinancials(req, res, sub, query) {
  const sb = getSupabase()
  const now = new Date()

  if (sub === 'daily') {
    const from = query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const to = query.to || now.toISOString().split('T')[0]
    const { data } = await sb.from('utmify_sync')
      .select('date, campaign_name, revenue_cents, spend_cents, profit_cents, roas, approved_orders')
      .gte('date', from).lte('date', to).order('date')
    // Aggregate by date
    const byDate = {}
    for (const r of (data || [])) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, revenue: 0, spend: 0, profit: 0, orders: 0 }
      byDate[r.date].revenue += (r.revenue_cents || 0) / 100
      byDate[r.date].spend += (r.spend_cents || 0) / 100
      byDate[r.date].profit += (r.profit_cents || 0) / 100
      byDate[r.date].orders += (r.approved_orders || 0)
    }
    return ok(res, Object.values(byDate))
  }

  // period-based financials
  const period = query.period || 'month'
  let from, to
  to = now.toISOString().split('T')[0]
  if (period === 'today') {
    from = to
  } else if (period === 'week') {
    from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  } else if (period === 'custom' && query.from) {
    from = query.from; to = query.to || to
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  }

  const [utmRes, expRes] = await Promise.all([
    sb.from('utmify_sync').select('revenue_cents, spend_cents, profit_cents, approved_orders').gte('date', from).lte('date', to),
    sb.from('expenses').select('amount, currency, category').gte('expense_date', from).lte('expense_date', to),
  ])

  const utmRows = utmRes.data || []
  const revenue = utmRows.reduce((s, r) => s + (r.revenue_cents || 0), 0) / 100
  const adSpend = utmRows.reduce((s, r) => s + (r.spend_cents || 0), 0) / 100
  const orders = utmRows.reduce((s, r) => s + (r.approved_orders || 0), 0)

  const expRows = expRes.data || []
  const nonAdExpenses = expRows.filter(e => e.category !== 'ad_spend').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = adSpend + nonAdExpenses
  const profit = revenue - totalExpenses
  const roas = adSpend > 0 ? revenue / adSpend : null

  return ok(res, {
    period, from, to, revenue, adSpend, totalExpenses, nonAdExpenses, profit, roas, orders,
    expenseBreakdown: {
      ad_spend: adSpend,
      tools_software: expRows.filter(e => e.category === 'tools_software').reduce((s, e) => s + Number(e.amount), 0),
      platform_fees: expRows.filter(e => e.category === 'platform_fees').reduce((s, e) => s + Number(e.amount), 0),
      team_salaries: expRows.filter(e => e.category === 'team_salaries').reduce((s, e) => s + Number(e.amount), 0),
      creative_production: expRows.filter(e => e.category === 'creative_production').reduce((s, e) => s + Number(e.amount), 0),
      other: expRows.filter(e => e.category === 'other').reduce((s, e) => s + Number(e.amount), 0),
    },
  })
}

async function handleUtmify(req, res, sub, query) {
  const sb = getSupabase()

  if (sub === 'import' && req.method === 'POST') {
    const campaigns = req.body?.campaigns || req.body
    if (!Array.isArray(campaigns) || campaigns.length === 0) return err(res, 400, 'campaigns array is required')
    const rows = campaigns.map(c => ({
      date: c.date, campaign_id: c.campaign_id || c.campaignId,
      campaign_name: c.campaign_name || c.campaignName || 'Unknown',
      ad_account_id: c.ad_account_id, ad_account_name: c.ad_account_name,
      revenue_cents: c.revenue_cents ?? Math.round((c.revenue || 0) * 100),
      spend_cents: c.spend_cents ?? Math.round((c.spend || 0) * 100),
      profit_cents: c.profit_cents ?? Math.round((c.profit || 0) * 100),
      roas: c.roas, profit_margin: c.profit_margin,
      approved_orders: c.approved_orders || c.orders || 0,
      total_orders: c.total_orders || 0,
      impressions: c.impressions || 0, clicks: c.clicks || 0,
      ctr: c.ctr, hook_rate: c.hook_rate, status: c.status,
      synced_at: new Date().toISOString(),
    }))
    const { data, error } = await sb.from('utmify_sync').upsert(rows, { onConflict: 'date,campaign_id' }).select()
    if (error) return err(res, 500, error.message)
    return ok(res, { imported: (data || []).length })
  }

  // GET campaigns
  const now = new Date()
  const dateParam = query.date || 'today'
  let from, to
  to = now.toISOString().split('T')[0]
  if (dateParam === 'today') { from = to }
  else if (dateParam === 'week') { from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
  else if (dateParam === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] }
  else { from = query.from || dateParam; to = query.to || to }

  const { data } = await sb.from('utmify_sync').select('*').gte('date', from).lte('date', to).order('date', { ascending: false })
  return ok(res, data || [])
}

async function handleSheets(req, res, sub, query) {
  const sb = getSupabase()

  if (sub === 'sync') {
    try {
      const result = await fullSync(sb)
      return ok(res, result)
    } catch (e) {
      return err(res, 500, e.message)
    }
  }

  if (sub === 'test') {
    const spreadsheetId = query.spreadsheet_id || query.id
    if (!spreadsheetId) return err(res, 400, 'spreadsheet_id required')
    try {
      const result = await testConnection(sb, spreadsheetId, query.sales || 'Ventas WA', query.contacts || 'Contactos WA')
      return ok(res, result)
    } catch (e) {
      return err(res, 500, e.message)
    }
  }

  if (sub === 'config') {
    if (req.method === 'POST') {
      const { spreadsheet_id, sales_sheet_name, contacts_sheet_name } = req.body || {}
      if (!spreadsheet_id) return err(res, 400, 'spreadsheet_id required')
      // Upsert: only one config row
      const { data: existing } = await sb.from('sheets_wa_config').select('id').limit(1)
      if (existing?.length) {
        const { data, error } = await sb.from('sheets_wa_config')
          .update({ spreadsheet_id, sales_sheet_name: sales_sheet_name || 'Ventas WA', contacts_sheet_name: contacts_sheet_name || 'Contactos WA' })
          .eq('id', existing[0].id).select().single()
        if (error) return err(res, 500, error.message)
        return ok(res, data)
      }
      const { data, error } = await sb.from('sheets_wa_config')
        .insert({ spreadsheet_id, sales_sheet_name: sales_sheet_name || 'Ventas WA', contacts_sheet_name: contacts_sheet_name || 'Contactos WA' })
        .select().single()
      if (error) return err(res, 500, error.message)
      return ok(res, data)
    }
    const { data } = await sb.from('sheets_wa_config').select('*').limit(1)
    return ok(res, data?.[0] || null)
  }

  if (sub === 'ban-check') {
    try {
      const result = await checkBanSignals(sb)
      return ok(res, result)
    } catch (e) {
      return err(res, 500, e.message)
    }
  }

  if (sub === 'migrate') {
    // One-time migration runner — creates tables if they don't exist
    const sql = `
      CREATE TABLE IF NOT EXISTS public.sheets_wa_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        spreadsheet_id TEXT NOT NULL,
        sales_sheet_name TEXT DEFAULT 'Ventas WA',
        contacts_sheet_name TEXT DEFAULT 'Contactos WA',
        last_sync_at TIMESTAMPTZ,
        auto_sync BOOLEAN DEFAULT true,
        sync_interval_minutes INTEGER DEFAULT 15,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS public.wa_sales (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        sale_date DATE NOT NULL,
        product_name TEXT,
        amount_cents INTEGER NOT NULL,
        buyer_phone TEXT,
        buyer_name TEXT,
        status TEXT DEFAULT 'pagado',
        wa_account_phone TEXT,
        campaign TEXT,
        sheet_row_number INTEGER,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sale_date, buyer_phone, amount_cents)
      );
      CREATE INDEX IF NOT EXISTS idx_wa_sales_date ON public.wa_sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_wa_sales_account ON public.wa_sales(wa_account_phone);
      CREATE TABLE IF NOT EXISTS public.wa_activity_monitor (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        date DATE NOT NULL,
        hour INTEGER NOT NULL,
        contacts_count INTEGER DEFAULT 0,
        sales_count INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(phone_number, date, hour)
      );
      CREATE INDEX IF NOT EXISTS idx_wa_activity_phone ON public.wa_activity_monitor(phone_number);
      CREATE INDEX IF NOT EXISTS idx_wa_activity_date ON public.wa_activity_monitor(date);
    `
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    // Try direct SQL via the management endpoint if rpc fails
    if (!response.ok) {
      // Fallback: create tables individually via supabase client
      try {
        for (const stmt of sql.split(';').filter(s => s.trim())) {
          const { error } = await sb.rpc('exec_sql', { sql: stmt.trim() + ';' })
          if (error && !error.message.includes('already exists')) {
            // Try raw fetch to postgrest
          }
        }
      } catch {}
      // Last resort: use individual table creates
      const tables = ['sheets_wa_config', 'wa_sales', 'wa_activity_monitor']
      const existing = []
      for (const t of tables) {
        const { error } = await sb.from(t).select('id').limit(1)
        if (!error) existing.push(t)
      }
      if (existing.length === 3) {
        return ok(res, { message: 'All tables already exist', tables: existing })
      }
      return err(res, 500, `Could not verify all tables. Existing: ${existing.join(', ')}. Please run the migration SQL manually in Supabase SQL Editor.`)
    }
    return ok(res, { message: 'Migration completed' })
  }

  return err(res, 404, 'Unknown sheets route. Try: sync, test, config, ban-check')
}

async function handleWaSales(req, res, query) {
  const sb = getSupabase()
  const now = new Date()
  const period = query.period || 'month'
  let from, to
  to = now.toISOString().split('T')[0]
  if (period === 'today') { from = to }
  else if (period === 'week') { from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
  else { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] }

  const { data } = await sb.from('wa_sales').select('*').gte('sale_date', from).lte('sale_date', to).order('sale_date', { ascending: false })
  const totalCents = (data || []).reduce((s, r) => s + r.amount_cents, 0)
  return ok(res, { sales: data || [], totalCents, totalUsd: totalCents / 100, period, from, to })
}

async function handleWaActivity(req, res, query) {
  const sb = getSupabase()
  const phone = query.phone
  if (!phone) return err(res, 400, 'phone query param required')

  const since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data } = await sb.from('wa_activity_monitor')
    .select('*')
    .eq('phone_number', phone.replace(/[\s\-\(\)]/g, ''))
    .gte('date', since)
    .order('date').order('hour')

  return ok(res, data || [])
}

async function handleTasks(req, res) {
  const sb = getSupabase()
  if (req.method === 'POST') {
    const { title, scheduled_date, scheduled_time, source, is_urgent, related_offer_id, related_number_id } = req.body || {}
    if (!title || !scheduled_date) return err(res, 400, 'title and scheduled_date are required')
    const { data, error } = await sb.from('app_tasks').insert({
      title, scheduled_date, scheduled_time: scheduled_time || null,
      source: source || 'external', is_urgent: is_urgent || false,
      related_offer_id: related_offer_id || null,
      related_number_id: related_number_id || null,
    }).select().single()
    if (error) return err(res, 500, error.message)
    return ok(res, data)
  }
  return err(res, 405, 'POST only')
}

async function handleChat(req, res) {
  if (req.method !== 'POST') return err(res, 405, 'POST only')

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'local'
  if (!checkChatRate(ip)) return err(res, 429, 'Rate limit exceeded (20/hour)')

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) return err(res, 500, 'ANTHROPIC_API_KEY not configured')

  const { messages } = req.body || {}
  if (!messages || !Array.isArray(messages)) return err(res, 400, 'messages array is required')

  // Gather business context from Supabase
  const sb = getSupabase()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const mtdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [offersRes, waRes, utmTodayRes, utmMtdRes, tasksRes, editorsRes] = await Promise.all([
    sb.from('offers').select('name, country, channel, status, current_roas').eq('status', 'active'),
    sb.from('wa_accounts').select('phone_number, status, start_date, manychat_name, country'),
    sb.from('utmify_sync').select('campaign_name, revenue_cents, spend_cents, profit_cents, roas, approved_orders, impressions, clicks, hook_rate').eq('date', today),
    sb.from('utmify_sync').select('revenue_cents, spend_cents, profit_cents, approved_orders').gte('date', mtdFrom),
    sb.from('app_tasks').select('title, completed, is_urgent').eq('scheduled_date', today),
    sb.from('editors').select('name, active'),
  ])

  const utmToday = utmTodayRes.data || []
  const utmMtd = utmMtdRes.data || []
  const revToday = utmToday.reduce((s, r) => s + (r.revenue_cents || 0), 0) / 100
  const spendToday = utmToday.reduce((s, r) => s + (r.spend_cents || 0), 0) / 100
  const revMtd = utmMtd.reduce((s, r) => s + (r.revenue_cents || 0), 0) / 100
  const spendMtd = utmMtd.reduce((s, r) => s + (r.spend_cents || 0), 0) / 100

  const systemPrompt = `Sos el asistente de analisis de Benjamin en el 5KDay Ops Center.
Tenes acceso a los datos en tiempo real del negocio.
Negocio de infoproductos low ticket ($14.99 USD) via Shopify y WhatsApp.
Meta Ads como plataforma principal. Objetivo: $5,000 USD/dia.
ROAS objetivo: >1.5x, CPA objetivo: <$15, Hook rate objetivo: >40%, Margen objetivo: >30%
Anuncio GANADOR: spend > $100 con ROAS > 1.0x
Anuncio para MATAR: spend > $50 con 0 ventas
Responde siempre en espanol. Se directo y practico.

DATOS ACTUALES DEL NEGOCIO:

OFERTAS ACTIVAS:
${(offersRes.data || []).map(o => `- ${o.name} (${o.country}, ${o.channel}, ROAS: ${o.current_roas ?? 'N/A'})`).join('\n') || 'Sin ofertas activas'}

NUMEROS WHATSAPP:
${(waRes.data || []).map(w => `- ${w.phone_number} [${w.status}] ${w.manychat_name || ''} (${w.country || ''})`).join('\n') || 'Sin numeros'}

METRICAS HOY (${today}):
- Revenue: $${revToday.toFixed(2)}
- Spend: $${spendToday.toFixed(2)}
- Profit: $${(revToday - spendToday).toFixed(2)}
- ROAS: ${spendToday > 0 ? (revToday / spendToday).toFixed(2) + 'x' : 'N/A'}

METRICAS MES:
- Revenue MTD: $${revMtd.toFixed(2)}
- Spend MTD: $${spendMtd.toFixed(2)}
- Profit MTD: $${(revMtd - spendMtd).toFixed(2)}
- ROAS MTD: ${spendMtd > 0 ? (revMtd / spendMtd).toFixed(2) + 'x' : 'N/A'}

CAMPANAS HOY:
${utmToday.map(c => `- ${c.campaign_name}: Rev $${((c.revenue_cents||0)/100).toFixed(2)}, Spend $${((c.spend_cents||0)/100).toFixed(2)}, ROAS ${c.roas || 'N/A'}, Orders ${c.approved_orders || 0}, Hook ${c.hook_rate ? (c.hook_rate * 100).toFixed(1) + '%' : 'N/A'}`).join('\n') || 'Sin datos de campanas hoy'}

TAREAS HOY:
${(tasksRes.data || []).map(t => `- [${t.completed ? 'DONE' : t.is_urgent ? 'URGENTE' : 'TODO'}] ${t.title}`).join('\n') || 'Sin tareas'}

EDITORES: ${(editorsRes.data || []).filter(e => e.active).map(e => e.name).join(', ') || 'N/A'}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[chat] Anthropic error:', text)
      return err(res, 502, `Anthropic API error: ${response.status}`)
    }

    const result = await response.json()
    return ok(res, {
      content: result.content?.[0]?.text || '',
      usage: result.usage,
    })
  } catch (e) {
    console.error('[chat] Error:', e)
    return err(res, 500, e.message)
  }
}

function handleDocs(req, res) {
  return ok(res, {
    name: '5KDay Ops Center API',
    version: '1.0',
    auth: 'Bearer token via Authorization header (OPS_API_KEY)',
    endpoints: {
      'GET /api/external/dashboard': 'Full dashboard snapshot: revenue, profit, WA accounts, tasks, alerts',
      'GET /api/external/offers': 'All offers with status and metrics',
      'GET /api/external/offers/:id': 'Single offer with linked creatives',
      'POST /api/external/offers': 'Create offer. Body: { name, country, channel?, status?, notes? }',
      'PUT /api/external/offers/:id': 'Update offer fields',
      'GET /api/external/creatives': 'All creatives from Drive, grouped by offer',
      'GET /api/external/creatives/summary': 'Creative counts by offer, pending vs published',
      'GET /api/external/whatsapp': 'All WA numbers with status and warming info',
      'POST /api/external/whatsapp': 'Add WA number. Body: { phone_number, country, status?, bm_id? }',
      'PUT /api/external/whatsapp/:id': 'Update WA number status/info',
      'GET /api/external/editors': 'Editors and recent payment history',
      'GET /api/external/editors/payments?week=YYYY-MM-DD': 'Payment details for a specific week',
      'GET /api/external/financials?period=today|week|month|custom&from=X&to=Y': 'Financial summary for period',
      'GET /api/external/financials/daily?from=X&to=Y': 'Daily financial breakdown',
      'GET /api/external/utmify/campaigns?date=today|week|month': 'UTMify campaign data',
      'POST /api/external/utmify/import': 'Import UTMify data. Body: { campaigns: [...] }',
      'POST /api/external/tasks': 'Create task. Body: { title, scheduled_date, scheduled_time?, is_urgent? }',
      'GET /api/external/docs': 'This documentation',
    },
  })
}

// ── Main router ──────────────────────────────────────────────

module.exports = async function handler(req, res) {
  try {
    // Parse path from URL since Vercel catch-all doesn't reliably populate req.query.path
    const urlPath = (req.url || '').split('?')[0].replace(/^\/api\/external\/?/, '')
    const pathParts = urlPath.split('/').filter(Boolean)
    const route = pathParts[0] || ''
    const sub = pathParts[1] || null

    // Internal routes (no OPS_API_KEY needed)
    if (route === 'chat') return handleChat(req, res)
    if (route === 'internal' && sub === 'dolar-blue') return dolarBlueHandler(req, res)
    // Sheets sync — called from frontend (no API key needed)
    if (route === 'sheets') return handleSheets(req, res, sub, req.query)

    // External routes — require API key
    if (!checkAuth(req)) return err(res, 401, 'Invalid or missing API key. Use: Authorization: Bearer <OPS_API_KEY>')

    switch (route) {
      case 'docs': return handleDocs(req, res)
      case 'dashboard': return handleDashboard(req, res)
      case 'offers': return handleOffers(req, res, sub)
      case 'creatives': return handleCreatives(req, res, sub)
      case 'whatsapp': return handleWhatsapp(req, res, sub)
      case 'editors': return handleEditors(req, res, sub, req.query)
      case 'financials': return handleFinancials(req, res, sub, req.query)
      case 'utmify': return handleUtmify(req, res, sub, req.query)
      case 'tasks': return handleTasks(req, res)
      case 'wa-sales': return handleWaSales(req, res, req.query)
      case 'wa-activity': return handleWaActivity(req, res, req.query)
      default: return err(res, 404, `Unknown route: /api/external/${pathParts.join('/')}. Try GET /api/external/docs`)
    }
  } catch (e) {
    console.error('[external] Error:', e)
    return err(res, 500, e.message)
  }
}
