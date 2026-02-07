-- Ratings: 1–5 stars per spot per device (device_id from localStorage).
create table if not exists public.spot_ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  device_id text not null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  created_at timestamptz default now(),
  unique(spot_id, device_id)
);

create index if not exists spot_ratings_spot_id_idx on public.spot_ratings(spot_id);

alter table public.spot_ratings enable row level security;

drop policy if exists "Anyone can read spot_ratings" on public.spot_ratings;
drop policy if exists "Anyone can insert spot_ratings" on public.spot_ratings;
drop policy if exists "Anyone can update spot_ratings" on public.spot_ratings;

create policy "Anyone can read spot_ratings"
  on public.spot_ratings for select using (true);

create policy "Anyone can insert spot_ratings"
  on public.spot_ratings for insert with check (true);

create policy "Anyone can update spot_ratings"
  on public.spot_ratings for update using (true) with check (true);
