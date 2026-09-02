create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;
drop policy if exists "Users can view own blocks" on public.blocked_users;
drop policy if exists "Users can create own blocks" on public.blocked_users;
drop policy if exists "Users can remove own blocks" on public.blocked_users;
create policy "Users can view own blocks" on public.blocked_users for select to authenticated using (auth.uid() = blocker_id);
create policy "Users can create own blocks" on public.blocked_users for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Users can remove own blocks" on public.blocked_users for delete to authenticated using (auth.uid() = blocker_id);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.spot_notes(id) on delete cascade,
  reason text not null default 'inappropriate',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, comment_id)
);

create index if not exists comment_reports_status_created_idx on public.comment_reports(status, created_at desc);
alter table public.comment_reports enable row level security;
drop policy if exists "Users can report comments" on public.comment_reports;
drop policy if exists "Users can view own reports" on public.comment_reports;
create policy "Users can report comments" on public.comment_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Users can view own reports" on public.comment_reports for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.can_users_connect(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.blocked_users
    where (blocker_id = first_user and blocked_id = second_user)
       or (blocker_id = second_user and blocked_id = first_user)
  );
$$;

drop policy if exists "Users can insert own follow" on public.follows;
drop policy if exists "Users can send allowed friend requests" on public.follows;
create policy "Users can send allowed friend requests"
  on public.follows for insert to authenticated
  with check (auth.uid() = follower_id and public.can_users_connect(follower_id, following_id));

create or replace function public.notify_friend_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_users_connect(new.follower_id, new.following_id) then return new; end if;
  if exists (select 1 from public.follows where follower_id = new.following_id and following_id = new.follower_id) then
    delete from public.notifications where recipient_id = new.follower_id and actor_id = new.following_id and type = 'friend_request';
    insert into public.notifications(recipient_id, actor_id, type) values (new.following_id, new.follower_id, 'friend_accepted');
  else
    insert into public.notifications(recipient_id, actor_id, type) values (new.following_id, new.follower_id, 'friend_request');
  end if;
  return new;
end;
$$;

create or replace function public.notify_spot_discussion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  notification_type text;
begin
  if new.parent_id is not null then
    select user_id into recipient from public.spot_notes where id = new.parent_id;
    notification_type := 'comment_reply';
  else
    select owner_id into recipient from public.spots where id = new.spot_id;
    notification_type := 'spot_comment';
  end if;
  if recipient is not null and recipient <> new.user_id and public.can_users_connect(recipient, new.user_id) then
    insert into public.notifications(recipient_id, actor_id, type, spot_id, comment_id)
    values (recipient, new.user_id, notification_type, new.spot_id, new.id);
  end if;
  return new;
end;
$$;
