-- ============================================================
-- 5Kday OPS CENTER — Schema completo
-- Ejecutar en Supabase SQL Editor en el orden indicado
-- ============================================================

-- ============================================================
-- 1. PROFILES (extiende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','tech','editor')),
  avatar_url  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'editor')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 2. OFFERS (debe ir antes de wa_accounts, expenses, revenue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  country       text NOT NULL,
  channel       text NOT NULL CHECK (channel IN ('whatsapp','shopify','both')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  target_roas   numeric(6,2),
  target_cpl    numeric(10,2),
  target_cpa    numeric(10,2),
  current_roas  numeric(6,2),
  current_cpl   numeric(10,2),
  start_date    date NOT NULL,
  end_date      date,
  notes         text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_select" ON public.offers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "offers_insert" ON public.offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "offers_update" ON public.offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "offers_delete" ON public.offers
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 3. WA_ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number   text NOT NULL UNIQUE,
  country        text NOT NULL,
  status         text NOT NULL DEFAULT 'warming' CHECK (status IN ('warming','active','banned')),
  start_date     date NOT NULL,
  bm_id          text,
  bm_link_url    text,
  manychat_name  text,
  manychat_url   text,
  notes          text,
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Computed column via function (Supabase/PG no soporta GENERATED con funciones no deterministas)
-- La validación de 7 días se hace en la app + en un check function
CREATE OR REPLACE FUNCTION public.wa_ready_date(start_date date)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT start_date + INTERVAL '7 days';
$$;

ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_select" ON public.wa_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "wa_insert" ON public.wa_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "wa_update" ON public.wa_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "wa_delete" ON public.wa_accounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 4. EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  category      text NOT NULL CHECK (category IN (
                  'ad_spend','platform_fees','tools_software',
                  'team_salaries','creative_production','other'
                )),
  description   text,
  expense_date  date NOT NULL,
  offer_id      uuid REFERENCES public.offers(id),
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (created_by = auth.uid() AND created_at > now() - INTERVAL '24 hours')
  );

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 5. REVENUE_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  channel       text NOT NULL CHECK (channel IN ('whatsapp','shopify','other')),
  revenue_date  date NOT NULL,
  offer_id      uuid REFERENCES public.offers(id),
  notes         text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_select" ON public.revenue_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "revenue_insert" ON public.revenue_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "revenue_update" ON public.revenue_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "revenue_delete" ON public.revenue_entries
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- 6. CREATIVES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creatives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  offer_id    uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  asset_url   text,
  asset_type  text CHECK (asset_type IN ('image','video','copy','other')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creatives_select" ON public.creatives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "creatives_insert" ON public.creatives
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "creatives_update" ON public.creatives
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );

CREATE POLICY "creatives_delete" ON public.creatives
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech'))
  );


-- ============================================================
-- 7. TEAM_CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_checklists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  assigned_role  text CHECK (assigned_role IN ('admin','tech','editor','all')),
  is_recurring   boolean DEFAULT false,
  recurrence     text CHECK (recurrence IN ('daily','weekly','monthly')),
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.team_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklists_select" ON public.team_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklists_insert" ON public.team_checklists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));
CREATE POLICY "checklists_update" ON public.team_checklists FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));
CREATE POLICY "checklists_delete" ON public.team_checklists FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================
-- 8. CHECKLIST_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  uuid NOT NULL REFERENCES public.team_checklists(id) ON DELETE CASCADE,
  label         text NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_insert" ON public.checklist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));
CREATE POLICY "items_update" ON public.checklist_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));
CREATE POLICY "items_delete" ON public.checklist_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));


-- ============================================================
-- 9. CHECKLIST_COMPLETIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  completed_by  uuid NOT NULL REFERENCES public.profiles(id),
  completed_at  timestamptz DEFAULT now()
);

ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "completions_select" ON public.checklist_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "completions_insert" ON public.checklist_completions FOR INSERT TO authenticated
  WITH CHECK (completed_by = auth.uid());
CREATE POLICY "completions_delete" ON public.checklist_completions FOR DELETE TO authenticated
  USING (completed_by = auth.uid());


-- ============================================================
-- 10. DRIVE_LINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drive_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  url         text NOT NULL,
  category    text,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.drive_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_select" ON public.drive_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_insert" ON public.drive_links FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "drive_update" ON public.drive_links FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));
CREATE POLICY "drive_delete" ON public.drive_links FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','tech')));


-- ============================================================
-- 11. ACTIVITY_LOG (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id),
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_insert" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- No UPDATE ni DELETE policies → log inmutable


-- ============================================================
-- 12. SETTINGS (objetivos mensuales, config general)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id          text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES public.profiles(id),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_upsert" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "settings_update" ON public.settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Valor inicial
INSERT INTO public.settings (id, value) VALUES
  ('monthly_targets', '{}')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 13. VISTA daily_pnl
-- ============================================================
CREATE OR REPLACE VIEW public.daily_pnl AS
SELECT
  d.day                                                    AS date,
  COALESCE(SUM(r.amount), 0)                               AS total_revenue,
  COALESCE(SUM(e.amount), 0)                               AS total_expenses,
  COALESCE(SUM(r.amount), 0) - COALESCE(SUM(e.amount), 0) AS profit,
  COALESCE(SUM(CASE WHEN e.category = 'ad_spend' THEN e.amount ELSE 0 END), 0) AS ad_spend
FROM (
  SELECT DISTINCT revenue_date AS day FROM public.revenue_entries
  UNION
  SELECT DISTINCT expense_date AS day FROM public.expenses
) d
LEFT JOIN public.revenue_entries r ON r.revenue_date = d.day
LEFT JOIN public.expenses e ON e.expense_date = d.day
GROUP BY d.day
ORDER BY d.day DESC;
