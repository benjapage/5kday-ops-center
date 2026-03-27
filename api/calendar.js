// api/calendar.js — Google Calendar integration
// GET  /api/calendar?action=events&date=2026-03-27  — get day's events
// POST /api/calendar?action=create — create event { title, date, time, duration_minutes, source, related_offer_id, related_number_id }
// POST /api/calendar?action=complete — mark task complete { taskId }
// GET  /api/calendar?action=auto-tasks — generate system tasks from WA/pipeline state
// GET  /api/calendar?action=status — check calendar connection

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim()
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
const TZ = 'America/Argentina/Buenos_Aires'

async function getGoogleToken(supabase) {
  const { data } = await supabase.from('google_tokens').select('*').eq('is_active', true).limit(1)
  if (!data?.length) return null
  const token = data[0]

  // Refresh if expired
  if (new Date(token.token_expiry) <= new Date()) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) return null
    const refreshed = await res.json()
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await supabase.from('google_tokens').update({
      access_token: refreshed.access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    }).eq('email', token.email)
    return refreshed.access_token
  }
  return token.access_token
}

async function calendarGet(accessToken, path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `https://www.googleapis.com/calendar/v3${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function calendarPost(accessToken, path, body) {
  const url = `https://www.googleapis.com/calendar/v3${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// ─── ACTION: status ───
async function handleStatus(supabase) {
  const token = await getGoogleToken(supabase)
  if (!token) return { connected: false }
  try {
    const cal = await calendarGet(token, '/calendars/primary')
    return { connected: true, calendar: cal.summary, email: cal.id }
  } catch {
    return { connected: false, error: 'Token expired or invalid' }
  }
}

// ─── ACTION: events ───
async function handleEvents(supabase, query) {
  const date = query.date || new Date().toISOString().split('T')[0]
  const token = await getGoogleToken(supabase)

  // Get app_tasks for this date
  const { data: tasks } = await supabase
    .from('app_tasks')
    .select('*')
    .eq('scheduled_date', date)
    .order('scheduled_time', { ascending: true })

  // Get Google Calendar events if connected
  let calendarEvents = []
  if (token) {
    try {
      const events = await calendarGet(token, '/calendars/primary/events', {
        timeMin: `${date}T00:00:00-03:00`,
        timeMax: `${date}T23:59:59-03:00`,
        timeZone: TZ,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      })
      calendarEvents = (events.items || []).map(e => ({
        id: e.id,
        title: e.summary || '(sin titulo)',
        time: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : e.start?.date ? 'Todo el dia' : '',
        isAllDay: !!e.start?.date,
        source: 'google_calendar',
      }))
    } catch (err) {
      console.warn('Calendar fetch error:', err.message)
    }
  }

  // Merge: app tasks + calendar events (dedupe by google_event_id)
  const appTaskIds = new Set((tasks || []).filter(t => t.google_event_id).map(t => t.google_event_id))
  const uniqueCalEvents = calendarEvents.filter(e => !appTaskIds.has(e.id))

  const merged = [
    ...(tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      time: t.scheduled_time ? t.scheduled_time.slice(0, 5) : '',
      completed: t.completed,
      source: t.source,
      google_event_id: t.google_event_id,
    })),
    ...uniqueCalEvents.map(e => ({
      id: `gcal_${e.id}`,
      title: e.title,
      time: e.time,
      completed: false,
      source: 'google_calendar',
      google_event_id: e.id,
    })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  return { date, tasks: merged, calendarConnected: !!token }
}

// ─── ACTION: create ───
async function handleCreate(supabase, body) {
  const { title, date, time, duration_minutes, source, related_offer_id, related_number_id } = body
  if (!title) return { error: 'title is required' }

  const taskDate = date || new Date().toISOString().split('T')[0]
  const taskTime = time || null
  const duration = duration_minutes || 30

  // Save to app_tasks
  let googleEventId = null

  // Try to create in Google Calendar
  const token = await getGoogleToken(supabase)
  if (token && taskTime) {
    try {
      const startDt = `${taskDate}T${taskTime}:00-03:00`
      const endMinutes = parseInt(taskTime.split(':')[1]) + duration
      const endHour = parseInt(taskTime.split(':')[0]) + Math.floor(endMinutes / 60)
      const endMin = endMinutes % 60
      const endDt = `${taskDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00-03:00`

      const event = await calendarPost(token, '/calendars/primary/events', {
        summary: title,
        start: { dateTime: startDt, timeZone: TZ },
        end: { dateTime: endDt, timeZone: TZ },
        description: source !== 'manual' ? `[Auto] Fuente: ${source}` : undefined,
      })
      googleEventId = event.id
    } catch (err) {
      console.warn('Failed to create calendar event:', err.message)
    }
  }

  const { data: task, error } = await supabase.from('app_tasks').insert({
    title,
    scheduled_date: taskDate,
    scheduled_time: taskTime,
    duration_minutes: duration,
    source: source || 'manual',
    related_offer_id: related_offer_id || null,
    related_number_id: related_number_id || null,
    google_event_id: googleEventId,
  }).select().single()

  if (error) return { error: error.message }
  return { task, googleEventCreated: !!googleEventId }
}

// ─── ACTION: complete ───
async function handleComplete(supabase, body) {
  const { taskId, completed } = body
  if (!taskId) return { error: 'taskId is required' }

  const isComplete = completed !== false
  const { error } = await supabase.from('app_tasks').update({
    completed: isComplete,
    completed_at: isComplete ? new Date().toISOString() : null,
  }).eq('id', taskId)

  if (error) return { error: error.message }
  return { ok: true }
}

// ─── ACTION: auto-tasks ───
async function handleAutoTasks(supabase) {
  const today = new Date().toISOString().split('T')[0]
  const created = []

  // 1. WA numbers completing warming (ready to activate)
  const readyCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data: readyNumbers } = await supabase
    .from('wa_accounts')
    .select('id, phone_number')
    .eq('status', 'warming')
    .lte('start_date', readyCutoff)

  for (const num of (readyNumbers || [])) {
    // Check if task already exists
    const { data: existing } = await supabase
      .from('app_tasks')
      .select('id')
      .eq('related_number_id', num.id)
      .eq('source', 'system_wa_renewal')
      .eq('scheduled_date', today)
      .limit(1)

    if (!existing?.length) {
      const result = await handleCreate(supabase, {
        title: `Activar numero ${num.phone_number} — calentamiento completo`,
        date: today,
        time: '09:00',
        source: 'system_wa_renewal',
        related_number_id: num.id,
      })
      if (result.task) created.push(result.task.title)
    }
  }

  // 2. Banned numbers → urgent task
  const { data: bannedNumbers } = await supabase
    .from('wa_accounts')
    .select('id, phone_number')
    .eq('status', 'banned')

  for (const num of (bannedNumbers || [])) {
    const { data: existing } = await supabase
      .from('app_tasks')
      .select('id')
      .eq('related_number_id', num.id)
      .eq('source', 'system_wa_ban')
      .eq('scheduled_date', today)
      .limit(1)

    if (!existing?.length) {
      const result = await handleCreate(supabase, {
        title: `URGENTE: Numero ${num.phone_number} baneado — reemplazar`,
        date: today,
        time: '08:00',
        source: 'system_wa_ban',
        related_number_id: num.id,
      })
      if (result.task) created.push(result.task.title)
    }
  }

  // 3. Active offers without creatives this week
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: offers } = await supabase
    .from('offers')
    .select('id, name')
    .eq('status', 'active')

  for (const offer of (offers || [])) {
    const { count } = await supabase
      .from('creatives')
      .select('id', { count: 'exact', head: true })
      .eq('offer_id', offer.id)
      .gte('created_at', weekAgo)

    if (count === 0) {
      const { data: existing } = await supabase
        .from('app_tasks')
        .select('id')
        .eq('related_offer_id', offer.id)
        .eq('source', 'system_creativos')
        .eq('scheduled_date', today)
        .limit(1)

      if (!existing?.length) {
        const result = await handleCreate(supabase, {
          title: `Subir creativos para ${offer.name}`,
          date: today,
          time: '10:00',
          source: 'system_creativos',
          related_offer_id: offer.id,
        })
        if (result.task) created.push(result.task.title)
      }
    }
  }

  return { created: created.length, tasks: created }
}

// ─── HANDLER ───
module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const action = req.query?.action || 'events'

    switch (action) {
      case 'status': return res.json(await handleStatus(supabase))
      case 'events': return res.json(await handleEvents(supabase, req.query || {}))
      case 'create':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleCreate(supabase, req.body))
      case 'complete':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
        return res.json(await handleComplete(supabase, req.body))
      case 'auto-tasks': return res.json(await handleAutoTasks(supabase))
      default: return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('Calendar error:', err)
    return res.status(500).json({ error: err.message })
  }
}
