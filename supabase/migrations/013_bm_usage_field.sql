-- Add bm_usage column to track which BMs are connected to numbers
ALTER TABLE meta_business_managers ADD COLUMN IF NOT EXISTS bm_usage text;
