-- Prevent tampering: created_by, created_at, name, and location must not be changed by updates.
-- Anyone can still update other fields (e.g. description, images, best_time, crowd_level).
create or replace function public.spots_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.name := old.name;
  new.latitude := old.latitude;
  new.longitude := old.longitude;
  return new;
end;
$$;

drop trigger if exists spots_immutable_fields_trigger on public.spots;
create trigger spots_immutable_fields_trigger
  before update on public.spots
  for each row
  execute function public.spots_immutable_fields();
