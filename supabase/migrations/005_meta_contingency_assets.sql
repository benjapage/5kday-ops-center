-- Meta contingency asset tables: ad accounts, BMs, profiles

CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'restricted', 'banned')),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_business_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bm_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'banned')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  profile_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'banned')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read meta_ad_accounts"
  ON meta_ad_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert meta_ad_accounts"
  ON meta_ad_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update meta_ad_accounts"
  ON meta_ad_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete meta_ad_accounts"
  ON meta_ad_accounts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read meta_business_managers"
  ON meta_business_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert meta_business_managers"
  ON meta_business_managers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update meta_business_managers"
  ON meta_business_managers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete meta_business_managers"
  ON meta_business_managers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read meta_profiles"
  ON meta_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert meta_profiles"
  ON meta_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update meta_profiles"
  ON meta_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete meta_profiles"
  ON meta_profiles FOR DELETE TO authenticated USING (true);
