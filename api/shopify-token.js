// api/shopify-token.js — Obtiene access_token directo via POST con client credentials
// GET /api/shopify-token?shop=las-recetas-de-ana.myshopify.com
// Flujo: POST https://{shop}/admin/oauth/access_token con client_id + client_secret
// Guarda el token en Supabase y registra webhook

const { createClient } = require('@supabase/supabase-js')

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

    // Intentar obtener access_token con client_credentials grant
    const tokenUrl = `https://${shop}/admin/oauth/access_token`

    // Intento 1: client_credentials grant type
    let tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    // Si falla, intento 2: sin grant_type (legacy)
    if (!tokenRes.ok) {
      const attempt1Body = await tokenRes.text()
      console.log('[shopify-token] Intento 1 (client_credentials) falló:', tokenRes.status, attempt1Body)

      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }).toString(),
      })
    }

    // Intento 3: form-urlencoded con grant_type
    if (!tokenRes.ok) {
      const attempt2Body = await tokenRes.text()
      console.log('[shopify-token] Intento 2 (form sin grant_type) falló:', tokenRes.status, attempt2Body)

      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'client_credentials',
        }).toString(),
      })
    }

    const responseText = await tokenRes.text()
    console.log('[shopify-token] Shopify response status:', tokenRes.status)
    console.log('[shopify-token] Shopify response body:', responseText)

    if (!tokenRes.ok) {
      return res.status(502).json({
        error: 'Shopify rechazó la solicitud de token',
        status: tokenRes.status,
        shopifyResponse: responseText,
      })
    }

    let tokenData
    try {
      tokenData = JSON.parse(responseText)
    } catch {
      return res.status(502).json({
        error: 'Respuesta de Shopify no es JSON válido',
        body: responseText,
      })
    }

    const { access_token, scope } = tokenData

    if (!access_token) {
      return res.status(502).json({
        error: 'Shopify no devolvió access_token',
        data: tokenData,
      })
    }

    console.log('[shopify-token] Token obtenido OK, scope:', scope)

    // Verificar que el token funciona
    const testRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    })

    if (!testRes.ok) {
      console.warn('[shopify-token] Token obtenido pero falla al consultar shop.json:', testRes.status)
    } else {
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
        scopes: scope || 'client_credentials',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    )

    if (dbError) {
      console.error('[shopify-token] DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token', details: dbError.message })
    }

    console.log('[shopify-token] Token guardado en Supabase para', shop)

    // Registrar webhook orders/paid
    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const WEBHOOK_URL = `${appUrl}/api/shopify-webhook`

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

    let webhookId = null
    if (webhookRes.ok) {
      const wData = await webhookRes.json()
      webhookId = wData.webhook?.id ?? null
      console.log('[shopify-token] Webhook registrado, id:', webhookId)
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: webhookId ? String(webhookId) : null })
        .eq('shop', shop)
    } else {
      const wErr = await webhookRes.text()
      console.warn('[shopify-token] Webhook registration failed:', wErr)
    }

    // Redirigir al panel
    const APP_URL = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    res.redirect(302, `${APP_URL}/integrations?shop=${shop}&connected=1`)
  } catch (err) {
    console.error('[shopify-token] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
