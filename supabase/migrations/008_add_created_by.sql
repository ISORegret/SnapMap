-- Optional "Added by" attribution on spots
alter table public.spots add column if not exists created_by text default '';
