-- Time-limited, creator-authenticated activity for live spot conditions.
create table if not exists public.spot_activity_updates (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null check (activity_type in ('check_in', 'condition')),
  condition text check (condition in ('clear', 'busy', 'restricted', 'closed', 'unsafe')),
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  unique (spot_id, user_id, activity_type),
  check (
    (activity_type = 'check_in' and condition is null)
    or (activity_type = 'condition' and condition is not null)
  )
);

create index if not exists spot_activity_active_idx
  on public.spot_activity_updates(spot_id, expires_at desc);

create or replace function public.set_spot_activity_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at := now();
  new.expires_at := case
    when new.activity_type = 'check_in' then now() + interval '4 hours'
    else now() + interval '12 hours'
  end;
  return new;
end;
$$;

drop trigger if exists set_spot_activity_expiry_trigger on public.spot_activity_updates;
create trigger set_spot_activity_expiry_trigger
before insert or update on public.spot_activity_updates
for each row execute function public.set_spot_activity_expiry();

alter table public.spot_activity_updates enable row level security;

create policy "Spot activity is publicly readable" on public.spot_activity_updates
  for select to public using (true);

create policy "Active users can share spot activity" on public.spot_activity_updates
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_account_active());

create policy "Active users can refresh own spot activity" on public.spot_activity_updates
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_account_active());

create policy "Users can remove own spot activity" on public.spot_activity_updates
  for delete to authenticated using (auth.uid() = user_id or public.is_app_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spot_activity_updates'
  ) then
    alter publication supabase_realtime add table public.spot_activity_updates;
  end if;
end
$$;
