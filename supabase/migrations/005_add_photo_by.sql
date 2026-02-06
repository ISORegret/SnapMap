-- Add photo_by for tables that require it (primary photo attribution)
-- Run once in Supabase SQL Editor if you get "null value photo_by" or "column photo_by does not exist"
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS photo_by text NOT NULL DEFAULT 'You';
