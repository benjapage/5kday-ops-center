// api/drive-offer-sync.js — Per-offer Google Drive sync
// GET  /api/drive-offer-sync?action=sync&offer_id=xxx     — sync one offer's folder
// GET  /api/drive-offer-sync?action=sync-all              — sync all linked offers
// POST /api/drive-offer-sync?action=link                  — link folder { offer_id, drive_url }
// POST /api/drive-offer-sync?action=publish               — publish testeo { offer_folder_id, testeo_number, creative_type }
// GET  /api/drive-offer-sync?action=status&offer_id=xxx   — get creatives for an offer
// GET  /api/drive-offer-sync?action=dashboard-summary     — summary for dashboard widget

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

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

async function driveList(token, folderId) {
  const files = []
  let pageToken = null
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,owners)',
      pageSize: '200',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Drive API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    files.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return files
}

// Extract folder ID from Drive URL or raw ID
function extractFolderId(input) {
  if (!input) return null
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // If it looks like a raw ID (no slashes, no dots)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return input.trim()
  return null
}

// Guess uploaded_by from file owner email or filename
function guessUploader(file) {
  const owners = file.owners || []
  for (const o of owners) {
    const email = (o.emailAddress || '').toLowerCase()
    if (email.includes('janne')) return 'janne'
    if (email.includes('facu')) return 'facu'
    if (email.includes('benja') || email.includes('pagella')) return 'benjamin'
  }
  // Try from filename
  const name = (file.name || '').toLowerCase()
  if (name.includes('janne')) return 'janne'
  if (name.includes('facu')) return 'facu'
  if (name.includes('benja')) return 'benjamin'
  return null
}

// Detect file type from mime
function getFileType(mimeType) {
  if (!mimeType) return null
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  return mimeType.split('/').pop()
}

// ─── SYNC: crawl one offer's Drive folder ───
async function syncOfferFolder(supabase, token, offerFolder) {
  const { id: offerFolderId, drive_folder_id } = offerFolder
  let detected = 0

  // List top-level items in the offer folder
  const topItems = await driveList(token, drive_folder_id)
  const anunciosFolder = topItems.find(f =>
    f.mimeType === 'application/vnd.google-apps.folder' &&
    f.name.toLowerCase().startsWith('anuncio')
  )

  if (!anunciosFolder) {
    // Try to scan directly (maybe user pointed to the Anuncios folder itself)
    await scanAnunciosFolder(supabase, token, offerFolderId, drive_folder_id)
    await supabase.from('drive_offer_folders').update({ last_sync_at: new Date().toISOString() }).eq('id', offerFolderId)
    return { detected: 0, message: 'No Anuncios/ folder found, scanned root' }
  }

  // Inside Anuncios/, look for "Anuncios Video/" and "Anuncios Imagen/"
  const anunciosItems = await driveList(token, anunciosFolder.id)

  for (const subfolder of anunciosItems) {
    if (subfolder.mimeType !== 'application/vnd.google-apps.folder') continue
    const name = subfolder.name.toLowerCase()

    let creativeType = null
    if (name.includes('video')) creativeType = 'video'
    else if (name.includes('imagen') || name.includes('image')) creativeType = 'imagen'
    else continue

    // Inside each type folder, look for Testeo N/ subfolders
    const testeoFolders = await driveList(token, subfolder.id)

    for (const testeoFolder of testeoFolders) {
      if (testeoFolder.mimeType !== 'application/vnd.google-apps.folder') continue

      const testeoMatch = testeoFolder.name.match(/testeo\s*(\d+)/i)
      const testeoNumber = testeoMatch ? parseInt(testeoMatch[1]) : null

      // List files inside testeo folder
      const files = await driveList(token, testeoFolder.id)

      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') continue

        const uploader = guessUploader(file)
        const fileType = getFileType(file.mimeType)

        // Upsert into drive_creatives
        const { error } = await supabase.from('drive_creatives').upsert({
          offer_folder_id: offerFolderId,
          creative_type: creativeType,
          testeo_folder_name: testeoFolder.name,
          testeo_number: testeoNumber,
          file_name: file.name,
          file_type: fileType,
          drive_file_id: file.id,
          uploaded_by: uploader,
          detected_at: new Date().toISOString(),
        }, { onConflict: 'drive_file_id' })

        if (!error) detected++
      }
    }
  }

  await supabase.from('drive_offer_folders').update({ last_sync_at: new Date().toISOString() }).eq('id', offerFolderId)
  return { detected }
}

