-- Allow latitude and longitude to be updated (so coordinate edits sync across devices).
-- Only created_by and created_at remain immutable.
create or replace function public.spots_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
