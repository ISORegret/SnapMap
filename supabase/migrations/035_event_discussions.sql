-- Event questions, attendee discussion, and pinned organizer updates.
create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  is_organizer_update boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_comments_event_created_idx
  on public.event_comments(event_id, created_at);

alter table public.event_comments enable row level security;

create policy "Event comments are publicly readable" on public.event_comments
  for select to public using (true);

create policy "Active users can discuss events" on public.event_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_account_active()
    and (
      not is_organizer_update
      or public.is_app_admin()
      or exists (
        select 1 from public.events
        where events.id = event_id and events.host_id = auth.uid()
      )
    )
  );

create policy "Authors and organizers can delete event comments" on public.event_comments
  for delete to authenticated
  using (
    auth.uid() = user_id
    or public.is_app_admin()
    or exists (
      select 1 from public.events
      where events.id = event_id and events.host_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_comments'
  ) then
    alter publication supabase_realtime add table public.event_comments;
  end if;
end
$$;
