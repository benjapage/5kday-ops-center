// api/shopify-import.js — Importa historial de órdenes de Shopify (últimos N días)
// GET /api/shopify-import?days=30
// Usa las credenciales de cada tienda directamente del .env (client_credentials flow)

const { createClient } = require('@supabase/supabase-js')

const SHOPS = [
  {
    shop: 'las-recetas-de-ana.myshopify.com',
    slug: 'lasrecetasdeana',
    envToken: 'SHOPIFY_TOKEN_LASRECETAS',
    envClientId: 'SHOPIFY_CLIENT_ID_LASRECETAS',
    envClientSecret: 'SHOPIFY_CLIENT_SECRET_LASRECETAS',
  },
  {
    shop: 'panaderia-con-ana-internacional.myshopify.com',
    slug: 'instanthandbook',
    envToken: 'SHOPIFY_TOKEN_INSTANTHANDBOOK',
    envClientId: 'SHOPIFY_CLIENT_ID_INSTANTHANDBOOK',
    envClientSecret: 'SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK',
  },
]

async function getAccessToken(cfg) {
  // 1. Try env token first (if manually set)
  const envToken = (process.env[cfg.envToken] || '').trim()
  if (envToken) return envToken

  // 2. Try Supabase shopify_stores table
  const supabase = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )
  const { data } = await supabase
    .from('shopify_stores')
    .select('access_token')
    .eq('shop', cfg.shop)
    .eq('is_active', true)
    .single()

  if (data?.access_token) return data.access_token

  // 3. Try client_credentials flow
  const clientId = (process.env[cfg.envClientId] || '').trim()
  const clientSecret = (process.env[cfg.envClientSecret] || '').trim()
  if (!clientId || !clientSecret) return null

  const tokenUrl = `https://${cfg.shop}/admin/oauth/access_token`
  const attempts = [
    { body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }), ct: 'application/json' },
    { body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, ct: 'application/x-www-form-urlencoded' },
  ]

  for (const attempt of attempts) {
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': attempt.ct },
        body: attempt.body,
      })
      if (res.ok) {
        const json = await res.json()
        if (json.access_token) return json.access_token
      }
    } catch {}
  }

  return null
}

async function fetchOrders(shop, token, sinceDate) {
  const allOrders = []
  const apiVersion = '2024-10'
  let url = `https://${shop}/admin/api/${apiVersion}/orders.json?status=any&limit=250&created_at_min=${sinceDate}T00:00:00Z&fields=id,order_number,created_at,processed_at,total_price,currency,financial_status,line_items`

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Shopify API ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const orders = data.orders || []
    allOrders.push(...orders)

    // Pagination via Link header
    const linkHeader = res.headers.get('link') || ''
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    url = nextMatch ? nextMatch[1] : null
  }

  return allOrders
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const days = parseInt(req.query?.days || '30', 10)
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  const supabase = createClient(
    (process.env.VITE_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )

  const results = { shops: [], totalSynced: 0, totalSkipped: 0, totalErrors: 0 }

  for (const cfg of SHOPS) {
    const shopResult = { shop: cfg.slug, synced: 0, skipped: 0, errors: [], orderCount: 0 }

    try {
      const token = await getAccessToken(cfg)
      if (!token) {
        shopResult.errors.push('No se pudo obtener access token')
        results.shops.push(shopResult)
        continue
      }

      const orders = await fetchOrders(cfg.shop, token, sinceDate)
      shopResult.orderCount = orders.length

      for (const order of orders) {
        // Only import paid/partially_paid orders
        if (!['paid', 'partially_paid'].includes(order.financial_status)) {
          shopResult.skipped++
          continue
        }

        const amount = parseFloat(order.total_price || '0')
        if (amount <= 0) {
          shopResult.skipped++
          continue
        }

        const currency = order.currency === 'ARS' ? 'ARS' : 'USD'
        const date = (order.processed_at || order.created_at || '').split('T')[0]
          || new Date().toISOString().split('T')[0]
        const items = (order.line_items || []).map(i => i.title).filter(Boolean).join(', ')
        const notes = `Shopify ${cfg.slug} — Orden #${order.order_number}${items ? ` — ${items}` : ''}`

        const { data, error } = await supabase.rpc('insert_shopify_revenue', {
          p_amount: amount,
          p_currency: currency,
          p_revenue_date: date,
          p_notes: notes,
          p_external_id: String(order.id),
          p_shop: cfg.slug,
        })

        if (error) {
          shopResult.errors.push(`Orden #${order.order_number}: ${error.message}`)
        } else if (data?.skipped) {
          shopResult.skipped++
        } else {
          shopResult.synced++
        }
      }
    } catch (err) {
      shopResult.errors.push(err.message || 'Error desconocido')
    }

    results.totalSynced += shopResult.synced
    results.totalSkipped += shopResult.skipped
    results.totalErrors += shopResult.errors.length
    results.shops.push(shopResult)
  }

  return res.status(200).json(results)
}

module.exports = handler
