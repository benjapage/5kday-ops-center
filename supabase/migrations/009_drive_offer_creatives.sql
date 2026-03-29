-- ============================================================
-- 009: Drive Offer Folders + Drive Creatives
-- Per-offer Google Drive folder linking and creative detection
-- Structure: Oferta/ → Anuncios/ → Anuncios Video/ + Anuncios Imagen/
--            Each has Testeo 1/, Testeo 2/, Testeo 3/ subfolders
-- ============================================================

-- Link between an offer and its Drive folder
CREATE TABLE IF NOT EXISTS public.drive_offer_folders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id          uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  drive_folder_id   text NOT NULL,
  drive_folder_name text,
  last_sync_at      timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_drive_offer_folders_offer ON public.drive_offer_folders (offer_id);
CREATE INDEX idx_drive_offer_folders_drive ON public.drive_offer_folders (drive_folder_id);

ALTER TABLE public.drive_offer_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_offer_folders_select" ON public.drive_offer_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_offer_folders_write" ON public.drive_offer_folders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Individual creative files detected in Drive
CREATE TABLE IF NOT EXISTS public.drive_creatives (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_folder_id     uuid NOT NULL REFERENCES public.drive_offer_folders(id) ON DELETE CASCADE,
  creative_type       text NOT NULL CHECK (creative_type IN ('video', 'imagen')),
  testeo_folder_name  text NOT NULL,
  testeo_number       integer,
  file_name           text NOT NULL,
  file_type           text,
  drive_file_id       text UNIQUE NOT NULL,
  status              text NOT NULL DEFAULT 'subido' CHECK (status IN ('subido', 'publicado')),
  published_at        timestamptz,
  uploaded_by         text,  -- janne | facu | benjamin
  detected_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_drive_creatives_folder ON public.drive_creatives (offer_folder_id);
CREATE INDEX idx_drive_creatives_type ON public.drive_creatives (creative_type);
CREATE INDEX idx_drive_creatives_status ON public.drive_creatives (status);
CREATE INDEX idx_drive_creatives_detected ON public.drive_creatives (detected_at DESC);

ALTER TABLE public.drive_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_creatives_select" ON public.drive_creatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_creatives_write" ON public.drive_creatives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Add drive_folder_url column to offers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'drive_folder_url'
  ) THEN
    ALTER TABLE public.offers ADD COLUMN drive_folder_url text;
  END IF;
END $$;
