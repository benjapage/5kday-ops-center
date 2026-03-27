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

-- 5. Make profile_id not required on meta_profiles (allow name-only creation)
-- The UNIQUE constraint on profile_id prevents empty strings, so we need to allow NULL
ALTER TABLE meta_profiles ALTER COLUMN profile_id DROP NOT NULL;
-- Drop the unique constraint and recreate it to allow NULLs
ALTER TABLE meta_profiles DROP CONSTRAINT IF EXISTS meta_profiles_profile_id_key;
-- Re-add unique but only for non-null non-empty values
CREATE UNIQUE INDEX IF NOT EXISTS meta_profiles_profile_id_unique
  ON meta_profiles (profile_id)
  WHERE profile_id IS NOT NULL AND profile_id != '';
