-- ============================================================
-- 005 — Add ManyChat API Key to wa_accounts for ban detection
-- ============================================================

ALTER TABLE public.wa_accounts
  ADD COLUMN IF NOT EXISTS manychat_api_key text;
