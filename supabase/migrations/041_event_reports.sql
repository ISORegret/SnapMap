-- Community reports for incorrect, canceled, or duplicate event listings.
create table if not exists public.event_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  report_type text not null check (report_type in ('wrong_location', 'wrong_date_time', 'canceled', 'duplicate', 'wrong_details')),
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'resolved', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_id, event_id, report_type),
  check (char_length(note) <= 1000)
);

create index if not exists event_reports_status_created_idx on public.event_reports(status, created_at desc);
create index if not exists event_reports_event_idx on public.event_reports(event_id, created_at desc);
alter table public.event_reports enable row level security;

drop policy if exists "Active users can report events" on public.event_reports;
drop policy if exists "Users can view own event reports" on public.event_reports;
drop policy if exists "Admins can view event reports" on public.event_reports;
drop policy if exists "Admins can update event reports" on public.event_reports;
create policy "Active users can report events" on public.event_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and public.is_account_active());
create policy "Users can view own event reports" on public.event_reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Admins can view event reports" on public.event_reports
  for select to authenticated using (public.is_app_admin());
create policy "Admins can update event reports" on public.event_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

