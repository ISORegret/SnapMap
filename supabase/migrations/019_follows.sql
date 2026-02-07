-- Follows: follower_id follows following_id.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);

alter table public.follows enable row level security;

drop policy if exists "Anyone can read follows" on public.follows;
drop policy if exists "Users can insert own follow" on public.follows;
drop policy if exists "Users can delete own follow" on public.follows;

create policy "Anyone can read follows"
  on public.follows for select using (true);

create policy "Users can insert own follow"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can delete own follow"
  on public.follows for delete using (auth.uid() = follower_id);
