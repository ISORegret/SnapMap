-- Friend requests use the existing follows table:
-- one direction = pending request, reciprocal rows = accepted friendship.
drop policy if exists "Users can delete own follow" on public.follows;
drop policy if exists "Connection participants can delete follows" on public.follows;
create policy "Connection participants can delete follows"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

-- Upgrade legacy spot notes into signed creator discussions with one-level replies.
alter table public.spot_notes
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists parent_id uuid references public.spot_notes(id) on delete cascade;

create index if not exists spot_notes_spot_created_idx
  on public.spot_notes(spot_id, created_at);
create index if not exists spot_notes_parent_idx
  on public.spot_notes(parent_id);

-- Replies must belong to the same spot and may only be nested one level deep.
create or replace function public.validate_spot_note_parent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.spot_notes parent
    where parent.id = new.parent_id
      and parent.spot_id = new.spot_id
      and parent.parent_id is null
  ) then
    raise exception 'Reply parent must be a top-level comment on the same spot';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_spot_note_parent_trigger on public.spot_notes;
create trigger validate_spot_note_parent_trigger
  before insert or update of parent_id, spot_id on public.spot_notes
  for each row execute function public.validate_spot_note_parent();

drop policy if exists "Anyone can insert spot_notes" on public.spot_notes;
drop policy if exists "Signed-in creators can comment" on public.spot_notes;
drop policy if exists "Creators can delete own comments" on public.spot_notes;

create policy "Signed-in creators can comment"
  on public.spot_notes for insert
  to authenticated
  with check (auth.uid() = user_id and length(trim(body)) between 1 and 1000);

create policy "Creators can delete own comments"
  on public.spot_notes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep open spot discussions synchronized across active clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'spot_notes'
  ) then
    alter publication supabase_realtime add table public.spot_notes;
  end if;
end
$$;
