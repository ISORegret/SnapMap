-- Community notes per spot (short text thread)
create table if not exists public.spot_notes (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  body text not null default '',
  created_at timestamptz default now()
);

alter table public.spot_notes enable row level security;

create policy "Anyone can read spot_notes"
  on public.spot_notes for select
  using (true);

create policy "Anyone can insert spot_notes"
  on public.spot_notes for insert
  with check (true);
