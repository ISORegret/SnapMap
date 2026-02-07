-- Spot reports for moderation (wrong location, etc.)
create table if not exists public.spot_reports (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  report_type text not null default 'wrong_location',
  note text default '',
  created_at timestamptz default now()
);

alter table public.spot_reports enable row level security;

-- Anyone can insert a report (no auth)
create policy "Anyone can insert spot_reports"
  on public.spot_reports for insert
  with check (true);

-- Only allow read for moderation (optional: restrict to service role later)
create policy "Anyone can read spot_reports"
  on public.spot_reports for select
  using (true);
