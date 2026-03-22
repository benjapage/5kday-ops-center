-- ============================================================
-- Migración 001 — Integración Shopify
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla shopify_stores: guarda tokens OAuth por tienda
CREATE TABLE IF NOT EXISTS public.shopify_stores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop         text NOT NULL UNIQUE,           -- las-recetas-de-ana.myshopify.com
  custom_domain text,                          -- lasrecetasdeana.com
  display_name  text,
  slug         text NOT NULL,                  -- lasrecetasdeana (para revenue_entries.shop)
  access_token text NOT NULL,
  scopes       text,
  webhook_id   text,
  is_active    boolean NOT NULL DEFAULT true,
  installed_at timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.shopify_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopify_stores_select" ON public.shopify_stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shopify_stores_admin" ON public.shopify_stores
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 2. Agregar columnas a revenue_entries para tracking de origen
ALTER TABLE public.revenue_entries
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'shopify')),
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS shop        text;

-- Índice único para evitar duplicados de órdenes Shopify
CREATE UNIQUE INDEX IF NOT EXISTS revenue_entries_shopify_unique_idx
  ON public.revenue_entries (external_id, shop)
  WHERE external_id IS NOT NULL;


-- 3. Función SECURITY DEFINER para insertar revenue de Shopify
--    Bypassa RLS — solo llamarla desde el webhook server-side
CREATE OR REPLACE FUNCTION public.insert_shopify_revenue(
  p_amount       numeric,
  p_currency     text,
  p_revenue_date date,
  p_notes        text,
  p_external_id  text,
  p_shop         text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  INSERT INTO public.revenue_entries (
    amount, currency, channel, revenue_date, notes, source, external_id, shop
  ) VALUES (
    p_amount, p_currency, 'shopify', p_revenue_date, p_notes, 'shopify', p_external_id, p_shop
  )
  ON CONFLICT (external_id, shop) WHERE external_id IS NOT NULL
  DO NOTHING
  RETURNING to_json(revenue_entries.*) INTO v_result;

  RETURN COALESCE(v_result, '{"skipped": true}'::json);
END;
$$;

-- Permitir que el rol anon y authenticated llamen la función
-- (la seguridad real es el HMAC de Shopify validado en el serverless)
GRANT EXECUTE ON FUNCTION public.insert_shopify_revenue TO anon, authenticated;
