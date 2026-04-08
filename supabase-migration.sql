-- ═══════════════════════════════════════════════════════
-- 5KDay Ops Center — Supabase Migration
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. UTMIFY CONFIG — Limpiar y reinsertar con 4 dashboards
-- ─────────────────────────────────────────────────────────

-- Agregar columnas si no existen
ALTER TABLE utmify_config ADD COLUMN IF NOT EXISTS dashboard_name TEXT;
ALTER TABLE utmify_config ADD COLUMN IF NOT EXISTS dashboard_type TEXT;

-- Limpiar config anterior
DELETE FROM utmify_config;

-- Insertar los 4 dashboards con nuevo token
INSERT INTO utmify_config (mcp_url, dashboard_id, dashboard_name, dashboard_type) VALUES
('https://mcp.utmify.com.br/mcp/?token=9Jti4mOMa0ocfxDtEG7FmwG4ujN3U0hK&resources=gs,gm,gu,gwe,ga,gp,gwa,gr,gcs', '69a78ca2501d38fceac48178', 'TESTEOS - CP 3-4-5', 'testeos'),
('https://mcp.utmify.com.br/mcp/?token=9Jti4mOMa0ocfxDtEG7FmwG4ujN3U0hK&resources=gs,gm,gu,gwe,ga,gp,gwa,gr,gcs', '69caa2d1fc27d69a9dd2e687', 'CONDI ARG CP 2', 'condimentos'),
('https://mcp.utmify.com.br/mcp/?token=9Jti4mOMa0ocfxDtEG7FmwG4ujN3U0hK&resources=gs,gm,gu,gwe,ga,gp,gwa,gr,gcs', '69caa763a4a3b9ab12036d90', 'Whatsapp', 'whatsapp'),
('https://mcp.utmify.com.br/mcp/?token=9Jti4mOMa0ocfxDtEG7FmwG4ujN3U0hK&resources=gs,gm,gu,gwe,ga,gp,gwa,gr,gcs', '69ce6ad52439d544849f0f94', 'Libro digital testeos', 'libro_digital');

-- 2. UTMIFY SYNC — Agregar campos dashboard_type y dashboard_id
-- ─────────────────────────────────────────────────────────────

ALTER TABLE utmify_sync ADD COLUMN IF NOT EXISTS dashboard_type TEXT;
ALTER TABLE utmify_sync ADD COLUMN IF NOT EXISTS dashboard_id TEXT;

-- 3. WA ACTIVITY MONITOR — Crear si no existe
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wa_activity_monitor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  contacts_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone_number, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_wa_activity_phone ON wa_activity_monitor(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_activity_date ON wa_activity_monitor(date);

-- 4. DRIVE OFFER FOLDERS — Crear si no existe
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drive_offer_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES offers(id),
  drive_folder_id TEXT NOT NULL,
  drive_folder_name TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DRIVE CREATIVES — Crear si no existe
-- ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS drive_creatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_folder_id UUID REFERENCES drive_offer_folders(id),
  creative_type TEXT NOT NULL,
  testeo_folder_name TEXT NOT NULL,
  testeo_number INTEGER,
  file_name TEXT NOT NULL,
  file_type TEXT,
  drive_file_id TEXT UNIQUE,
  status TEXT DEFAULT 'subido',
  published_at TIMESTAMPTZ,
  uploaded_by TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WA SALES — Crear si no existe
-- ────────────────────────────────

CREATE TABLE IF NOT EXISTS wa_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL,
  product_name TEXT,
  amount_cents INTEGER NOT NULL,
  buyer_phone TEXT,
  buyer_name TEXT,
  status TEXT DEFAULT 'pagado',
  wa_account_phone TEXT,
  campaign TEXT,
  sheet_row_number INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sale_date, buyer_phone, amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_wa_sales_date ON wa_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_wa_sales_account ON wa_sales(wa_account_phone);

-- 7. SHEETS WA CONFIG — Crear si no existe
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sheets_wa_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  sales_sheet_name TEXT DEFAULT 'Ventas WA',
  contacts_sheet_name TEXT DEFAULT 'Contactos WA',
  last_sync_at TIMESTAMPTZ,
  auto_sync BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NUMERO BANEADO CONFIRMADO — Insertar si no existe
-- ────────────────────────────────────────────────────

-- Solo ejecutar si el numero +12543483697 no esta ya en wa_accounts
INSERT INTO wa_accounts (phone_number, country, status, start_date, notes)
SELECT '+12543483697', 'US', 'banned', '2026-03-29', 'BM Panaderia de la infancia — baneado 29/3/2026'
WHERE NOT EXISTS (
  SELECT 1 FROM wa_accounts WHERE phone_number = '+12543483697'
);

-- 9. SETTINGS — Actualizar targets por defecto
-- ─────────────────────────────────────────────

INSERT INTO settings (id, value, updated_at)
VALUES ('monthly_targets', '{"daily_profit": 5000, "monthly_revenue": 60000, "daily_videos": 5, "daily_images": 15, "default_max_cpa": 15, "default_min_roas": 1.5}', NOW())
ON CONFLICT (id) DO UPDATE SET
  value = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(settings.value::jsonb, '{}'::jsonb),
          '{monthly_revenue}', '60000'
        ),
        '{daily_videos}', '5'
      ),
      '{daily_images}', '15'
    ),
    '{default_max_cpa}', '15'
  ),
  updated_at = NOW();
