-- ============================================================
-- 010: Editors & Editor Payments
-- Weekly payment tracking for video editors (Janne, Facu)
-- Fixed: $2.50/video | Variable: $5.00/winning ad (>$100 spend)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.editors (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  rate_per_video_cents    integer NOT NULL DEFAULT 250,    -- $2.50
  rate_per_winner_cents   integer NOT NULL DEFAULT 500,    -- $5.00
  winner_threshold_cents  integer NOT NULL DEFAULT 10000,  -- $100 de spend
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz DEFAULT now()
);

INSERT INTO public.editors (name) VALUES ('Janne'), ('Facu');

ALTER TABLE public.editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editors_select" ON public.editors FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors_write" ON public.editors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

CREATE TABLE IF NOT EXISTS public.editor_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id         uuid NOT NULL REFERENCES public.editors(id) ON DELETE CASCADE,
  week_start        date NOT NULL,
  week_end          date NOT NULL,
  videos_count      integer NOT NULL DEFAULT 0,
  fixed_pay_cents   integer NOT NULL DEFAULT 0,
  winners           jsonb NOT NULL DEFAULT '[]',
  winners_count     integer NOT NULL DEFAULT 0,
  variable_pay_cents integer NOT NULL DEFAULT 0,
  total_pay_cents   integer NOT NULL DEFAULT 0,
  paid              boolean NOT NULL DEFAULT false,
  paid_at           timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(editor_id, week_start)
);

CREATE INDEX idx_editor_payments_week ON public.editor_payments (week_start);
CREATE INDEX idx_editor_payments_editor ON public.editor_payments (editor_id);

ALTER TABLE public.editor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editor_payments_select" ON public.editor_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "editor_payments_write" ON public.editor_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));
