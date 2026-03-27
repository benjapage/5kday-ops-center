-- Corrección 22: Add function/type fields and relationship columns for asset linkage
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/sql

-- 1. Add profile_function to meta_profiles (bug fix — column was missing)
ALTER TABLE meta_profiles ADD COLUMN IF NOT EXISTS profile_function text;

-- 2. Add bm_function to meta_business_managers
ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS bm_function text;

-- 3. Add channel_type and bm_id to meta_ad_accounts (link CP → BM)
ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS channel_type text;
ALTER TABLE meta_ad_accounts ADD COLUMN IF NOT EXISTS bm_id text;

-- 4. Add profile_id to meta_business_managers (link BM → Profile)
ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS profile_id text;

-- Note: meta_profiles uses 'id' (uuid) as PK, not 'profile_id'.
-- profile_id is stored as a text field for the Meta profile ID reference.
