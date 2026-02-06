-- Add image_uri for tables that require it (single primary image URL)
-- Run once in Supabase SQL Editor if you get "null value image_uri" or "column image_uri does not exist"
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS image_uri text NOT NULL DEFAULT '';
