-- Synced event reminders for Interested and Going creators.
create table if not exists public.event_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_before boolean not null default true,
  hours_before integer not null default 3 check (hours_before between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_reminders_user_idx on public.event_reminders(user_id, event_id);

alter table public.event_reminders enable row level security;

drop policy if exists "Users can read own event reminders" on public.event_reminders;
drop policy if exists "Users can create own event reminders" on public.event_reminders;
drop policy if exists "Users can update own event reminders" on public.event_reminders;
drop policy if exists "Users can delete own event reminders" on public.event_reminders;

create policy "Users can read own event reminders" on public.event_reminders
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can create own event reminders" on public.event_reminders
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.event_rsvps where event_id = event_reminders.event_id and user_id = auth.uid())
  );
create policy "Users can update own event reminders" on public.event_reminders
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete own event reminders" on public.event_reminders
  for delete to authenticated using (auth.uid() = user_id);

alter table public.notifications add column if not exists reminder_kind text;
alter table public.notifications drop constraint if exists notifications_reminder_kind_check;
alter table public.notifications add constraint notifications_reminder_kind_check
  check (reminder_kind is null or reminder_kind in ('day_before', 'soon'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'spot_comment', 'comment_reply', 'post_like', 'post_comment', 'event_rsvp', 'event_reminder'));

create unique index if not exists notifications_event_reminder_once_idx
  on public.notifications(recipient_id, event_id, reminder_kind)
  where type = 'event_reminder';

create or replace function public.sync_event_reminder_from_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.event_reminders where event_id = old.event_id and user_id = old.user_id;
    delete from public.notifications where event_id = old.event_id and recipient_id = old.user_id and type = 'event_reminder';
    return old;
  end if;
  insert into public.event_reminders(event_id, user_id)
  values (new.event_id, new.user_id)
  on conflict (event_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_event_reminder_insert_trigger on public.event_rsvps;
create trigger sync_event_reminder_insert_trigger
  after insert on public.event_rsvps
  for each row execute function public.sync_event_reminder_from_rsvp();

drop trigger if exists sync_event_reminder_delete_trigger on public.event_rsvps;
create trigger sync_event_reminder_delete_trigger
  after delete on public.event_rsvps
  for each row execute function public.sync_event_reminder_from_rsvp();

insert into public.event_reminders(event_id, user_id)
select r.event_id, r.user_id
from public.event_rsvps r
join public.events e on e.id = r.event_id
where e.starts_at > now()
on conflict (event_id, user_id) do nothing;

create or replace function public.claim_due_event_reminders()
returns table (
  notification_id uuid,
  reminder_event_id uuid,
  reminder_kind text,
  event_title text,
  event_starts_at timestamptz,
  event_venue_name text
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select
      r.user_id,
      r.event_id,
      e.title,
      e.starts_at,
      e.venue_name,
      case
        when e.starts_at <= now() + make_interval(hours => r.hours_before) then 'soon'
        when r.day_before and e.starts_at <= now() + interval '24 hours' then 'day_before'
        else null
      end as due_kind
    from public.event_reminders r
    join public.events e on e.id = r.event_id
    join public.event_rsvps er on er.event_id = r.event_id and er.user_id = r.user_id
    where r.user_id = auth.uid()
      and e.starts_at > now()
      and e.starts_at <= now() + interval '24 hours'
  ), inserted as (
    insert into public.notifications(recipient_id, type, event_id, reminder_kind)
    select user_id, 'event_reminder', event_id, due_kind
    from due
    where due_kind is not null
    on conflict (recipient_id, event_id, reminder_kind) where type = 'event_reminder' do nothing
    returning id, event_id, reminder_kind
  )
  select i.id, i.event_id, i.reminder_kind, d.title, d.starts_at, d.venue_name
  from inserted i
  join due d on d.event_id = i.event_id and d.due_kind = i.reminder_kind;
$$;

revoke all on function public.claim_due_event_reminders() from public;
grant execute on function public.claim_due_event_reminders() to authenticated;

