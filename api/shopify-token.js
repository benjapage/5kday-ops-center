// api/shopify-token.js — Obtiene access_token directo via POST con client credentials
// GET /api/shopify-token?shop=las-recetas-de-ana.myshopify.com
// Flujo: POST https://{shop}/admin/oauth/access_token con client_id + client_secret
// Guarda el token en Supabase y registra webhook

const { createClient } = require('@supabase/supabase-js')

const SCOPES = 'read_orders,read_products,read_all_orders'

function normalizeShop(raw) {
  if (!raw) return ''
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/\/+$/, '')
  s = s.split('/')[0]
  return s
}

function getApps() {
  return {
    'las-recetas-de-ana.myshopify.com': {
      clientId: (process.env.SHOPIFY_CLIENT_ID_LASRECETAS || '').trim(),
      clientSecret: (process.env.SHOPIFY_CLIENT_SECRET_LASRECETAS || '').trim(),
      displayName: 'Las Recetas de Ana',
      customDomain: 'lasrecetasdeana.com',
      slug: 'lasrecetasdeana',
    },
    'panaderia-con-ana-internacional.myshopify.com': {
      clientId: (process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK || '').trim(),
      clientSecret: (process.env.SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK || '').trim(),
      displayName: 'Instant Handbook',
      customDomain: 'instanthandbook.com',
      slug: 'instanthandbook',
    },
  }
}

module.exports = async function handler(req, res) {
  try {
    const rawShop = req.query.shop
    const debug = req.query.debug === '1'

    if (!rawShop) {
      return res.status(400).json({ error: 'Falta el parámetro shop' })
    }

    const shop = normalizeShop(rawShop)
    const APPS = getApps()
    const cfg = APPS[shop]

    if (!cfg || !cfg.clientId || !cfg.clientSecret) {
      return res.status(400).json({
        error: 'Tienda no configurada o faltan credenciales',
        shop,
        configured: Object.keys(APPS),
      })
    }

    console.log('[shopify-token] Solicitando token para', shop)

    const tokenUrl = `https://${shop}/admin/oauth/access_token`
    const attempts = []

    // Intento 1: client_credentials con scope (JSON)
    let tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: 'client_credentials',
        scope: SCOPES,
      }),
    })
    let responseText = await tokenRes.text()
    attempts.push({ attempt: 1, desc: 'client_credentials+scope (JSON)', status: tokenRes.status, body: responseText.slice(0, 300) })

    // Intento 2: client_credentials sin scope (JSON)
    if (!tokenRes.ok || !responseText.includes('access_token')) {
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'client_credentials',
        }),
      })
      responseText = await tokenRes.text()
      attempts.push({ attempt: 2, desc: 'client_credentials sin scope (JSON)', status: tokenRes.status, body: responseText.slice(0, 300) })
    }

    // Intento 3: form-urlencoded con scope
    if (!tokenRes.ok || !responseText.includes('access_token')) {
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'client_credentials',
          scope: SCOPES,
        }).toString(),
      })
      responseText = await tokenRes.text()
      attempts.push({ attempt: 3, desc: 'client_credentials+scope (form)', status: tokenRes.status, body: responseText.slice(0, 300) })
    }

    // Intento 4: solo client_id + client_secret (legacy, sin grant_type)
    if (!tokenRes.ok || !responseText.includes('access_token')) {
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      })
      responseText = await tokenRes.text()
      attempts.push({ attempt: 4, desc: 'solo client_id+secret (JSON)', status: tokenRes.status, body: responseText.slice(0, 300) })
    }

    console.log('[shopify-token] Intentos:', JSON.stringify(attempts.map(a => ({ attempt: a.attempt, status: a.status }))))

    if (!tokenRes.ok || !responseText.includes('access_token')) {
      if (debug) {
        return res.status(502).json({ error: 'Ningún intento funcionó', attempts })
      }
      return res.status(502).json({
        error: 'Shopify rechazó la solicitud de token',
        status: tokenRes.status,
        hint: 'Agregá ?debug=1 para ver todos los intentos',
      })
    }

    let tokenData
    try {
      tokenData = JSON.parse(responseText)
    } catch {
      return res.status(502).json({ error: 'Respuesta no es JSON', body: responseText.slice(0, 500) })
    }

    const { access_token, scope } = tokenData

    if (!access_token) {
      return res.status(502).json({ error: 'Sin access_token', data: tokenData })
    }

    console.log('[shopify-token] Token OK, scope:', scope)

    // Verificar scopes reales del token
    let realScopes = []
    const scopesRes = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    })
    if (scopesRes.ok) {
      const scopesData = await scopesRes.json()
      realScopes = (scopesData.access_scopes || []).map(s => s.handle)
    }
    console.log('[shopify-token] Scopes reales del token:', realScopes)

    // Verificar que el token funciona
    const testRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    })
    if (testRes.ok) {
      const shopData = await testRes.json()
      console.log('[shopify-token] Token verificado, tienda:', shopData.shop?.name)
    }

    // Guardar en Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { error: dbError } = await supabase.from('shopify_stores').upsert(
      {
        shop,
        custom_domain: cfg.customDomain,
        display_name: cfg.displayName,
        slug: cfg.slug,
        access_token,
        scopes: realScopes.join(',') || scope || 'client_credentials',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    )

    if (dbError) {
      console.error('[shopify-token] DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token', details: dbError.message })
    }

    // Registrar webhook orders/paid
    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const WEBHOOK_URL = `${appUrl}/api/shopify-webhook`

    let webhookId = null
    let webhookError = null

    const webhookRes = await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': access_token,
      },
      body: JSON.stringify({
        webhook: { topic: 'orders/paid', address: WEBHOOK_URL, format: 'json' },
      }),
    })

    if (webhookRes.ok) {
      const wData = await webhookRes.json()
      webhookId = wData.webhook?.id ?? null
      console.log('[shopify-token] Webhook registrado, id:', webhookId)
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: webhookId ? String(webhookId) : null })
        .eq('shop', shop)
    } else {
      webhookError = await webhookRes.text()
      console.warn('[shopify-token] Webhook failed:', webhookError)
    }

    if (debug) {
      return res.status(200).json({
        ok: true,
        shop,
        tokenScopes: realScopes,
        webhookRegistered: !!webhookId,
        webhookId,
        webhookError: webhookError ? webhookError.slice(0, 500) : null,
        attempts: attempts.map(a => ({ attempt: a.attempt, desc: a.desc, status: a.status })),
      })
    }

    const APP_URL = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    res.redirect(302, `${APP_URL}/integrations?shop=${shop}&connected=1`)
  } catch (err) {
    console.error('[shopify-token] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
