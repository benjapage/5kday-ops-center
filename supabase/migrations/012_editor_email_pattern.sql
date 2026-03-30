-- Add email_pattern to editors for matching Drive file owners to editors
-- Comma-separated keywords to match against file owner email/displayName
-- e.g. "fcndmosqueda,facundo" for editor "Facu"
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS email_pattern text DEFAULT '';

-- Set initial patterns for known editors
UPDATE public.editors SET email_pattern = 'fcndmosqueda' WHERE name = 'Facu';
UPDATE public.editors SET email_pattern = 'pagella,benja' WHERE name = 'Benjamin';
