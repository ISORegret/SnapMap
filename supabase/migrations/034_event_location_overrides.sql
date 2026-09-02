-- Permanent, manually corrected map positions for event listings.
alter table public.events add column if not exists latitude double precision;
alter table public.events add column if not exists longitude double precision;

alter table public.events drop constraint if exists events_latitude_check;
alter table public.events add constraint events_latitude_check
  check (latitude is null or latitude between -90 and 90);
alter table public.events drop constraint if exists events_longitude_check;
alter table public.events add constraint events_longitude_check
  check (longitude is null or longitude between -180 and 180);
alter table public.events drop constraint if exists events_coordinate_pair_check;
alter table public.events add constraint events_coordinate_pair_check
  check ((latitude is null) = (longitude is null));

-- Creator-hosted events are still controlled by their host. App admins may
-- correct imported listings, including their address and exact map pin.
drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events" on public.events
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events" on public.events
  for delete to authenticated
  using (public.is_app_admin());

-- Ensure the SnapMap owner account can manage the one-time imported listings.
insert into public.app_admins(user_id)
select id from public.profiles where lower(username) = 'rtaylorbrick'
on conflict (user_id) do nothing;
