-- Add scheduling support to drive_creatives
ALTER TABLE public.drive_creatives ADD COLUMN IF NOT EXISTS scheduled_at date;

-- Expand status to include 'programado'
ALTER TABLE public.drive_creatives DROP CONSTRAINT IF EXISTS drive_creatives_status_check;
ALTER TABLE public.drive_creatives ADD CONSTRAINT drive_creatives_status_check
  CHECK (status IN ('subido', 'programado', 'publicado'));
