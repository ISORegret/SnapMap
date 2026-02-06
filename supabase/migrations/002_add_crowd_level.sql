-- Add crowd_level if the table was created before it existed
ALTER TABLE public.spots ADD COLUMN IF NOT EXISTS crowd_level text DEFAULT '';
