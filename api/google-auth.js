// api/google-auth.js — Redirect to Google OAuth consent screen
// GET /api/google-auth

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

module.exports = function handler(req, res) {
  try {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const redirectUri = `${appUrl}/api/google-callback`

    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID no configurado' })
    }

    const state = Buffer.from(JSON.stringify({ ts: Date.now() }))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`

    console.log('[google-auth] Redirecting to Google OAuth')
    res.redirect(302, authUrl)
  } catch (err) {
    console.error('[google-auth] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
