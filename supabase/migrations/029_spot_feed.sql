-- Location-first creator feed: posts, photos, likes, comments, moderation, and alerts.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  spot_id uuid references public.spots(id) on delete set null,
  caption text not null default '' check (char_length(caption) <= 2200),
  location_name text not null check (char_length(location_name) between 1 and 160),
  latitude double precision,
  longitude double precision,
  location_precision text not null default 'exact' check (location_precision in ('exact', 'approximate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_user_created_idx on public.posts(user_id, created_at desc);
create index if not exists posts_spot_created_idx on public.posts(spot_id, created_at desc);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  position smallint not null default 0 check (position between 0 and 4),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create index if not exists post_images_post_idx on public.post_images(post_id, position);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx on public.post_comments(post_id, created_at);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null default 'inappropriate',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;

create policy "Posts are publicly readable" on public.posts for select to public using (true);
create policy "Users can create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own posts" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);

create policy "Post images are publicly readable" on public.post_images for select to public using (true);
create policy "Users can create own post images" on public.post_images for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete own post images" on public.post_images for delete to authenticated using (auth.uid() = user_id);

create policy "Post likes are publicly readable" on public.post_likes for select to public using (true);
create policy "Users can like as themselves" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove own likes" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create policy "Post comments are publicly readable" on public.post_comments for select to public using (true);
create policy "Users can create own post comments" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own post comments" on public.post_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own post comments" on public.post_comments for delete to authenticated using (auth.uid() = user_id);

create policy "Users can report posts" on public.post_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Users can view own post reports" on public.post_reports for select to authenticated using (auth.uid() = reporter_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

create policy "Post images storage is publicly readable" on storage.objects for select to public using (bucket_id = 'post-images');
create policy "Users can upload own post photos" on storage.objects for insert to authenticated
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own post photos" on storage.objects for update to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own post photos" on storage.objects for delete to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.notifications add column if not exists post_id uuid references public.posts(id) on delete cascade;
alter table public.notifications add column if not exists post_comment_id uuid references public.post_comments(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'spot_comment', 'comment_reply', 'post_like', 'post_comment'));

create or replace function public.notify_post_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid;
begin
  select user_id into recipient from public.posts where id = new.post_id;
  if recipient is not null and recipient <> new.user_id and public.can_users_connect(recipient, new.user_id) then
    if tg_table_name = 'post_likes' then
      insert into public.notifications(recipient_id, actor_id, type, post_id)
      values (recipient, new.user_id, 'post_like', new.post_id);
    else
      insert into public.notifications(recipient_id, actor_id, type, post_id, post_comment_id)
      values (recipient, new.user_id, 'post_comment', new.post_id, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger notify_post_like_trigger after insert on public.post_likes
for each row execute function public.notify_post_activity();
create trigger notify_post_comment_trigger after insert on public.post_comments
for each row execute function public.notify_post_activity();

create or replace function public.clear_post_like_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where actor_id = old.user_id and post_id = old.post_id and type = 'post_like';
  return old;
end;
$$;
create trigger clear_post_like_notification_trigger after delete on public.post_likes
for each row execute function public.clear_post_like_notification();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'post_comments') then
    alter publication supabase_realtime add table public.post_comments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'post_likes') then
    alter publication supabase_realtime add table public.post_likes;
  end if;
end
$$;
