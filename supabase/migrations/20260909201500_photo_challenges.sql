-- Weekly photo challenges: one moderated post entry per account, admin-picked winner.

create table if not exists public.photo_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  prompt text not null default '' check (char_length(prompt) <= 1200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint photo_challenges_valid_window check (ends_at > starts_at)
);

create index if not exists photo_challenges_window_idx
  on public.photo_challenges (starts_at desc, ends_at desc);

create table if not exists public.photo_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.photo_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint photo_challenge_entries_one_per_user unique (challenge_id, user_id),
  constraint photo_challenge_entries_one_post unique (challenge_id, post_id),
  constraint photo_challenge_entries_id_challenge_unique unique (id, challenge_id)
);

create index if not exists photo_challenge_entries_challenge_idx
  on public.photo_challenge_entries (challenge_id, created_at desc);

create table if not exists public.photo_challenge_winners (
  challenge_id uuid primary key references public.photo_challenges(id) on delete cascade,
  entry_id uuid not null unique,
  chosen_by uuid references auth.users(id) on delete set null,
  chosen_at timestamptz not null default now(),
  constraint photo_challenge_winner_matches_challenge
    foreign key (entry_id, challenge_id)
    references public.photo_challenge_entries(id, challenge_id)
    on delete cascade
);

alter table public.photo_challenges enable row level security;
alter table public.photo_challenge_entries enable row level security;
alter table public.photo_challenge_winners enable row level security;

drop policy if exists "Photo challenges are public" on public.photo_challenges;
create policy "Photo challenges are public"
  on public.photo_challenges for select
  using (true);

drop policy if exists "Admins manage photo challenges" on public.photo_challenges;
create policy "Admins manage photo challenges"
  on public.photo_challenges for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "Photo challenge entries are public" on public.photo_challenge_entries;
create policy "Photo challenge entries are public"
  on public.photo_challenge_entries for select
  using (true);

drop policy if exists "Users enter their own open challenge" on public.photo_challenge_entries;
create policy "Users enter their own open challenge"
  on public.photo_challenge_entries for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.photo_challenges c
      where c.id = challenge_id
        and now() >= c.starts_at
        and now() < c.ends_at
    )
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users remove their own open challenge entry" on public.photo_challenge_entries;
create policy "Users remove their own open challenge entry"
  on public.photo_challenge_entries for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.photo_challenges c
      where c.id = challenge_id and now() < c.ends_at
    )
  );

drop policy if exists "Admins manage challenge entries" on public.photo_challenge_entries;
create policy "Admins manage challenge entries"
  on public.photo_challenge_entries for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "Challenge winners are public" on public.photo_challenge_winners;
create policy "Challenge winners are public"
  on public.photo_challenge_winners for select
  using (true);

drop policy if exists "Admins manage challenge winners" on public.photo_challenge_winners;
create policy "Admins manage challenge winners"
  on public.photo_challenge_winners for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create or replace function public.submit_photo_challenge_entry(
  target_challenge_id uuid,
  target_post_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  challenge_row public.photo_challenges%rowtype;
  new_entry_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into challenge_row
  from public.photo_challenges
  where id = target_challenge_id;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if now() < challenge_row.starts_at or now() >= challenge_row.ends_at then
    raise exception 'Challenge entries are closed';
  end if;

  if not exists (
    select 1 from public.posts
    where id = target_post_id and user_id = caller_id
  ) then
    raise exception 'Choose one of your own posts';
  end if;

  delete from public.photo_challenge_entries
  where challenge_id = target_challenge_id
    and user_id = caller_id;

  insert into public.photo_challenge_entries (challenge_id, user_id, post_id)
  values (target_challenge_id, caller_id, target_post_id)
  returning id into new_entry_id;

  return new_entry_id;
end;
$$;

create or replace function public.choose_photo_challenge_winner(
  target_challenge_id uuid,
  target_entry_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge_end timestamptz;
begin
  if auth.uid() is null or not public.is_app_admin() then
    raise exception 'Admin access required';
  end if;

  select ends_at into challenge_end
  from public.photo_challenges
  where id = target_challenge_id;

  if challenge_end is null then
    raise exception 'Challenge not found';
  end if;

  if now() < challenge_end then
    raise exception 'Choose a winner after entries close';
  end if;

  if not exists (
    select 1 from public.photo_challenge_entries
    where id = target_entry_id and challenge_id = target_challenge_id
  ) then
    raise exception 'Entry does not belong to this challenge';
  end if;

  insert into public.photo_challenge_winners (challenge_id, entry_id, chosen_by, chosen_at)
  values (target_challenge_id, target_entry_id, auth.uid(), now())
  on conflict (challenge_id) do update
    set entry_id = excluded.entry_id,
        chosen_by = excluded.chosen_by,
        chosen_at = excluded.chosen_at;

  return true;
end;
$$;

grant select on public.photo_challenges, public.photo_challenge_entries, public.photo_challenge_winners to anon, authenticated;
grant insert, update, delete on public.photo_challenges, public.photo_challenge_entries, public.photo_challenge_winners to authenticated;
grant execute on function public.submit_photo_challenge_entry(uuid, uuid) to authenticated;
grant execute on function public.choose_photo_challenge_winner(uuid, uuid) to authenticated;

comment on table public.photo_challenges is 'Weekly SnapMap photo challenges.';
comment on table public.photo_challenge_entries is 'One moderated post entry per account per challenge.';
comment on table public.photo_challenge_winners is 'Admin-selected challenge winner. Cascades away if the winning post is removed.';

-- Seed the first challenge without hard-coding any user or generated IDs.
insert into public.photo_challenges (title, prompt, starts_at, ends_at, created_by)
select
  'Reflections',
  'Make the reflection part of the composition. Glass, paint, chrome, puddles, mirrors, and city lights all count.',
  timestamptz '2026-09-07 00:00:00-04',
  timestamptz '2026-09-14 00:00:00-04',
  a.user_id
from public.app_admins a
where not exists (
  select 1 from public.photo_challenges
  where starts_at = timestamptz '2026-09-07 00:00:00-04'
)
order by a.created_at
limit 1;
