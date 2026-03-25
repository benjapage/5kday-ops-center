// api/google-drive-sync.js — Sync Google Drive folders, parse nomenclature, save to Supabase
// GET /api/google-drive-sync — scans Anuncios + OFERTAS folders

const { createClient } = require('@supabase/supabase-js')

const FOLDERS = {
  anuncios: '1kzAMGHHRaujVOlXLrkfu85TE3PPlj7U0',
  ofertas: '1MBat5Z4eT4sPjoLIbOmypA73BYHvfik0',
}

// Parse creative nomenclature: AD3.TT4.FACU.LibroDigital
function parseCreative(name) {
  // Remove extension
  const base = name.replace(/\.[^.]+$/, '')
  const match = base.match(/^AD(\d+)\.TT(\d+)\.([^.]+)\.(.+)$/i)
  if (!match) return null
  return {
    ad_number: parseInt(match[1]),
    test_number: parseInt(match[2]),
    editor: match[3],
    offer_name: match[4],
  }
}

// Parse offer file: AVATAR.LibroDigital, BRIEF.LibroDigital, etc.
function parseOfferFile(name) {
  const base = name.replace(/\.[^.]+$/, '')
  const match = base.match(/^(AVATAR|BRIEF|COPY|LANDING|RESULTADO)\.(.+)$/i)
  if (!match) return null
  return {
    file_type: match[1].toLowerCase(),
    offer_name: match[2],
  }
}

// Parse offer folder: OFERTA.NombreOferta.20260315
function parseOfferFolder(name) {
  const match = name.match(/^OFERTA\.([^.]+)\.?(\d+)?$/i)
  if (!match) return null
  return { offer_name: match[1], date: match[2] || null }
}

// Refresh access token if expired
async function getValidToken(supabase) {
  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !tokenRow) {
    return { error: 'No hay cuenta de Google conectada' }
  }

  // Check if token is expired (with 5min buffer)
  const expiry = new Date(tokenRow.token_expiry)
  if (expiry.getTime() - Date.now() > 5 * 60 * 1000) {
    return { token: tokenRow.access_token, email: tokenRow.email }
  }

  // Refresh token
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!refreshRes.ok) {
    const errBody = await refreshRes.text()
    console.error('[google-drive-sync] Token refresh failed:', errBody)
    return { error: 'Token refresh failed: ' + errBody }
  }

  const refreshData = await refreshRes.json()
  const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

  await supabase
    .from('google_tokens')
    .update({
      access_token: refreshData.access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('email', tokenRow.email)

  return { token: refreshData.access_token, email: tokenRow.email }
}

// List files in a Drive folder
async function listFiles(token, folderId) {
  const files = []
  let pageToken = null

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime)',
      pageSize: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Drive API error: ${res.status} ${err}`)
    }

    const data = await res.json()
    files.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return files
}

module.exports = async function handler(req, res) {
  try {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Get valid token
    const { token, email, error: tokenError } = await getValidToken(supabase)
    if (tokenError) {
      return res.status(401).json({ error: tokenError })
    }

    console.log('[google-drive-sync] Syncing as', email)

    const results = { anuncios: [], ofertas: [], errors: [] }

    // 1. Sync ANUNCIOS folder (flat files)
    try {
      const anunciosFiles = await listFiles(token, FOLDERS.anuncios)
      console.log('[google-drive-sync] Anuncios:', anunciosFiles.length, 'files')

      for (const file of anunciosFiles) {
        // Skip folders
        if (file.mimeType === 'application/vnd.google-apps.folder') continue

        const parsed = parseCreative(file.name)

        await supabase.rpc('upsert_drive_file', {
          p_file_id: file.id,
          p_file_name: file.name,
          p_mime_type: file.mimeType,
          p_folder_id: FOLDERS.anuncios,
          p_folder_type: 'anuncios',
          p_web_view_link: file.webViewLink || null,
          p_ad_number: parsed?.ad_number || null,
          p_test_number: parsed?.test_number || null,
          p_editor: parsed?.editor || null,
          p_offer_name: parsed?.offer_name || null,
          p_file_type: 'creative',
          p_offer_folder: null,
          p_created_time: file.createdTime || null,
          p_modified_time: file.modifiedTime || null,
        })

        results.anuncios.push({
          name: file.name,
          parsed: parsed || 'no_match',
        })
      }
    } catch (err) {
      console.error('[google-drive-sync] Error syncing Anuncios:', err.message)
      results.errors.push({ folder: 'anuncios', error: err.message })
    }

    // 2. Sync OFERTAS folder (subfolders with files + root-level files)
    try {
      // First list all items in ofertas root
      const allItems = await listFiles(token, FOLDERS.ofertas)
      const folders = allItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
      const rootFiles = allItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')

      console.log('[google-drive-sync] Ofertas subfolders:', folders.length, 'root files:', rootFiles.length)

      // 2a. Process root-level files (files uploaded directly to OFERTAS folder)
      for (const file of rootFiles) {
        const parsed = parseOfferFile(file.name)
        // Try to extract offer name from filename even without TYPE prefix
        const baseName = file.name.replace(/\.[^.]+$/, '')
        const offerName = parsed?.offer_name || baseName

        await supabase.rpc('upsert_drive_file', {
          p_file_id: file.id,
          p_file_name: file.name,
          p_mime_type: file.mimeType,
          p_folder_id: FOLDERS.ofertas,
          p_folder_type: 'ofertas',
          p_web_view_link: file.webViewLink || null,
          p_ad_number: null,
          p_test_number: null,
          p_editor: null,
          p_offer_name: offerName,
          p_file_type: parsed?.file_type || 'other',
          p_offer_folder: null,
          p_created_time: file.createdTime || null,
          p_modified_time: file.modifiedTime || null,
        })

        results.ofertas.push({
          folder: '(root)',
          name: file.name,
          parsed: parsed || { offer_name: offerName, file_type: 'other' },
        })
      }

      // 2b. Process subfolders (existing behavior)
      for (const folder of folders) {
        const parsedFolder = parseOfferFolder(folder.name)
        const offerFolderName = parsedFolder?.offer_name || folder.name

        // List files inside each subfolder
        const offerFiles = await listFiles(token, folder.id)

        for (const file of offerFiles) {
          if (file.mimeType === 'application/vnd.google-apps.folder') continue

          const parsed = parseOfferFile(file.name)

          await supabase.rpc('upsert_drive_file', {
            p_file_id: file.id,
            p_file_name: file.name,
            p_mime_type: file.mimeType,
            p_folder_id: folder.id,
            p_folder_type: 'ofertas',
            p_web_view_link: file.webViewLink || null,
            p_ad_number: null,
            p_test_number: null,
            p_editor: null,
            p_offer_name: parsed?.offer_name || offerFolderName,
            p_file_type: parsed?.file_type || 'other',
            p_offer_folder: folder.name,
            p_created_time: file.createdTime || null,
            p_modified_time: file.modifiedTime || null,
          })

          results.ofertas.push({
            folder: folder.name,
            name: file.name,
            parsed: parsed || 'no_match',
          })
        }
      }
    } catch (err) {
      console.error('[google-drive-sync] Error syncing Ofertas:', err.message)
      results.errors.push({ folder: 'ofertas', error: err.message })
    }

    return res.status(200).json({
      ok: true,
      email,
      synced: {
        anuncios: results.anuncios.length,
        ofertas: results.ofertas.length,
      },
      errors: results.errors,
      files: results,
    })
  } catch (err) {
    console.error('[google-drive-sync] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
