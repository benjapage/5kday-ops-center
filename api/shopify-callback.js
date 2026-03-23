// api/shopify-callback.js — maneja callback OAuth de Shopify
// Intercambia el code por access_token, lo guarda en Supabase y registra webhook

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const { shop, code } = req.query

    if (!shop || !code) {
      return res.status(400).json({ error: 'Faltan parámetros' })
    }

    // Read env vars inside handler (not at module load time)
    const APPS = {
      'las-recetas-de-ana.myshopify.com': {
        clientId: process.env.SHOPIFY_CLIENT_ID_LASRECETAS,
        clientSecret: process.env.SHOPIFY_CLIENT_SECRET_LASRECETAS,
        displayName: 'Las Recetas de Ana',
        customDomain: 'lasrecetasdeana.com',
        slug: 'lasrecetasdeana',
      },
      'panaderia-con-ana-internacional.myshopify.com': {
        clientId: process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK,
        clientSecret: process.env.SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK,
        displayName: 'Instant Handbook',
        customDomain: 'instanthandbook.com',
        slug: 'instanthandbook',
      },
    }

    const APP_URL = process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app'
    const WEBHOOK_URL = `${APP_URL}/api/shopify-webhook`

    const appConfig = APPS[shop]
    if (!appConfig) {
      return res.status(400).json({ error: 'Tienda desconocida', shop })
    }

    // 1. Intercambiar code por access_token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
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
      console.error('Token exchange failed:', tokenRes.status, body)
      return res.status(500).json({ error: 'No se pudo obtener el access token' })
    }

    const { access_token, scope } = await tokenRes.json()

    // 2. Guardar en Supabase
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

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
      console.error('DB error:', dbError.message)
      return res.status(500).json({ error: 'Error guardando token' })
    }

    // 3. Registrar webhook orders/paid
    const webhookRes = await fetch(
      `https://${shop}/admin/api/2024-10/webhooks.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': access_token,
        },
        body: JSON.stringify({
          webhook: {
            topic: 'orders/paid',
            address: WEBHOOK_URL,
            format: 'json',
          },
        }),
      }
    )

    let webhookId = null
    if (webhookRes.ok) {
      const wData = await webhookRes.json()
      webhookId = wData.webhook?.id ?? null
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: webhookId ? String(webhookId) : null })
        .eq('shop', shop)
    } else {
      console.warn('Webhook registration failed:', await webhookRes.text())
    }

    // 4. Redirigir al panel de integraciones
    res.redirect(302, `${APP_URL}/integrations?shop=${shop}&connected=1`)
  } catch (err) {
    console.error('shopify-callback error:', err)
    res.status(500).json({ error: err.message })
  }
}
