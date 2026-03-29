-- ============================================================
-- 011: Google Sheets WA Integration — Sales tracking + Ban detection
-- ManyChat writes to Sheets, app reads for revenue + activity monitoring
-- ============================================================

-- Config: which spreadsheet to read
CREATE TABLE IF NOT EXISTS public.sheets_wa_config (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id        TEXT NOT NULL,
  sales_sheet_name      TEXT DEFAULT 'Ventas WA',
  contacts_sheet_name   TEXT DEFAULT 'Contactos WA',
  last_sync_at          TIMESTAMPTZ,
  auto_sync             BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 15,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sheets_wa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sheets_config_select" ON public.sheets_wa_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "sheets_config_write" ON public.sheets_wa_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- WA Sales (revenue from WhatsApp via ManyChat → Sheets)
CREATE TABLE IF NOT EXISTS public.wa_sales (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date         DATE NOT NULL,
  product_name      TEXT,
  amount_cents      INTEGER NOT NULL,
  buyer_phone       TEXT,
  buyer_name        TEXT,
  status            TEXT DEFAULT 'pagado',
  wa_account_phone  TEXT,
  campaign          TEXT,
  sheet_row_number  INTEGER,
  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sale_date, buyer_phone, amount_cents)
);

CREATE INDEX idx_wa_sales_date ON public.wa_sales(sale_date);
CREATE INDEX idx_wa_sales_account ON public.wa_sales(wa_account_phone);

ALTER TABLE public.wa_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_sales_select" ON public.wa_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_sales_write" ON public.wa_sales FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Activity monitor: hourly activity per WA number (for ban detection)
CREATE TABLE IF NOT EXISTS public.wa_activity_monitor (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number    TEXT NOT NULL,
  date            DATE NOT NULL,
  hour            INTEGER NOT NULL,
  contacts_count  INTEGER DEFAULT 0,
  sales_count     INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone_number, date, hour)
);

CREATE INDEX idx_wa_activity_phone ON public.wa_activity_monitor(phone_number);
CREATE INDEX idx_wa_activity_date ON public.wa_activity_monitor(date);

ALTER TABLE public.wa_activity_monitor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_activity_select" ON public.wa_activity_monitor FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_activity_write" ON public.wa_activity_monitor FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));
