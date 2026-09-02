-- Creator-hosted, location-based photo events and meetups.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  spot_id uuid not null references public.spots(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  max_attendees integer check (max_attendees is null or max_attendees between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists events_starts_at_idx on public.events(starts_at);
create index if not exists events_host_starts_idx on public.events(host_id, starts_at);
create index if not exists events_spot_starts_idx on public.events(spot_id, starts_at);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_rsvps_user_idx on public.event_rsvps(user_id, created_at desc);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

create policy "Events are publicly readable" on public.events for select to public using (true);
create policy "Creators can host events" on public.events for insert to authenticated with check (auth.uid() = host_id);
create policy "Hosts can update events" on public.events for update to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);
create policy "Hosts can delete events" on public.events for delete to authenticated using (auth.uid() = host_id);

create policy "Event RSVPs are publicly readable" on public.event_rsvps for select to public using (true);
create policy "Users can RSVP as themselves" on public.event_rsvps for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can cancel own RSVP" on public.event_rsvps for delete to authenticated using (auth.uid() = user_id);

create or replace function public.add_event_host_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_rsvps(event_id, user_id) values (new.id, new.host_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger add_event_host_rsvp_trigger after insert on public.events
for each row execute function public.add_event_host_rsvp();

alter table public.notifications add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'spot_comment', 'comment_reply', 'post_like', 'post_comment', 'event_rsvp'));

create or replace function public.notify_event_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid;
begin
  select host_id into recipient from public.events where id = new.event_id;
  if recipient is not null and recipient <> new.user_id and public.can_users_connect(recipient, new.user_id) then
    insert into public.notifications(recipient_id, actor_id, type, event_id)
    values (recipient, new.user_id, 'event_rsvp', new.event_id);
  end if;
  return new;
end;
$$;

create trigger notify_event_rsvp_trigger after insert on public.event_rsvps
for each row execute function public.notify_event_rsvp();

create or replace function public.clear_event_rsvp_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where actor_id = old.user_id and event_id = old.event_id and type = 'event_rsvp';
  return old;
end;
$$;

create trigger clear_event_rsvp_notification_trigger after delete on public.event_rsvps
for each row execute function public.clear_event_rsvp_notification();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'event_rsvps') then
    alter publication supabase_realtime add table public.event_rsvps;
  end if;
end
$$;
