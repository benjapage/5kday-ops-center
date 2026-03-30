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

    const amountCents = Math.round(parseFloat(String(monto).replace(',', '.')) * 100)
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
    }, { onConflict: 'sheet_row_number' })

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

// Send alert email via Gmail API
async function sendAlertEmail(supabase, subject, body) {
  const token = await getValidToken(supabase)
  if (!token) return { sent: false, reason: 'no_token' }

  // Get user email
  const { data: tokens } = await supabase.from('google_tokens').select('email').eq('is_active', true).limit(1)
  const email = tokens?.[0]?.email
  if (!email) return { sent: false, reason: 'no_email' }

  // Build RFC 2822 email
  const raw = Buffer.from(
    `From: 5KDay Ops Center <${email}>\r\n` +
    `To: ${email}\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: text/html; charset=utf-8\r\n\r\n` +
    body
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[alert-email] Failed:', text.slice(0, 300))
    return { sent: false, reason: `gmail_error_${res.status}` }
  }
  return { sent: true, to: email }
}

// Check for ban signals: 40 min without activity during 6am-11:30pm ARG
async function checkBanSignals(supabase) {
  const now = new Date()
  const utcHour = now.getUTCHours()
  const utcMin = now.getUTCMinutes()
  // Argentina = UTC-3
  const argHour = (utcHour - 3 + 24) % 24
  const argMin = utcMin

  // Only check during ad window: 6:00am - 11:30pm Argentina
  if (argHour < 6 || (argHour === 23 && argMin > 30) || argHour >= 24) {
    return { checked: 0, alerts: [], reason: 'outside_ad_hours' }
  }

  // Get active WA numbers (not already banned)
  const { data: waAccounts } = await supabase
    .from('wa_accounts')
    .select('id, phone_number, status')
    .neq('status', 'banned')

  if (!waAccounts?.length) return { checked: 0, alerts: [] }

  const today = now.toISOString().split('T')[0]
  const since3d = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const fortyMinAgo = new Date(Date.now() - 40 * 60 * 1000)

  const alerts = []

  for (const account of waAccounts) {
    const phone = cleanPhone(account.phone_number)
    if (!phone) continue

    // Get historical activity (last 3 days) to know if this number normally has traffic
    const { data: history } = await supabase
      .from('wa_activity_monitor')
      .select('contacts_count, sales_count')
      .eq('phone_number', phone)
      .gte('date', since3d)

    const totalHistorical = (history || []).reduce((s, r) => s + r.contacts_count + r.sales_count, 0)
    if (totalHistorical < 3) continue // Not enough data yet

    // Find last contact from the sheet data (most recent activity for this number)
    const { data: lastActivity } = await supabase
      .from('wa_activity_monitor')
      .select('date, hour, contacts_count, sales_count, updated_at')
      .eq('phone_number', phone)
      .gt('contacts_count', 0)
      .order('date', { ascending: false })
      .order('hour', { ascending: false })
      .limit(1)

    let lastActiveAt = null
    if (lastActivity?.length) {
      const la = lastActivity[0]
      lastActiveAt = new Date(`${la.date}T${String(la.hour).padStart(2, '0')}:00:00Z`)
    }

    // If last activity was more than 40 minutes ago → alert
    const minutesSinceActivity = lastActiveAt
      ? Math.floor((Date.now() - lastActiveAt.getTime()) / 60000)
      : 9999

    if (minutesSinceActivity >= 40) {
      alerts.push({
        phone: account.phone_number,
        accountId: account.id,
        minutesInactive: minutesSinceActivity,
        lastActivity: lastActiveAt ? lastActiveAt.toISOString() : 'never',
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
          title: `POSIBLE BANEO: ${account.phone_number} — 0 actividad en ${minutesSinceActivity} min`,
          scheduled_date: today,
          scheduled_time: `${String(argHour).padStart(2, '0')}:${String(argMin).padStart(2, '0')}`,
          source: 'system_wa_activity',
          is_urgent: true,
          related_number_id: account.id,
        })

        // Send email alert
        await sendAlertEmail(supabase,
          `🚨 POSIBLE BANEO: ${account.phone_number}`,
          `<div style="font-family:sans-serif;max-width:500px">
            <h2 style="color:#EF4444">Posible baneo detectado</h2>
            <p><strong>Numero:</strong> ${account.phone_number}</p>
            <p><strong>Tiempo sin actividad:</strong> ${minutesSinceActivity} minutos</p>
            <p><strong>Ultima actividad:</strong> ${lastActiveAt ? lastActiveAt.toLocaleString('es-AR') : 'Sin datos'}</p>
            <p style="margin-top:20px">
              <a href="https://5kday-ops-center.vercel.app/meta" style="background:#EF4444;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
                Ver en Ops Center
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:20px">5KDay Ops Center — Alerta automatica</p>
          </div>`
        )
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

module.exports = { fullSync, testConnection, checkBanSignals, sendAlertEmail, syncSales, syncContacts, getValidToken }
