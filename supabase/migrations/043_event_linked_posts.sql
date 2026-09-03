-- Let photo posts belong to an event and power event galleries.
alter table public.posts
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists posts_event_created_idx on public.posts(event_id, created_at desc)
  where event_id is not null;

