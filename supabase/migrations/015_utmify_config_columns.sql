-- Add dashboard_name and dashboard_type columns to utmify_config
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/sql
-- NOTE: These columns are optional — dashboard names/types are currently hardcoded in api/utmify.js

ALTER TABLE utmify_config ADD COLUMN IF NOT EXISTS dashboard_name TEXT;
ALTER TABLE utmify_config ADD COLUMN IF NOT EXISTS dashboard_type TEXT;
