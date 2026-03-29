-- ============================================================
-- 008: App Tasks — Google Calendar bidirectional integration
-- Tasks created in-app sync to Google Calendar and vice-versa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  scheduled_date    date NOT NULL,
  scheduled_time    time,
  duration_minutes  integer DEFAULT 30,
  source            text NOT NULL DEFAULT 'manual',
  completed         boolean DEFAULT false,
  completed_at      timestamptz,
  is_urgent         boolean DEFAULT false,
  related_offer_id  uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  related_number_id uuid REFERENCES public.wa_accounts(id) ON DELETE SET NULL,
  google_event_id   text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_app_tasks_date ON public.app_tasks (scheduled_date);
CREATE INDEX idx_app_tasks_source ON public.app_tasks (source);
CREATE INDEX idx_app_tasks_google_event ON public.app_tasks (google_event_id) WHERE google_event_id IS NOT NULL;

ALTER TABLE public.app_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_tasks_select" ON public.app_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_tasks_insert" ON public.app_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "app_tasks_update" ON public.app_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "app_tasks_delete" ON public.app_tasks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));