// Fallback: scan folder directly if it IS the Anuncios folder
async function scanAnunciosFolder(supabase, token, offerFolderId, folderId) {
  const items = await driveList(token, folderId)
  for (const subfolder of items) {
    if (subfolder.mimeType !== 'application/vnd.google-apps.folder') continue
    const name = subfolder.name.toLowerCase()
    let creativeType = null
    if (name.includes('video')) creativeType = 'video'
    else if (name.includes('imagen') || name.includes('image')) creativeType = 'imagen'
    else continue

    const testeoFolders = await driveList(token, subfolder.id)
    for (const tf of testeoFolders) {
      if (tf.mimeType !== 'application/vnd.google-apps.folder') continue
      const testeoMatch = tf.name.match(/testeo\s*(\d+)/i)
      const testeoNumber = testeoMatch ? parseInt(testeoMatch[1]) : null
      const files = await driveList(token, tf.id)
      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') continue
        await supabase.from('drive_creatives').upsert({
          offer_folder_id: offerFolderId,
          creative_type: creativeType,
          testeo_folder_name: tf.name,
          testeo_number: testeoNumber,
          file_name: file.name,
          file_type: getFileType(file.mimeType),
          drive_file_id: file.id,
          uploaded_by: guessUploader(file),
          detected_at: new Date().toISOString(),
        }, { onConflict: 'drive_file_id' })
      }
    }
  }
}

// ─── LINK: connect a Drive folder to an offer ───
async function handleLink(supabase, body) {
  const { offer_id, drive_url } = body
  if (!offer_id || !drive_url) return { error: 'offer_id and drive_url required' }

  const folderId = extractFolderId(drive_url)
  if (!folderId) return { error: 'Could not extract folder ID from URL' }

  // Upsert into drive_offer_folders
  const { data, error } = await supabase.from('drive_offer_folders').upsert({
    offer_id,
    drive_folder_id: folderId,
    drive_folder_name: null,
  }, { onConflict: 'offer_id' }).select().single()

  if (error) return { error: error.message }

  // Also update offer's drive_folder_url
  await supabase.from('offers').update({ drive_folder_url: drive_url }).eq('id', offer_id)

  return { ok: true, folder: data }
}

// ─── SYNC ONE ───
async function handleSync(supabase, token, offerId) {
  const { data: folder } = await supabase
    .from('drive_offer_folders')
    .select('*')
    .eq('offer_id', offerId)
    .single()

  if (!folder) return { error: 'No Drive folder linked to this offer' }
  const result = await syncOfferFolder(supabase, token, folder)
  return { ok: true, ...result }
}

// ─── SYNC ALL ───
async function handleSyncAll(supabase, token) {
  const { data: folders } = await supabase.from('drive_offer_folders').select('*')
  if (!folders?.length) return { synced: 0 }

  let total = 0
  const results = []
  for (const folder of folders) {
    try {
      const r = await syncOfferFolder(supabase, token, folder)
      total += r.detected
      results.push({ offer_id: folder.offer_id, detected: r.detected })
    } catch (err) {
      results.push({ offer_id: folder.offer_id, error: err.message })
    }
  }
  return { synced: folders.length, total_detected: total, results }
}

// ─── PUBLISH testeo ───
async function handlePublish(supabase, body) {
  const { offer_folder_id, testeo_number, creative_type } = body
  if (!offer_folder_id || testeo_number == null || !creative_type) {
    return { error: 'offer_folder_id, testeo_number, and creative_type required' }
  }

  const { data, error } = await supabase
    .from('drive_creatives')
    .update({ status: 'publicado', published_at: new Date().toISOString() })
    .eq('offer_folder_id', offer_folder_id)
    .eq('testeo_number', testeo_number)
    .eq('creative_type', creative_type)
    .eq('status', 'subido')
    .select()

  if (error) return { error: error.message }
  return { ok: true, published: data?.length || 0 }
}

