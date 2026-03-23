// api/shopify-fix-webhook.js — Verifica y re-registra webhook para una tienda
// GET /api/shopify-fix-webhook?shop=panaderia-con-ana-internacional.myshopify.com

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  try {
    const shop = (req.query.shop || '').trim().toLowerCase()
    if (!shop) {
      return res.status(400).json({ error: 'Falta el parámetro shop' })
    }

    // Leer token de Supabase
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: store, error: dbErr } = await supabase
      .from('shopify_stores')
      .select('access_token, webhook_id, slug')
      .eq('shop', shop)
      .single()

    if (dbErr || !store) {
      return res.status(404).json({ error: 'Tienda no encontrada en DB', shop })
    }

    const token = store.access_token

    // 1. Listar webhooks existentes
    const listRes = await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    })

    let existingWebhooks = []
    if (listRes.ok) {
      const listData = await listRes.json()
      existingWebhooks = listData.webhooks || []
    } else {
      const errBody = await listRes.text()
      return res.status(502).json({
        error: 'No se pudo listar webhooks — token inválido o sin permisos',
        status: listRes.status,
        details: errBody,
      })
    }

    const appUrl = (process.env.VITE_APP_URL || 'https://5kday-ops-center.vercel.app').trim()
    const WEBHOOK_URL = `${appUrl}/api/shopify-webhook`

    // Buscar si ya existe un webhook de orders/paid apuntando a nosotros
    const existing = existingWebhooks.find(
      w => w.topic === 'orders/paid' && w.address === WEBHOOK_URL
    )

    if (existing) {
      // Ya existe, actualizar DB
      await supabase
        .from('shopify_stores')
        .update({ webhook_id: String(existing.id) })
        .eq('shop', shop)

      return res.status(200).json({
        ok: true,
        action: 'already_exists',
        webhookId: existing.id,
        address: existing.address,
        allWebhooks: existingWebhooks.map(w => ({ id: w.id, topic: w.topic, address: w.address })),
      })
    }

    // Verificar scopes del token consultando access_scopes
    let scopes = []
    const scopesRes = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    })
    if (scopesRes.ok) {
      const scopesData = await scopesRes.json()
      scopes = (scopesData.access_scopes || []).map(s => s.handle)
    }

    // 2. Registrar nuevo webhook
    console.log('[shopify-fix-webhook] Registrando webhook para', shop, 'en', WEBHOOK_URL, 'scopes:', scopes)
    const createRes = await fetch(`https://${shop}/admin/api/2024-10/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        webhook: { topic: 'orders/paid', address: WEBHOOK_URL, format: 'json' },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      return res.status(502).json({
        error: 'No se pudo registrar webhook',
        status: createRes.status,
        details: errBody,
        tokenScopes: scopes,
        existingWebhooks: existingWebhooks.map(w => ({ id: w.id, topic: w.topic, address: w.address })),
      })
    }

    const wData = await createRes.json()
    const webhookId = wData.webhook?.id
    console.log('[shopify-fix-webhook] Webhook creado:', webhookId)

    await supabase
      .from('shopify_stores')
      .update({ webhook_id: webhookId ? String(webhookId) : null })
      .eq('shop', shop)

    return res.status(200).json({
      ok: true,
      action: 'created',
      webhookId,
      address: WEBHOOK_URL,
    })
  } catch (err) {
    console.error('[shopify-fix-webhook] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
