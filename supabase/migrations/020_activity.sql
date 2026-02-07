-- Activity: feed of actions (added_spot, saved_spot, added_photo).
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('added_spot', 'saved_spot', 'added_photo')),
  spot_id uuid references public.spots(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists activity_user_id_idx on public.activity(user_id);
create index if not exists activity_created_at_idx on public.activity(created_at desc);

alter table public.activity enable row level security;

drop policy if exists "Anyone can read activity" on public.activity;
drop policy if exists "Authenticated can insert activity" on public.activity;

create policy "Anyone can read activity"
  on public.activity for select using (true);

create policy "Authenticated can insert activity"
  on public.activity for insert with check (auth.uid() = user_id);
