-- Last edited by: username of user who last updated the spot (optional attribution)
alter table public.spots add column if not exists last_edited_by text default '';
