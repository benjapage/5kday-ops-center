-- Add restricted, review, replaced statuses for WA accounts
ALTER TABLE public.wa_accounts DROP CONSTRAINT IF EXISTS wa_accounts_status_check;
ALTER TABLE public.wa_accounts ADD CONSTRAINT wa_accounts_status_check
  CHECK (status IN ('cold', 'warming', 'ready', 'banned', 'restricted', 'review', 'replaced'));
