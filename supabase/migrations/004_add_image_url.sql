-- Add image_url for tables that require it (single primary image URL)
-- Run once in Supabase SQL Editor if you get "null value image_url" or "column image_url does not exist"
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
