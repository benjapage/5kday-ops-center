-- UTMify integration tables
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/sql

-- Configuration table
CREATE TABLE IF NOT EXISTS utmify_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mcp_url TEXT NOT NULL,
  dashboard_id TEXT NOT NULL DEFAULT '69a78ca2501d38fceac48178',
  timezone INTEGER DEFAULT -3,
  currency TEXT DEFAULT 'USD',
  auto_sync BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial config
INSERT INTO utmify_config (mcp_url, dashboard_id) VALUES (
  'https://mcp.utmify.com.br/mcp/?token=FpTxQLafNzmbDyBktMlYiCO6h3ehha6GkkGNjN7dpCbmRT5EwuuF0rjdbZeranIa',
  '69a78ca2501d38fceac48178'
);

-- Synced data table
CREATE TABLE IF NOT EXISTS utmify_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  ad_account_id TEXT,
  ad_account_name TEXT,
  level TEXT DEFAULT 'campaign',
  revenue_cents INTEGER DEFAULT 0,
  spend_cents INTEGER DEFAULT 0,
  profit_cents INTEGER DEFAULT 0,
  roas DECIMAL(10,4),
  profit_margin DECIMAL(10,4),
  approved_orders INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  cpa_cents INTEGER,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(10,6),
  landing_page_views INTEGER DEFAULT 0,
  initiate_checkout INTEGER DEFAULT 0,
  conversations INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  hook_rate DECIMAL(10,6),
  retention_rate DECIMAL(10,6),
  status TEXT,
  daily_budget_cents INTEGER,
  untracked_count INTEGER DEFAULT 0,
  products JSONB DEFAULT '[]',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_utmify_sync_date ON utmify_sync(date);
CREATE INDEX IF NOT EXISTS idx_utmify_sync_campaign ON utmify_sync(campaign_id);
CREATE INDEX IF NOT EXISTS idx_utmify_sync_date_range ON utmify_sync(date DESC);

-- RLS
ALTER TABLE utmify_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE utmify_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read utmify_config"
  ON utmify_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update utmify_config"
  ON utmify_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert utmify_config"
  ON utmify_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read utmify_sync"
  ON utmify_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert utmify_sync"
  ON utmify_sync FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update utmify_sync"
  ON utmify_sync FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete utmify_sync"
  ON utmify_sync FOR DELETE TO authenticated USING (true);
