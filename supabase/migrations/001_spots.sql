-- Community spots: anyone can insert and select (no auth required for MVP)
create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  address text default '',
  parking text default '',
  how_to_access text default '',
  latitude double precision not null,
  longitude double precision not null,
  best_time text default '',
  crowd_level text default '',
  score integer default 0,
  tags jsonb default '[]',
  images jsonb default '[]',
  link_url text default '',
  link_label text default 'More info',
  created_at timestamptz default now()
);

-- Allow anonymous read and insert (no auth)
alter table public.spots enable row level security;

-- Drop existing policies so this migration can be re-run
drop policy if exists "Anyone can read spots" on public.spots;
drop policy if exists "Anyone can insert spots" on public.spots;
drop policy if exists "Anyone can delete spots" on public.spots;

create policy "Anyone can read spots"
  on public.spots for select
  using (true);

create policy "Anyone can insert spots"
  on public.spots for insert
  with check (true);

create policy "Anyone can delete spots"
  on public.spots for delete
  using (true);
