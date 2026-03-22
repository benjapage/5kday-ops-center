// api/shopify-auth.js — inicia OAuth para cada tienda Shopify
// GET /api/shopify-auth?shop=las-recetas-de-ana.myshopify.com

const APPS = {
  'las-recetas-de-ana.myshopify.com': {
    clientId: process.env.SHOPIFY_CLIENT_ID_LASRECETAS,
  },
  'panaderia-con-ana-internacional.myshopify.com': {
    clientId: process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK,
  },
}

const SCOPES = 'read_orders,read_products'

module.exports = function handler(req, res) {
  const { shop } = req.query

  if (!shop) {
    return res.status(400).json({ error: 'Falta el parámetro shop' })
  }

  const appConfig = APPS[shop]
  if (!appConfig || !appConfig.clientId) {
    return res.status(400).json({ error: 'Tienda no configurada' })
  }

  const redirectUri = `${process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app'}/api/shopify-callback`
  const state = Buffer.from(JSON.stringify({ shop, ts: Date.now() })).toString('base64url')

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${appConfig.clientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`

  res.redirect(302, authUrl)
}
