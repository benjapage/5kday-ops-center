// api/shopify-auth.js — inicia OAuth para cada tienda Shopify
// GET /api/shopify-auth?shop=las-recetas-de-ana.myshopify.com

const SCOPES = 'read_orders,read_products'

// Normalize shop domain: trim, lowercase, ensure .myshopify.com
function normalizeShop(raw) {
  if (!raw) return ''
  let s = raw.trim().toLowerCase()
  // Remove protocol if present
  s = s.replace(/^https?:\/\//, '')
  // Remove trailing slash
  s = s.replace(/\/+$/, '')
  // Remove /admin or other paths
  s = s.split('/')[0]
  return s
}

// Map of all configured shops
function getApps() {
  return {
    'las-recetas-de-ana.myshopify.com': {
      clientId: (process.env.SHOPIFY_CLIENT_ID_LASRECETAS || '').trim(),
    },
    'panaderia-con-ana-internacional.myshopify.com': {
      clientId: (process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK || '').trim(),
    },
  }
}

module.exports = function handler(req, res) {
  try {
    const rawShop = req.query.shop
    if (!rawShop) {
      return res.status(400).json({ error: 'Falta el parámetro shop' })
    }

    const shop = normalizeShop(rawShop)
    console.log('[shopify-auth] shop normalizado:', shop, '(raw:', rawShop, ')')

    const APPS = getApps()
    const appConfig = APPS[shop]

    if (!appConfig || !appConfig.clientId) {
      console.error('[shopify-auth] Tienda no configurada:', shop, 'Keys disponibles:', Object.keys(APPS))
      return res.status(400).json({
        error: 'Tienda no configurada',
        shop,
        configured: Object.keys(APPS),
      })
    }

    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const redirectUri = `${appUrl}/api/shopify/callback`

    // base64url-safe state
    const state = Buffer.from(JSON.stringify({ shop, ts: Date.now() }))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const authUrl =
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${appConfig.clientId}` +
      `&scope=${SCOPES}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`

    console.log('[shopify-auth] Redirigiendo a:', authUrl)
    res.redirect(302, authUrl)
  } catch (err) {
    console.error('[shopify-auth] error:', err)
    res.status(500).json({ error: err.message })
  }
}
