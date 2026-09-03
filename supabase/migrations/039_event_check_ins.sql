-- Temporary, location-verified attendance for events currently underway.
create table if not exists public.event_check_ins (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  primary key (event_id, user_id),
  check (expires_at > checked_in_at and expires_at <= checked_in_at + interval '8 hours')
);

create index if not exists event_check_ins_active_idx
  on public.event_check_ins(event_id, expires_at desc);

alter table public.event_check_ins enable row level security;

drop policy if exists "Active event check-ins are publicly readable" on public.event_check_ins;
create policy "Active event check-ins are publicly readable" on public.event_check_ins
  for select to public using (expires_at > now());

drop policy if exists "Users can leave their event check-in" on public.event_check_ins;
create policy "Users can leave their event check-in" on public.event_check_ins
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.check_in_to_event(
  target_event_id uuid,
  current_latitude double precision,
  current_longitude double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  event_start timestamptz;
  event_end timestamptz;
  event_latitude double precision;
  event_longitude double precision;
  distance_km double precision;
  expiration timestamptz;
begin
  if viewer_id is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to check in.');
  end if;
  if not public.is_account_active(viewer_id) then
    return jsonb_build_object('ok', false, 'error', 'This account cannot check in.');
  end if;
  if current_latitude not between -90 and 90 or current_longitude not between -180 and 180 then
    return jsonb_build_object('ok', false, 'error', 'Your current location is unavailable.');
  end if;

  select e.starts_at,
         coalesce(e.ends_at, e.starts_at + interval '8 hours'),
         coalesce(e.latitude, s.latitude),
         coalesce(e.longitude, s.longitude)
    into event_start, event_end, event_latitude, event_longitude
  from public.events e
  left join public.spots s on s.id = e.spot_id
  where e.id = target_event_id;

  if event_start is null then
    return jsonb_build_object('ok', false, 'error', 'Event not found.');
  end if;
  if now() < event_start - interval '3 hours' then
    return jsonb_build_object('ok', false, 'error', 'Check-in opens 3 hours before the event.');
  end if;
  if now() > event_end + interval '1 hour' then
    return jsonb_build_object('ok', false, 'error', 'Check-in has closed for this event.');
  end if;
  if event_latitude is null or event_longitude is null then
    return jsonb_build_object('ok', false, 'error', 'The event needs a confirmed map pin before check-in can open.');
  end if;

  distance_km := 6371 * acos(least(1, greatest(-1,
    cos(radians(current_latitude)) * cos(radians(event_latitude))
    * cos(radians(event_longitude - current_longitude))
    + sin(radians(current_latitude)) * sin(radians(event_latitude))
  )));
  if distance_km > 3.2 then
    return jsonb_build_object('ok', false, 'error', 'You need to be within 2 miles of the event to check in.');
  end if;

  expiration := least(now() + interval '4 hours', event_end + interval '1 hour');
  if expiration <= now() then expiration := now() + interval '1 hour'; end if;

  insert into public.event_check_ins(event_id, user_id, checked_in_at, expires_at)
  values (target_event_id, viewer_id, now(), expiration)
  on conflict (event_id, user_id) do update
    set checked_in_at = excluded.checked_in_at,
        expires_at = excluded.expires_at;

  return jsonb_build_object('ok', true, 'expires_at', expiration);
end;
$$;

revoke all on function public.check_in_to_event(uuid, double precision, double precision) from public;
grant execute on function public.check_in_to_event(uuid, double precision, double precision) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_check_ins'
  ) then
    alter publication supabase_realtime add table public.event_check_ins;
  end if;
end
$$;
