// api/run-migration-006.js — One-time migration to add asset linkage columns
// DELETE THIS FILE after running successfully
// GET /api/run-migration-006

module.exports = async function handler(req, res) {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

  if (!dbUrl) {
    // Fallback: use Supabase Management API
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.VITE_SUPABASE_URL

    if (!serviceKey) {
      return res.status(500).json({
        error: 'No database connection available. Set SUPABASE_DB_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.',
        help: 'Or run the SQL manually in Supabase SQL Editor: https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/sql',
        sql: [
          'ALTER TABLE meta_profiles ADD COLUMN IF NOT EXISTS profile_function text;',
          'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS bm_function text;',
          'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS channel_type text;',
          'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS bm_id text;',
          'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS profile_id text;',
          'ALTER TABLE meta_profiles ALTER COLUMN profile_id DROP NOT NULL;',
        ]
      })
    }

    // Use service role to create an exec_sql function then call it
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    })

    // With service role we can use the SQL endpoint via REST
    const sqlStatements = [
      'ALTER TABLE meta_profiles ADD COLUMN IF NOT EXISTS profile_function text',
      'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS bm_function text',
      'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS channel_type text',
      'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS bm_id text',
      'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS profile_id text',
      'ALTER TABLE meta_profiles ALTER COLUMN profile_id DROP NOT NULL',
    ]

    // Execute via Supabase REST SQL endpoint
    const results = []
    for (const sql of sqlStatements) {
      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        })

        // Alternative: try the pg_net approach or just verify columns exist
        // The REST API can't run DDL, but we can check if columns already exist
        results.push({ sql: sql.slice(0, 60), attempted: true })
      } catch (e) {
        results.push({ sql: sql.slice(0, 60), error: e.message })
      }
    }

    // Verify by trying to select the new columns
    const { data: profileCheck, error: profileErr } = await supabase
      .from('meta_profiles')
      .select('id, profile_function')
      .limit(1)

    const { data: bmCheck, error: bmErr } = await supabase
      .from('meta_business_managers')
      .select('id, bm_function, profile_id')
      .limit(1)

    const { data: adCheck, error: adErr } = await supabase
      .from('meta_ad_accounts')
      .select('id, channel_type, bm_id')
      .limit(1)

    return res.json({
      message: 'Migration 006 verification',
      columns: {
        meta_profiles: profileErr ? { error: profileErr.message } : 'profile_function OK',
        meta_business_managers: bmErr ? { error: bmErr.message } : 'bm_function + profile_id OK',
        meta_ad_accounts: adErr ? { error: adErr.message } : 'channel_type + bm_id OK',
      },
      help: profileErr || bmErr || adErr
        ? 'Some columns are missing. Run the migration SQL in Supabase SQL Editor.'
        : 'All columns exist! Migration already applied or not needed.',
    })
  }

  // Direct DB connection
  try {
    const { Client } = require('pg')
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()

    const sqls = [
      'ALTER TABLE meta_profiles ADD COLUMN IF NOT EXISTS profile_function text',
      'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS bm_function text',
      'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS channel_type text',
      'ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS bm_id text',
      'ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS profile_id text',
      'ALTER TABLE meta_profiles ALTER COLUMN profile_id DROP NOT NULL',
    ]

    const results = []
    for (const sql of sqls) {
      try {
        await client.query(sql)
        results.push({ sql: sql.slice(0, 60), status: 'ok' })
      } catch (e) {
        results.push({ sql: sql.slice(0, 60), status: 'error', error: e.message })
      }
    }

    await client.end()
    return res.json({ message: 'Migration 006 completed', results })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