// ─── STATUS: get creatives for an offer ───
async function handleStatus(supabase, offerId) {
  const { data: folder } = await supabase
    .from('drive_offer_folders')
    .select('*')
    .eq('offer_id', offerId)
    .single()

  if (!folder) return { linked: false }

  const { data: creatives } = await supabase
    .from('drive_creatives')
    .select('*')
    .eq('offer_folder_id', folder.id)
    .order('testeo_number', { ascending: true })
    .order('detected_at', { ascending: false })

  // Group by type and testeo
  const videos = {}
  const images = {}
  for (const c of (creatives || [])) {
    const target = c.creative_type === 'video' ? videos : images
    const key = c.testeo_number || 0
    if (!target[key]) target[key] = { testeo: c.testeo_folder_name, number: key, files: [], subido: 0, publicado: 0 }
    target[key].files.push(c)
    if (c.status === 'subido') target[key].subido++
    else target[key].publicado++
  }

  // Today's uploads
  const todayStr = new Date().toISOString().split('T')[0]
  const todayVideos = (creatives || []).filter(c => c.creative_type === 'video' && c.detected_at?.startsWith(todayStr)).length
  const todayImages = (creatives || []).filter(c => c.creative_type === 'imagen' && c.detected_at?.startsWith(todayStr)).length

  return {
    linked: true,
    folder_id: folder.id,
    drive_folder_id: folder.drive_folder_id,
    last_sync: folder.last_sync_at,
    videos: Object.values(videos),
    images: Object.values(images),
    today: { videos: todayVideos, images: todayImages },
    totals: {
      videos: (creatives || []).filter(c => c.creative_type === 'video').length,
      images: (creatives || []).filter(c => c.creative_type === 'imagen').length,
      pendientes: (creatives || []).filter(c => c.status === 'subido').length,
      publicados: (creatives || []).filter(c => c.status === 'publicado').length,
    },
  }
}

// ─── DASHBOARD SUMMARY ───
async function handleDashboardSummary(supabase) {
  // Get all linked folders with offer names
  const { data: folders } = await supabase
    .from('drive_offer_folders')
    .select('id, offer_id, last_sync_at, offers(name)')

  if (!folders?.length) return { offers: [] }

  const todayStr = new Date().toISOString().split('T')[0]
  const summary = []

  for (const folder of folders) {
    const { data: creatives } = await supabase
      .from('drive_creatives')
      .select('creative_type, status, detected_at')
      .eq('offer_folder_id', folder.id)

    const todayVideos = (creatives || []).filter(c => c.creative_type === 'video' && c.detected_at?.startsWith(todayStr)).length
    const todayImages = (creatives || []).filter(c => c.creative_type === 'imagen' && c.detected_at?.startsWith(todayStr)).length
    const pendientes = (creatives || []).filter(c => c.status === 'subido').length

    summary.push({
      offer_id: folder.offer_id,
      offer_name: folder.offers?.name || '?',
      today_videos: todayVideos,
      today_images: todayImages,
      total_videos: (creatives || []).filter(c => c.creative_type === 'video').length,
      total_images: (creatives || []).filter(c => c.creative_type === 'imagen').length,
      pendientes,
    })
  }

  // Global totals
  const totalTodayVideos = summary.reduce((s, o) => s + o.today_videos, 0)
  const totalTodayImages = summary.reduce((s, o) => s + o.today_images, 0)

  return {
    offers: summary,
    today: { videos: totalTodayVideos, images: totalTodayImages },
    targets: { videos: 5, images: 10 },
  }
}

// ─── HANDLER ───
module.exports = async function handler(req, res) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const action = req.query?.action || 'status'

    // Actions that don't need Drive token
    if (action === 'link' && req.method === 'POST') {
      return res.json(await handleLink(supabase, req.body))
    }
    if (action === 'publish' && req.method === 'POST') {
      return res.json(await handlePublish(supabase, req.body))
    }
    if (action === 'status') {
      const offerId = req.query?.offer_id
      if (!offerId) return res.status(400).json({ error: 'offer_id required' })
      return res.json(await handleStatus(supabase, offerId))
    }
    if (action === 'dashboard-summary') {
      return res.json(await handleDashboardSummary(supabase))
    }

    // Actions that need Drive token
    const token = await getValidToken(supabase)
    if (!token) return res.status(401).json({ error: 'No Google account connected' })

    if (action === 'sync') {
      const offerId = req.query?.offer_id
      if (!offerId) return res.status(400).json({ error: 'offer_id required' })
      return res.json(await handleSync(supabase, token, offerId))
    }
    if (action === 'sync-all') {
      return res.json(await handleSyncAll(supabase, token))
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[drive-offer-sync] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
