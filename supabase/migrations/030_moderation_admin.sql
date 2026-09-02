-- Admin-only moderation queue, report workflow, and account suspensions.
create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

create or replace function public.is_app_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = check_user);
$$;

create policy "Admins can view admin list" on public.app_admins
  for select to authenticated using (public.is_app_admin());

create table if not exists public.account_suspensions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null default 'Community guidelines violation',
  suspended_until timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_suspensions enable row level security;
create policy "Admins can view suspensions" on public.account_suspensions
  for select to authenticated using (public.is_app_admin());
create policy "Admins can create suspensions" on public.account_suspensions
  for insert to authenticated with check (public.is_app_admin() and auth.uid() = created_by);
create policy "Admins can update suspensions" on public.account_suspensions
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins can remove suspensions" on public.account_suspensions
  for delete to authenticated using (public.is_app_admin());

create or replace function public.is_account_active(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.account_suspensions
    where user_id = check_user
      and (suspended_until is null or suspended_until > now())
  );
$$;

alter table public.spot_reports add column if not exists reporter_id uuid references public.profiles(id) on delete set null;
alter table public.spot_reports add column if not exists status text not null default 'open';
alter table public.spot_reports drop constraint if exists spot_reports_status_check;
alter table public.spot_reports add constraint spot_reports_status_check check (status in ('open', 'reviewed', 'dismissed', 'removed'));

drop policy if exists "Anyone can insert spot_reports" on public.spot_reports;
drop policy if exists "Anyone can read spot_reports" on public.spot_reports;
create policy "Users can report spots" on public.spot_reports
  for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Users can view own spot reports" on public.spot_reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Admins can view spot reports" on public.spot_reports
  for select to authenticated using (public.is_app_admin());
create policy "Admins can update spot reports" on public.spot_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "Admins can view comment reports" on public.comment_reports
  for select to authenticated using (public.is_app_admin());
create policy "Admins can update comment reports" on public.comment_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins can view post reports" on public.post_reports
  for select to authenticated using (public.is_app_admin());
create policy "Admins can update post reports" on public.post_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "Admins can remove reported posts" on public.posts
  for delete to authenticated using (public.is_app_admin());
create policy "Admins can remove reported post comments" on public.post_comments
  for delete to authenticated using (public.is_app_admin());
create policy "Admins can remove reported spot comments" on public.spot_notes
  for delete to authenticated using (public.is_app_admin());
create policy "Admins can remove reported spots" on public.spots
  for delete to authenticated using (public.is_app_admin());
create policy "Admins can remove post photo files" on storage.objects
  for delete to authenticated using (bucket_id = 'post-images' and public.is_app_admin());

-- Replace write policies so a suspended account cannot continue posting or connecting.
drop policy if exists "Signed-in users can insert spots" on public.spots;
create policy "Active users can insert spots" on public.spots for insert to authenticated
  with check (auth.uid() = owner_id and public.is_account_active());

drop policy if exists "Signed-in creators can comment" on public.spot_notes;
create policy "Active creators can comment" on public.spot_notes for insert to authenticated
  with check (auth.uid() = user_id and length(trim(body)) between 1 and 1000 and public.is_account_active());

drop policy if exists "Users can send allowed friend requests" on public.follows;
create policy "Active users can send allowed friend requests" on public.follows for insert to authenticated
  with check (auth.uid() = follower_id and public.is_account_active() and public.can_users_connect(follower_id, following_id));

drop policy if exists "Users can create own posts" on public.posts;
create policy "Active users can create own posts" on public.posts for insert to authenticated
  with check (auth.uid() = user_id and public.is_account_active());

drop policy if exists "Users can create own post comments" on public.post_comments;
create policy "Active users can create own post comments" on public.post_comments for insert to authenticated
  with check (auth.uid() = user_id and public.is_account_active());

drop policy if exists "Users can like as themselves" on public.post_likes;
create policy "Active users can like as themselves" on public.post_likes for insert to authenticated
  with check (auth.uid() = user_id and public.is_account_active());

drop policy if exists "Users can upload own post photos" on storage.objects;
create policy "Active users can upload own post photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_account_active());

-- After running this migration, add the owner from SQL Editor once:
-- insert into public.app_admins(user_id) select id from public.profiles where username = 'your_username';
