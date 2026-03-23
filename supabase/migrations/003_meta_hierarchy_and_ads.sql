-- ============================================================
-- 003: Meta Hierarchy (Perfil → BM → Número) + Ads Stats
-- ============================================================

-- Perfiles de Meta (Facebook profiles)
CREATE TABLE IF NOT EXISTS public.meta_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  profile_type text NOT NULL DEFAULT 'new' CHECK (profile_type IN ('new', 'established')),
  bm_limit    integer NOT NULL DEFAULT 2,
  notes       text,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.meta_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_profiles_select" ON public.meta_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "meta_profiles_write" ON public.meta_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Business Managers
CREATE TABLE IF NOT EXISTS public.business_managers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_profile_id uuid NOT NULL REFERENCES public.meta_profiles(id) ON DELETE CASCADE,
  bm_id           text NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'disabled')),
  notes           text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.business_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_select" ON public.business_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "bm_write" ON public.business_managers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Add hierarchy columns to wa_accounts
ALTER TABLE public.wa_accounts ADD COLUMN IF NOT EXISTS bm_manager_id uuid REFERENCES public.business_managers(id) ON DELETE SET NULL;
ALTER TABLE public.wa_accounts ADD COLUMN IF NOT EXISTS manychat_url text;

-- Update status check to include new states
ALTER TABLE public.wa_accounts DROP CONSTRAINT IF EXISTS wa_accounts_status_check;
ALTER TABLE public.wa_accounts ADD CONSTRAINT wa_accounts_status_check
  CHECK (status IN ('cold', 'warming', 'ready', 'banned'));

-- Update existing records: 'active' → 'ready'
UPDATE public.wa_accounts SET status = 'ready' WHERE status = 'active';

-- Meta Ad Stats (daily per ad account)
CREATE TABLE IF NOT EXISTS public.meta_ad_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      text NOT NULL,
  account_name    text,
  stat_date       date NOT NULL,
  spend           numeric(12,2) NOT NULL DEFAULT 0,
  impressions     bigint NOT NULL DEFAULT 0,
  clicks          bigint NOT NULL DEFAULT 0,
  purchases       integer NOT NULL DEFAULT 0,
  purchase_value  numeric(12,2) NOT NULL DEFAULT 0,
  cpc             numeric(10,4),
  cpm             numeric(10,4),
  ctr             numeric(8,4),
  cost_per_purchase numeric(12,2),
  currency        text DEFAULT 'USD',
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (account_id, stat_date)
);

ALTER TABLE public.meta_ad_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_stats_select" ON public.meta_ad_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "meta_stats_write" ON public.meta_ad_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Meta Campaign Stats (daily per campaign)
CREATE TABLE IF NOT EXISTS public.meta_campaign_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     text NOT NULL,
  campaign_name   text,
  account_id      text NOT NULL,
  stat_date       date NOT NULL,
  spend           numeric(12,2) NOT NULL DEFAULT 0,
  impressions     bigint NOT NULL DEFAULT 0,
  clicks          bigint NOT NULL DEFAULT 0,
  purchases       integer NOT NULL DEFAULT 0,
  purchase_value  numeric(12,2) NOT NULL DEFAULT 0,
  cpc             numeric(10,4),
  cost_per_purchase numeric(12,2),
  status          text,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (campaign_id, stat_date)
);

ALTER TABLE public.meta_campaign_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_stats_select" ON public.meta_campaign_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_stats_write" ON public.meta_campaign_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Meta Adset Stats (daily per adset)
CREATE TABLE IF NOT EXISTS public.meta_adset_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id        text NOT NULL,
  adset_name      text,
  campaign_id     text NOT NULL,
  account_id      text NOT NULL,
  stat_date       date NOT NULL,
  spend           numeric(12,2) NOT NULL DEFAULT 0,
  impressions     bigint NOT NULL DEFAULT 0,
  clicks          bigint NOT NULL DEFAULT 0,
  purchases       integer NOT NULL DEFAULT 0,
  purchase_value  numeric(12,2) NOT NULL DEFAULT 0,
  cpc             numeric(10,4),
  cost_per_purchase numeric(12,2),
  status          text,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (adset_id, stat_date)
);

ALTER TABLE public.meta_adset_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adset_stats_select" ON public.meta_adset_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "adset_stats_write" ON public.meta_adset_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Ban detection log
CREATE TABLE IF NOT EXISTS public.meta_ban_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id uuid REFERENCES public.wa_accounts(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  source      text NOT NULL CHECK (source IN ('webhook', 'polling', 'manual')),
  quality_score text,
  details     jsonb,
  detected_at timestamptz DEFAULT now()
);

ALTER TABLE public.meta_ban_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ban_events_select" ON public.meta_ban_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ban_events_write" ON public.meta_ban_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));
