-- Let creators save an event as Interested without counting as confirmed attendance.
alter table public.event_rsvps add column if not exists status text not null default 'going';

alter table public.event_rsvps drop constraint if exists event_rsvps_status_check;
alter table public.event_rsvps add constraint event_rsvps_status_check
  check (status in ('interested', 'going'));

drop policy if exists "Users can update own event RSVP" on public.event_rsvps;
create policy "Users can update own event RSVP" on public.event_rsvps
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('interested', 'going'));
