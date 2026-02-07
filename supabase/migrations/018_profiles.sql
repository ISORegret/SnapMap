-- Profiles: one per auth user. id matches auth.users(id).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text default '',
  avatar_url text default '',
  bio text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_username_idx on public.profiles(username);

alter table public.profiles enable row level security;

drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Trigger: create profile on signup (call from app or edge function)
-- For now app will create profile on first sign-in.
