-- Add any columns that might be missing (run once in Supabase SQL Editor)
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS parking text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS how_to_access text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS best_time text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS crowd_level text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS link_url text DEFAULT '';
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS link_label text DEFAULT 'More info';
