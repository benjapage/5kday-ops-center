// _lib/sheets-sync.js — Google Sheets sync for WA sales + contacts + ban detection
// Reads from ManyChat-populated spreadsheet, writes to Supabase

async function getValidToken(supabase) {
  const { data } = await supabase.from('google_tokens').select('*').eq('is_active', true).limit(1)
  if (!data?.length) return null
  const token = data[0]

  if (new Date(token.token_expiry) <= new Date()) {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: token.refresh_token, grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) return null
    const refreshed = await res.json()
    await supabase.from('google_tokens').update({
      access_token: refreshed.access_token,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('email', token.email)
    return refreshed.access_token
  }
  return token.access_token
}

async function readSheet(token, spreadsheetId, sheetName) {
  const range = encodeURIComponent(`${sheetName}!A:H`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.values || []
}

// Sync sales from "Ventas WA" sheet
async function syncSales(supabase, token, config) {
  const rows = await readSheet(token, config.spreadsheet_id, config.sales_sheet_name)
  if (rows.length <= 1) return { synced: 0, skipped: 0 } // Only header or empty

  let synced = 0, skipped = 0

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const [fecha, producto, monto, numComprador, nombre, estado, numCuenta, campana] = rows[i]
    if (!fecha || !monto) { skipped++; continue }

    const saleDate = parseDate(fecha)
    if (!saleDate) { skipped++; continue }

    const amountCents = Math.round(parseFloat(monto) * 100)
    if (isNaN(amountCents) || amountCents <= 0) { skipped++; continue }

    const { error } = await supabase.from('wa_sales').upsert({
      sale_date: saleDate,
      product_name: producto || null,
      amount_cents: amountCents,
      buyer_phone: cleanPhone(numComprador),
      buyer_name: nombre || null,
      status: estado || 'pagado',
      wa_account_phone: cleanPhone(numCuenta),
      campaign: campana || null,
      sheet_row_number: i + 1,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'sale_date,buyer_phone,amount_cents' })

    if (error) skipped++
    else synced++
  }

  return { synced, skipped, totalRows: rows.length - 1 }
}

// Sync contacts from "Contactos WA" sheet + update activity monitor
async function syncContacts(supabase, token, config) {
  const rows = await readSheet(token, config.spreadsheet_id, config.contacts_sheet_name)
  if (rows.length <= 1) return { processed: 0 }

  // Group contacts by phone+date+hour for activity monitor
  const activity = {} // key: "phone|date|hour" → count

  for (let i = 1; i < rows.length; i++) {
    const [fecha, hora, numCuenta, nombre, fuente] = rows[i]
    if (!fecha || !numCuenta) continue

    const date = parseDate(fecha)
    if (!date) continue

    const hour = parseHour(hora)
    const phone = cleanPhone(numCuenta)
    const key = `${phone}|${date}|${hour}`

    activity[key] = (activity[key] || 0) + 1
  }

  // Upsert activity data
  let processed = 0
  for (const [key, count] of Object.entries(activity)) {
    const [phone, date, hour] = key.split('|')
    await supabase.from('wa_activity_monitor').upsert({
      phone_number: phone,
      date,
      hour: parseInt(hour),
      contacts_count: count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone_number,date,hour' })
    processed++
  }

  // Also aggregate sales into activity monitor
  const today = new Date().toISOString().split('T')[0]
  const since3d = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const { data: recentSales } = await supabase
    .from('wa_sales')
    .select('wa_account_phone, sale_date')
    .gte('sale_date', since3d)

  const salesByHour = {}
  for (const s of (recentSales || [])) {
    const phone = cleanPhone(s.wa_account_phone)
    if (!phone) continue
    // Assign to hour 12 as default since sales may not have exact time
    const key = `${phone}|${s.sale_date}|12`
    salesByHour[key] = (salesByHour[key] || 0) + 1
  }

  for (const [key, count] of Object.entries(salesByHour)) {
    const [phone, date, hour] = key.split('|')
    // Update sales_count without overwriting contacts_count
    const { data: existing } = await supabase
      .from('wa_activity_monitor')
      .select('id, contacts_count')
      .eq('phone_number', phone)
      .eq('date', date)
      .eq('hour', parseInt(hour))
      .limit(1)

    if (existing?.length) {
      await supabase.from('wa_activity_monitor')
        .update({ sales_count: count, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
    } else {
      await supabase.from('wa_activity_monitor').upsert({
        phone_number: phone, date, hour: parseInt(hour),
        contacts_count: 0, sales_count: count,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone_number,date,hour' })
    }
  }

  return { processed, totalRows: rows.length - 1 }
}

// Check for ban signals based on activity drop
async function checkBanSignals(supabase) {
  const now = new Date()
  const currentHour = now.getHours()

  // Only check during ad hours (8am - 11pm)
  // Ad hours: 5am - 11:30pm Argentina (UTC-3)
  const argHour = (currentHour - 3 + 24) % 24
  if (argHour < 5) {
    return { checked: 0, alerts: [], reason: 'outside_ad_hours' }
  }

  // Get active WA numbers (not already banned)
  const { data: waAccounts } = await supabase
    .from('wa_accounts')
    .select('id, phone_number, status')
    .neq('status', 'banned')

  if (!waAccounts?.length) return { checked: 0, alerts: [] }

  const today = new Date().toISOString().split('T')[0]
  const since3d = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const since6h = new Date(Date.now() - 6 * 3600000)

  const alerts = []

  for (const account of waAccounts) {
    const phone = cleanPhone(account.phone_number)
    if (!phone) continue

    // Get average hourly activity over last 3 days
    const { data: history } = await supabase
      .from('wa_activity_monitor')
      .select('contacts_count, sales_count')
      .eq('phone_number', phone)
      .gte('date', since3d)
      .lt('date', today)

    const totalHistorical = (history || []).reduce((s, r) => s + r.contacts_count + r.sales_count, 0)
    const hoursTracked = (history || []).length || 1
    const avgPerHour = totalHistorical / hoursTracked

    // If average is less than 1 per hour, not enough data to detect
    if (avgPerHour < 1) continue

    // Get activity in last 6 hours
    const sixHoursAgo = since6h.toISOString().split('T')[0]
    const sixHoursAgoHour = since6h.getHours()

    const { data: recent } = await supabase
      .from('wa_activity_monitor')
      .select('contacts_count, sales_count, date, hour')
      .eq('phone_number', phone)
      .or(`date.gt.${sixHoursAgo},and(date.eq.${sixHoursAgo},hour.gte.${sixHoursAgoHour})`)

    const recentTotal = (recent || []).reduce((s, r) => s + r.contacts_count + r.sales_count, 0)

    // Zero activity in last 6 hours but normal average > 1/hour → suspicious
    if (recentTotal === 0) {
      alerts.push({
        phone: account.phone_number,
        accountId: account.id,
        avgPerHour: Math.round(avgPerHour * 10) / 10,
        lastActivity: recent?.length ? `${recent[0].date} ${recent[0].hour}:00` : 'unknown',
        hoursInactive: 6,
      })

      // Create urgent task if not already created today
      const { data: existingTask } = await supabase
        .from('app_tasks')
        .select('id')
        .eq('related_number_id', account.id)
        .eq('source', 'system_wa_activity')
        .eq('scheduled_date', today)
        .limit(1)

      if (!existingTask?.length) {
        await supabase.from('app_tasks').insert({
          title: `POSIBLE BANEO: ${account.phone_number} — 0 actividad en 6 horas`,
          scheduled_date: today,
          scheduled_time: `${String(currentHour).padStart(2, '0')}:00`,
          source: 'system_wa_activity',
          is_urgent: true,
          related_number_id: account.id,
        })
      }
    }
  }

  return { checked: waAccounts.length, alerts }
}

// Test connection: read first 5 rows of each sheet
async function testConnection(supabase, spreadsheetId, salesSheet, contactsSheet) {
  const token = await getValidToken(supabase)
  if (!token) throw new Error('Google no conectado. Conecta Google en Integraciones primero.')

  const salesPreview = await readSheet(token, spreadsheetId, salesSheet)
  const contactsPreview = await readSheet(token, spreadsheetId, contactsSheet)

  return {
    sales: { rows: salesPreview.slice(0, 6), total: salesPreview.length - 1 },
    contacts: { rows: contactsPreview.slice(0, 6), total: contactsPreview.length - 1 },
  }
}

// Full sync: sales + contacts + ban check
async function fullSync(supabase) {
  const { data: configs } = await supabase.from('sheets_wa_config').select('*').limit(1)
  if (!configs?.length) throw new Error('No hay planilla configurada. Configura en Integraciones.')

  const config = configs[0]
  const token = await getValidToken(supabase)
  if (!token) throw new Error('Google no conectado')

  const salesResult = await syncSales(supabase, token, config)
  const contactsResult = await syncContacts(supabase, token, config)
  const banCheck = await checkBanSignals(supabase)

  // Update last sync
  await supabase.from('sheets_wa_config')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', config.id)

  return { sales: salesResult, contacts: contactsResult, banCheck, syncedAt: new Date().toISOString() }
}

// ── Helpers ──

function cleanPhone(phone) {
  if (!phone) return ''
  return String(phone).trim().replace(/[\s\-\(\)]/g, '')
}

function parseDate(val) {
  if (!val) return null
  // Handle various date formats
  if (typeof val === 'number') {
    // Google Sheets serial date number
    const date = new Date((val - 25569) * 86400000)
    return date.toISOString().split('T')[0]
  }
  const str = String(val).trim()
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  // Try DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

function parseHour(val) {
  if (!val) return 12
  const str = String(val).trim()
  const match = str.match(/^(\d{1,2})/)
  if (match) return Math.min(23, Math.max(0, parseInt(match[1])))
  if (typeof val === 'number') {
    // Sheets stores time as fraction of day
    return Math.floor(val * 24) % 24
  }
  return 12
}

module.exports = { fullSync, testConnection, checkBanSignals, syncSales, syncContacts, getValidToken }
