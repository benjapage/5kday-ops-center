-- ============================================================
-- 004 — Subscriptions (recurring expenses)
-- ============================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  category      text NOT NULL CHECK (category IN (
                  'ad_spend','platform_fees','tools_software',
                  'team_salaries','creative_production','other'
                )),
  billing_day   integer NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated USING (true);

-- Admin and tech can insert
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','tech')
    )
  );

-- Admin and tech can update
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','tech')
    )
  );

-- Only admin can delete
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. FUNCTION — process active subscriptions into expenses
CREATE OR REPLACE FUNCTION public.process_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub           record;
  today         date := CURRENT_DATE;
  cur_year      integer := EXTRACT(YEAR FROM today);
  cur_month     integer := EXTRACT(MONTH FROM today);
  cur_day       integer := EXTRACT(DAY FROM today);
  last_day      integer;
  exp_day       integer;
  exp_date      date;
  marker        text;
  created_count integer := 0;
BEGIN
  -- Last day of the current month
  last_day := EXTRACT(DAY FROM
    (date_trunc('month', today) + INTERVAL '1 month' - INTERVAL '1 day')
  );

  FOR sub IN
    SELECT * FROM public.subscriptions WHERE is_active = true
  LOOP
    -- Only process if billing_day <= today's day-of-month
    IF sub.billing_day <= cur_day THEN
      -- Cap billing_day at the last day of the month (e.g. 31 -> 28 in Feb)
      exp_day  := LEAST(sub.billing_day, last_day);
      exp_date := make_date(cur_year, cur_month, exp_day);
      marker   := 'Suscripcion: ' || sub.name || ' — ' || cur_month || '/' || cur_year;

      -- Only insert if no expense with this marker exists this month
      IF NOT EXISTS (
        SELECT 1 FROM public.expenses
        WHERE description = marker
          AND expense_date BETWEEN date_trunc('month', today)::date
                                AND (date_trunc('month', today) + INTERVAL '1 month' - INTERVAL '1 day')::date
      ) THEN
        INSERT INTO public.expenses (amount, currency, category, description, expense_date)
        VALUES (sub.amount, sub.currency, sub.category, marker, exp_date);

        created_count := created_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN created_count;
END;
$$;
