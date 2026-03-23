// api/google-callback.js — Exchange Google OAuth code for tokens, save to Supabase
// GET /api/google-callback?code=...&state=...

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const { code, error: oauthError } = req.query
    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()

    if (oauthError) {
      console.error('[google-callback] OAuth error:', oauthError)
      return res.redirect(302, `${appUrl}/integrations?google_error=${encodeURIComponent(oauthError)}`)
    }

    if (!code) {
      return res.status(400).json({ error: 'Falta el código de autorización' })
    }

    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
    const redirectUri = `${appUrl}/api/google-callback`

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Credenciales de Google no configuradas' })
    }

    // Exchange code for tokens
    console.log('[google-callback] Exchanging code for tokens')
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('[google-callback] Token exchange failed:', tokenRes.status, errBody)
      return res.status(502).json({ error: 'Token exchange failed', details: errBody })
    }

    const tokenData = await tokenRes.json()
    const { access_token, refresh_token, expires_in, scope } = tokenData

    if (!access_token || !refresh_token) {
      console.error('[google-callback] Missing tokens:', JSON.stringify(tokenData))
      return res.status(502).json({ error: 'Google no devolvió tokens completos' })
    }

    // Get user email
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userData = await userRes.json()
    const email = userData.email || 'unknown'

    console.log('[google-callback] Token OK for', email, 'scope:', scope)

    // Save to Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString()

    const { error: dbError } = await supabase.from('google_tokens').upsert(
      {
        email,
        access_token,
        refresh_token,
        token_expiry: tokenExpiry,
        scopes: scope,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )

    if (dbError) {
      console.error('[google-callback] DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token', details: dbError.message })
    }

    console.log('[google-callback] Token saved for', email)
    res.redirect(302, `${appUrl}/integrations?google_connected=1&email=${encodeURIComponent(email)}`)
  } catch (err) {
    console.error('[google-callback] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
