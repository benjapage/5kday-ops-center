// api/shopify/callback.js — /api/shopify/callback
// Intercambia el code por access_token, guarda en Supabase y registra webhook

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const { shop, code, state } = req.query

    if (!shop || !code) {
      return res.status(400).json({ error: 'Faltan parámetros', query: req.query })
    }

    const APPS = {
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

    const APP_URL = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()

    const appConfig = APPS[shop]
    if (!appConfig) {
      return res.status(400).json({ error: 'Tienda desconocida', shop })
    }

    if (!appConfig.clientId || !appConfig.clientSecret) {
      console.error('[shopify/callback] Credenciales faltantes para', shop)
      return res.status(500).json({ error: 'Credenciales de app no configuradas' })
    }

    // 1. Intercambiar code por access_token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`
    console.log('[shopify/callback] Exchanging code for token:', tokenUrl)

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appConfig.clientId,
        client_secret: appConfig.clientSecret,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('[shopify/callback] Token exchange failed:', tokenRes.status, body)
      return res.status(502).json({
        error: 'No se pudo obtener el access token',
        status: tokenRes.status,
        details: body,
      })
    }

    const tokenData = await tokenRes.json()
    const { access_token, scope } = tokenData

    if (!access_token) {
      console.error('[shopify/callback] No access_token in response:', tokenData)
      return res.status(502).json({ error: 'Respuesta de Shopify sin access_token', data: tokenData })
    }

    console.log('[shopify/callback] Token OK, scope:', scope)

    // 2. Guardar en Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!serviceKey) {
      console.error('[shopify/callback] SUPABASE_SERVICE_ROLE_KEY no configurada')
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { error: dbError } = await supabase.from('shopify_stores').upsert(
      {
        shop,
        custom_domain: appConfig.customDomain,
        display_name: appConfig.displayName,
        slug: appConfig.slug,
        access_token,
        scopes: scope,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    )

    if (dbError) {
      console.error('[shopify/callback] DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token', details: dbError.message })
    }

    console.log('[shopify/callback] Token guardado en Supabase para', shop)

    // 3. Registrar webhook orders/paid
    // Apunta al handler en /api/shopify-webhook (archivo flat, no subdirectorio)
    const WEBHOOK_URL = `${APP_URL}/api/shopify-webhook`
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
      const webhookId = wData.webhook?.id ?? null
      console.log('[shopify/callback] Webhook registrado, id:', webhookId)
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: webhookId ? String(webhookId) : null })
        .eq('shop', shop)
    } else {
      const wErr = await webhookRes.text()
      console.warn('[shopify/callback] Webhook registration failed:', wErr)
      // No es fatal — el token ya está guardado
    }

    // 4. Redirigir al panel de integraciones
    res.redirect(302, `${APP_URL}/integrations?shop=${shop}&connected=1`)
  } catch (err) {
    console.error('[shopify/callback] Uncaught error:', err)
    res.status(500).json({ error: err.message })
  }
}
