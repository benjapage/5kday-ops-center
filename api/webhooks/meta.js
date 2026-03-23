// api/webhooks/meta.js — Meta webhook for phone_number_quality_update
// POST /api/webhooks/meta — receives webhook events from Meta
// GET /api/webhooks/meta — webhook verification (hub.challenge)

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  // GET = webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    // Use META_WEBHOOK_VERIFY_TOKEN or fallback
    const verifyToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || '5kday-meta-verify').trim()

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[meta-webhook] Verification OK')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Verification failed' })
  }

  // POST = webhook event
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body
    console.log('[meta-webhook] Received event:', JSON.stringify(body).slice(0, 500))

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!serviceKey) {
      return res.status(200).json({ ok: true, note: 'no service key' })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    // Process entries
    const entries = body?.entry || []
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        // phone_number_quality_update
        if (change.field === 'phone_number_quality_update' || change.field === 'message_template_status_update') {
          const value = change.value || {}
          const phoneNumber = value.display_phone_number || value.phone_number || ''
          const quality = value.current_limit || value.event || ''

          console.log('[meta-webhook] Quality update for', phoneNumber, ':', quality)

          // Check if this is a ban/restriction
          const isBan = quality === 'FLAGGED' || quality === 'RESTRICTED' ||
            quality === 'RATE_LIMITED' || quality === 'BLOCKED' ||
            (value.event && value.event.includes('DISABLED'))

          if (isBan && phoneNumber) {
            // Find the WA account
            const { data: account } = await supabase
              .from('wa_accounts')
              .select('id, phone_number, status')
              .ilike('phone_number', `%${phoneNumber.replace(/\D/g, '').slice(-10)}%`)
              .limit(1)
              .single()

            if (account && account.status !== 'banned') {
              // Mark as banned
              await supabase
                .from('wa_accounts')
                .update({ status: 'banned', updated_at: new Date().toISOString() })
                .eq('id', account.id)

              console.log('[meta-webhook] Banned:', account.phone_number)
            }

            // Log the event
            await supabase.from('meta_ban_events').insert({
              wa_account_id: account?.id || null,
              phone_number: phoneNumber,
              source: 'webhook',
              quality_score: quality,
              details: value,
            })
          }
        }
      }
    }

    // Always return 200 to Meta
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[meta-webhook] Error:', err)
    return res.status(200).json({ ok: true, error: err.message })
  }
}
