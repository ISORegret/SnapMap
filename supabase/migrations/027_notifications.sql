create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('friend_request', 'friend_accepted', 'spot_comment', 'comment_reply')),
  spot_id uuid references public.spots(id) on delete cascade,
  comment_id uuid references public.spot_notes(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = recipient_id);

create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (auth.uid() = recipient_id);

create or replace function public.notify_friend_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.follows
    where follower_id = new.following_id and following_id = new.follower_id
  ) then
    delete from public.notifications
    where recipient_id = new.follower_id
      and actor_id = new.following_id
      and type = 'friend_request';
    insert into public.notifications(recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'friend_accepted');
  else
    insert into public.notifications(recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'friend_request');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_friend_connection_trigger on public.follows;
create trigger notify_friend_connection_trigger
  after insert on public.follows
  for each row execute function public.notify_friend_connection();

create or replace function public.clear_cancelled_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where recipient_id = old.following_id
    and actor_id = old.follower_id
    and type = 'friend_request';
  return old;
end;
$$;

drop trigger if exists clear_cancelled_friend_request_trigger on public.follows;
create trigger clear_cancelled_friend_request_trigger
  after delete on public.follows
  for each row execute function public.clear_cancelled_friend_request();

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
  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, spot_id, comment_id)
    values (recipient, new.user_id, notification_type, new.spot_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_spot_discussion_trigger on public.spot_notes;
create trigger notify_spot_discussion_trigger
  after insert on public.spot_notes
  for each row execute function public.notify_spot_discussion();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
