-- Replace the original MVP's public write/delete policies with account ownership.
alter table public.spots
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists spots_owner_id_idx on public.spots(owner_id);

-- Best-effort ownership backfill for spots attributed to an existing profile.
update public.spots s
set owner_id = p.id
from public.profiles p
where s.owner_id is null
  and lower(trim(s.created_by)) = lower(trim(p.username));

create or replace function public.set_spot_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_spot_owner_trigger on public.spots;
create trigger set_spot_owner_trigger
  before insert on public.spots
  for each row execute function public.set_spot_owner();

create or replace function public.spots_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.owner_id := old.owner_id;
  return new;
end;
$$;

drop policy if exists "Anyone can insert spots" on public.spots;
drop policy if exists "Anyone can update spots" on public.spots;
drop policy if exists "Anyone can delete spots" on public.spots;
drop policy if exists "Signed-in users can insert spots" on public.spots;
drop policy if exists "Owners can update spots" on public.spots;
drop policy if exists "Owners can delete spots" on public.spots;

create policy "Signed-in users can insert spots"
  on public.spots for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update spots"
  on public.spots for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete spots"
  on public.spots for delete
  to authenticated
  using (owner_id = auth.uid());
