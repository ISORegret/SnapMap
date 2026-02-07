-- Allow name to be updated (so renames sync across devices).
-- Only created_by, created_at, and location (lat/long) remain immutable.
create or replace function public.spots_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.latitude := old.latitude;
  new.longitude := old.longitude;
  return new;
end;
$$;
