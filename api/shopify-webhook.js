// api/shopify-webhook.js — recibe eventos de Shopify y los guarda en Supabase
// Verificación HMAC-SHA256 con el client secret de cada app
// bodyParser deshabilitado para poder verificar el HMAC con el raw body

const { createHmac, timingSafeEqual } = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const SHOP_SLUGS = {
  'las-recetas-de-ana.myshopify.com': 'lasrecetasdeana',
  'panaderia-con-ana-internacional.myshopify.com': 'instanthandbook',
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifyShopifyHmac(secret, rawBody, hmacHeader) {
  try {
    const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
    const a = Buffer.from(digest)
    const b = Buffer.from(hmacHeader)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const shop = req.headers['x-shopify-shop-domain']
  const hmacHeader = req.headers['x-shopify-hmac-sha256']
  const topic = req.headers['x-shopify-topic']

  if (!shop || !hmacHeader) {
    return res.status(401).json({ error: 'Faltan headers de Shopify' })
  }

  // Leer secrets dentro del handler (no en module load time)
  const SHOP_SECRETS = {
    'las-recetas-de-ana.myshopify.com': (process.env.SHOPIFY_CLIENT_SECRET_LASRECETAS || '').trim(),
    'panaderia-con-ana-internacional.myshopify.com': (process.env.SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK || '').trim(),
  }

  const secret = SHOP_SECRETS[shop]
  if (!secret) {
    // Responder 200 para no causar reintentos innecesarios
    return res.status(200).json({ ok: false, reason: 'shop desconocida' })
  }

  const rawBody = await getRawBody(req)

  if (!verifyShopifyHmac(secret, rawBody, hmacHeader)) {
    return res.status(401).json({ error: 'HMAC inválido' })
  }

  // Solo procesar órdenes pagadas
  if (topic !== 'orders/paid') {
    return res.status(200).json({ ok: true, skipped: topic })
  }

  const order = JSON.parse(rawBody.toString('utf8'))

  const amount = parseFloat(order.total_price || '0')
  if (amount <= 0) {
    return res.status(200).json({ ok: true, skipped: 'amount_zero' })
  }

  const currency = order.currency === 'ARS' ? 'ARS' : 'USD'
  const date = (order.processed_at || order.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0]
  const slug = SHOP_SLUGS[shop] || shop
  const items = (order.line_items || []).map(i => i.title).filter(Boolean).join(', ')
  const notes = `Shopify ${slug} — Orden #${order.order_number}${items ? ` — ${items}` : ''}`

  const supabase = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )

  const { error } = await supabase.rpc('insert_shopify_revenue', {
    p_amount: amount,
    p_currency: currency,
    p_revenue_date: date,
    p_notes: notes,
    p_external_id: String(order.id),
    p_shop: slug,
  })

  if (error) {
    console.error(`[shopify-webhook] Supabase error for order ${order.id}:`, error.message)
  }

  // Siempre responder 200 para evitar reintentos de Shopify
  return res.status(200).json({ ok: !error })
}

// IMPORTANTE: deshabilitar body parser de Vercel para obtener raw body y verificar HMAC
handler.config = { api: { bodyParser: false } }

module.exports = handler
