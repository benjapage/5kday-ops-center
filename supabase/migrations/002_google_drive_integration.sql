-- ============================================================
-- 002: Google Drive Integration
-- Tokens OAuth, archivos sincronizados de Drive
-- ============================================================

-- Tokens OAuth de Google (uno por cuenta conectada)
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  token_expiry    timestamptz NOT NULL,
  scopes          text,
  is_active       boolean NOT NULL DEFAULT true,
  connected_at    timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "google_tokens_select" ON public.google_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "google_tokens_admin" ON public.google_tokens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Archivos detectados en Drive (creativos + ofertas)
CREATE TABLE IF NOT EXISTS public.drive_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         text NOT NULL UNIQUE,
  file_name       text NOT NULL,
  mime_type       text,
  folder_id       text NOT NULL,
  folder_type     text NOT NULL CHECK (folder_type IN ('anuncios', 'ofertas')),
  web_view_link   text,
  -- Parsed from nomenclature (creativos)
  ad_number       integer,
  test_number     integer,
  editor          text,
  offer_name      text,
  -- Parsed from nomenclature (ofertas)
  file_type       text CHECK (file_type IN ('avatar', 'brief', 'copy', 'landing', 'resultado', 'creative', 'other')),
  offer_folder    text,
  -- Metadata
  created_time    timestamptz,
  modified_time   timestamptz,
  detected_at     timestamptz DEFAULT now(),
  processed       boolean DEFAULT false
);

CREATE INDEX idx_drive_files_folder ON public.drive_files (folder_type);
CREATE INDEX idx_drive_files_detected ON public.drive_files (detected_at DESC);

ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_files_select" ON public.drive_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_files_admin" ON public.drive_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'tech')));

-- Function para insertar/actualizar archivos de Drive (llamada desde API serverless)
CREATE OR REPLACE FUNCTION public.upsert_drive_file(
  p_file_id text,
  p_file_name text,
  p_mime_type text,
  p_folder_id text,
  p_folder_type text,
  p_web_view_link text,
  p_ad_number integer DEFAULT NULL,
  p_test_number integer DEFAULT NULL,
  p_editor text DEFAULT NULL,
  p_offer_name text DEFAULT NULL,
  p_file_type text DEFAULT NULL,
  p_offer_folder text DEFAULT NULL,
  p_created_time timestamptz DEFAULT NULL,
  p_modified_time timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.drive_files (
    file_id, file_name, mime_type, folder_id, folder_type, web_view_link,
    ad_number, test_number, editor, offer_name, file_type, offer_folder,
    created_time, modified_time
  ) VALUES (
    p_file_id, p_file_name, p_mime_type, p_folder_id, p_folder_type, p_web_view_link,
    p_ad_number, p_test_number, p_editor, p_offer_name, p_file_type, p_offer_folder,
    p_created_time, p_modified_time
  )
  ON CONFLICT (file_id) DO UPDATE SET
    file_name = EXCLUDED.file_name,
    mime_type = EXCLUDED.mime_type,
    web_view_link = EXCLUDED.web_view_link,
    ad_number = EXCLUDED.ad_number,
    test_number = EXCLUDED.test_number,
    editor = EXCLUDED.editor,
    offer_name = EXCLUDED.offer_name,
    file_type = EXCLUDED.file_type,
    offer_folder = EXCLUDED.offer_folder,
    modified_time = EXCLUDED.modified_time;
END;
$$;
