-- Track listed-event freshness and refresh history without affecting creator-hosted events.
alter table public.events
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists source_status text not null default 'active';

alter table public.events drop constraint if exists events_source_url_length_check;
alter table public.events add constraint events_source_url_length_check
  check (source_url is null or char_length(source_url) <= 2048);

alter table public.events drop constraint if exists events_source_status_check;
alter table public.events add constraint events_source_status_check
  check (source_status in ('active', 'cancelled', 'missing'));

create index if not exists events_listed_source_starts_idx
  on public.events(source_label, starts_at)
  where listing_type = 'listed';

create table if not exists public.event_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'skipped')),
  events_seen integer not null default 0 check (events_seen >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  missing_count integer not null default 0 check (missing_count >= 0),
  error_message text not null default '' check (char_length(error_message) <= 1000)
);

alter table public.event_import_runs enable row level security;

drop policy if exists "Admins can read event import runs" on public.event_import_runs;
create policy "Admins can read event import runs"
  on public.event_import_runs for select
  to authenticated
  using (public.is_app_admin());

comment on table public.event_import_runs is
  'Private audit log for automated listed-event source refreshes.';
comment on column public.events.last_verified_at is
  'Last successful source refresh that saw or evaluated this listed event.';
comment on column public.events.source_updated_at is
  'Upstream calendar last-modified timestamp when provided.';
comment on column public.events.source_status is
  'Upstream lifecycle for listed events. Creator-hosted events remain active.';
