-- Friends-only direct messages, read receipts, sharing, reports, and realtime updates.
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  share_type text,
  share_id uuid,
  share_title text not null default '',
  share_subtitle text not null default '',
  share_image_url text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check (char_length(body) <= 1500),
  check (share_type is null or share_type in ('spot', 'event', 'post')),
  check ((length(trim(body)) > 0) or share_type is not null),
  check ((share_type is null) = (share_id is null))
);

create index if not exists private_messages_sender_created_idx on public.private_messages(sender_id, created_at desc);
create index if not exists private_messages_recipient_created_idx on public.private_messages(recipient_id, created_at desc);
create index if not exists private_messages_unread_idx on public.private_messages(recipient_id, created_at desc) where read_at is null;
alter table public.private_messages replica identity full;
alter table public.private_messages enable row level security;

drop policy if exists "Participants can view private messages" on public.private_messages;
drop policy if exists "Friends can send private messages" on public.private_messages;
create policy "Participants can view private messages" on public.private_messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Friends can send private messages" on public.private_messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_account_active(sender_id)
    and public.can_users_connect(sender_id, recipient_id)
    and exists (
      select 1 from public.follows a
      join public.follows b
        on b.follower_id = a.following_id
       and b.following_id = a.follower_id
      where a.follower_id = sender_id
        and a.following_id = recipient_id
    )
  );

create or replace function public.mark_conversation_read(other_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare changed integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.private_messages
     set read_at = now()
   where recipient_id = auth.uid()
     and sender_id = other_user_id
     and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create table if not exists public.private_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.private_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default 'inappropriate',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);

create index if not exists private_message_reports_status_idx on public.private_message_reports(status, created_at desc);
alter table public.private_message_reports enable row level security;
drop policy if exists "Participants can report messages" on public.private_message_reports;
drop policy if exists "Users can view own message reports" on public.private_message_reports;
drop policy if exists "Admins can view message reports" on public.private_message_reports;
drop policy if exists "Admins can update message reports" on public.private_message_reports;
create policy "Participants can report messages" on public.private_message_reports
  for insert to authenticated
  with check (
    auth.uid() = reporter_id
    and exists (
      select 1 from public.private_messages m
      where m.id = message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );
create policy "Users can view own message reports" on public.private_message_reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Admins can view message reports" on public.private_message_reports
  for select to authenticated using (public.is_app_admin());
create policy "Admins can update message reports" on public.private_message_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Moderators can only see or remove a private message after a participant reports it.
drop policy if exists "Admins can view reported private messages" on public.private_messages;
drop policy if exists "Admins can remove reported private messages" on public.private_messages;
create policy "Admins can view reported private messages" on public.private_messages
  for select to authenticated
  using (
    public.is_app_admin()
    and exists (select 1 from public.private_message_reports r where r.message_id = id)
  );
create policy "Admins can remove reported private messages" on public.private_messages
  for delete to authenticated
  using (
    public.is_app_admin()
    and exists (select 1 from public.private_message_reports r where r.message_id = id)
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.private_messages;
  exception when duplicate_object then null;
  end;
end $$;
