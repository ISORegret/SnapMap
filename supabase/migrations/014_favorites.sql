-- Favorites synced across devices by sync_code (user enters same code on each device).
create table if not exists public.favorites (
  sync_code text not null,
  spot_id uuid not null,
  primary key (sync_code, spot_id),
  foreign key (spot_id) references public.spots(id) on delete cascade
);

alter table public.favorites enable row level security;

-- Anyone can read/insert/delete (sync_code acts as the secret; no auth for MVP)
drop policy if exists "Anyone can read favorites" on public.favorites;
drop policy if exists "Anyone can insert favorites" on public.favorites;
drop policy if exists "Anyone can delete favorites" on public.favorites;

create policy "Anyone can read favorites"
  on public.favorites for select using (true);

create policy "Anyone can insert favorites"
  on public.favorites for insert with check (true);

create policy "Anyone can delete favorites"
  on public.favorites for delete using (true);

-- Index for fast lookup by sync_code
create index if not exists favorites_sync_code_idx on public.favorites(sync_code);
