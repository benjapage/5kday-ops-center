// api/shopify-debug.js — diagnostic endpoint for Shopify OAuth config
// GET /api/shopify-debug — shows configuration status (no secrets exposed)

module.exports = function handler(req, res) {
  const appUrl = (process.env.VITE_APP_URL || '').trim()
  const redirectUri = `${appUrl}/api/shopify/callback`

  const stores = {
    'las-recetas-de-ana.myshopify.com': {
      label: 'Las Recetas de Ana',
      hasClientId: !!(process.env.SHOPIFY_CLIENT_ID_LASRECETAS || '').trim(),
      hasClientSecret: !!(process.env.SHOPIFY_CLIENT_SECRET_LASRECETAS || '').trim(),
      clientIdPrefix: (process.env.SHOPIFY_CLIENT_ID_LASRECETAS || '').trim().slice(0, 6) + '...',
    },
    'panaderia-con-ana-internacional.myshopify.com': {
      label: 'Instant Handbook',
      hasClientId: !!(process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK || '').trim(),
      hasClientSecret: !!(process.env.SHOPIFY_CLIENT_SECRET_INSTANTHANDBOOK || '').trim(),
      clientIdPrefix: (process.env.SHOPIFY_CLIENT_ID_INSTANTHANDBOOK || '').trim().slice(0, 6) + '...',
    },
  }

  const config = {
    appUrl,
    redirectUri,
    webhookUrl: `${appUrl}/api/shopify-webhook`,
    hasSupabaseUrl: !!(process.env.VITE_SUPABASE_URL || '').trim(),
    hasServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    stores,
    instructions: {
      step1: 'En Shopify Partners > Apps > [tu app] > App setup:',
      step2: `App URL debe ser: ${appUrl}`,
      step3: `Allowed redirection URL(s) debe incluir: ${redirectUri}`,
      step4: 'Si la app fue creada en el admin de la tienda (Settings > Apps > Develop apps), NO usa OAuth — usa el Access Token directo (shpat_...)',
    },
  }

  res.status(200).json(config)
}
