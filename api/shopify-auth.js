// api/shopify-auth.js — inicia OAuth para cada tienda Shopify
// GET /api/shopify-auth?shop=las-recetas-de-ana.myshopify.com

const SCOPES = 'read_orders,read_products'

module.exports = function handler(req, res) {
  try {
    const { shop } = req.query

    if (!shop) {
      return res.status(400).json({ error: 'Falta el parámetro shop' })
    }

    // Read env vars inside handler (not at module load time)
    // .trim() removes trailing newlines added by `echo | vercel env add`
    const APPS = {
      'las-recetas-de-ana.myshopify.com': {
        clientId: (process.env.SHOPIFY_CLIENT_ID_LASRECETAS || '').trim(),
      },
      'panaderia-con-ana-internacional.myshopify.com': {
        clientId: (process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK || '').trim(),
      },
    }

    const appConfig = APPS[shop]
    if (!appConfig || !appConfig.clientId) {
      return res.status(400).json({
        error: 'Tienda no configurada',
        shop,
        hasKey: !!appConfig,
      })
    }

    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const redirectUri = `${appUrl}/api/shopify/callback`

    // Use base64 (universally supported) instead of base64url
    const state = Buffer.from(JSON.stringify({ shop, ts: Date.now() }))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${appConfig.clientId}` +
      `&scope=${SCOPES}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`

    res.redirect(302, authUrl)
  } catch (err) {
    console.error('shopify-auth error:', err)
    res.status(500).json({ error: err.message })
  }
}
