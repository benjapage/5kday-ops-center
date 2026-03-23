// api/shopify-manual-setup.js — Configuración manual de token Shopify
// POST /api/shopify-manual-setup
// Body: { shop, accessToken, slug }
// Para Custom Apps creadas en el admin de la tienda (Settings > Apps > Develop apps)

const { createClient } = require('@supabase/supabase-js')

const STORE_CONFIG = {
  'las-recetas-de-ana.myshopify.com': {
    displayName: 'Las Recetas de Ana',
    customDomain: 'lasrecetasdeana.com',
    slug: 'lasrecetasdeana',
    secretEnv: 'SHOPIFY_CLIENT_SECRET_LASRECETAS',
  },
  'panaderia-con-ana-internacional.myshopify.com': {
    displayName: 'Instant Handbook',
    customDomain: 'instanthandbook.com',
    slug: 'instanthandbook',
    secretEnv: 'SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK',
  },
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { shop, accessToken } = req.body || {}

    if (!shop || !accessToken) {
      return res.status(400).json({ error: 'Faltan shop y/o accessToken' })
    }

    const shopNorm = shop.trim().toLowerCase()
    const cfg = STORE_CONFIG[shopNorm]
    if (!cfg) {
      return res.status(400).json({
        error: 'Tienda no configurada',
        shop: shopNorm,
        configured: Object.keys(STORE_CONFIG),
      })
    }

    // Validate token works by calling Shopify API
    console.log('[shopify-manual-setup] Validando token para', shopNorm)
    const testRes = await fetch(`https://${shopNorm}/admin/api/2024-10/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken.trim() },
    })

    if (!testRes.ok) {
      const body = await testRes.text()
      console.error('[shopify-manual-setup] Token inválido:', testRes.status, body)
      return res.status(400).json({
        error: 'Token inválido — no se pudo conectar a la tienda',
        status: testRes.status,
      })
    }

    const shopData = await testRes.json()
    console.log('[shopify-manual-setup] Token válido, tienda:', shopData.shop?.name)

    // Save to Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { error: dbError } = await supabase.from('shopify_stores').upsert(
      {
        shop: shopNorm,
        custom_domain: cfg.customDomain,
        display_name: cfg.displayName,
        slug: cfg.slug,
        access_token: accessToken.trim(),
        scopes: 'read_orders,read_products',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    )

    if (dbError) {
      console.error('[shopify-manual-setup] DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token', details: dbError.message })
    }

    console.log('[shopify-manual-setup] Token guardado para', shopNorm)

    // Register webhook
    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const WEBHOOK_URL = `${appUrl}/api/shopify-webhook`
    console.log('[shopify-manual-setup] Registrando webhook:', WEBHOOK_URL)

    const webhookRes = await fetch(`https://${shopNorm}/admin/api/2024-10/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken.trim(),
      },
      body: JSON.stringify({
        webhook: { topic: 'orders/paid', address: WEBHOOK_URL, format: 'json' },
      }),
    })

    let webhookId = null
    if (webhookRes.ok) {
      const wData = await webhookRes.json()
      webhookId = wData.webhook?.id ?? null
      console.log('[shopify-manual-setup] Webhook registrado, id:', webhookId)
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: webhookId ? String(webhookId) : null })
        .eq('shop', shopNorm)
    } else {
      const wErr = await webhookRes.text()
      console.warn('[shopify-manual-setup] Webhook registration failed:', wErr)
    }

    return res.status(200).json({
      ok: true,
      shop: shopNorm,
      displayName: cfg.displayName,
      webhookRegistered: !!webhookId,
      shopName: shopData.shop?.name,
    })
  } catch (err) {
    console.error('[shopify-manual-setup] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
