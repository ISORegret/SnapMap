-- Store creator display name for spots (shown in UI; created_by remains username for profile link).
alter table public.spots add column if not exists created_by_display_name text default '';
