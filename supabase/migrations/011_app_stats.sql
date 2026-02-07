-- App stats (e.g. download count) for website and in-app display.
-- Anonymous can read the count; increment is via RPC only.

create table if not exists public.app_stats (
  key text primary key,
  value bigint not null default 0
);

insert into public.app_stats (key, value) values ('downloads', 0)
  on conflict (key) do nothing;

alter table public.app_stats enable row level security;

-- Anonymous can read (for app and website to show count)
create policy "Anyone can read app_stats"
  on public.app_stats for select
  using (true);

-- Only the RPC can update (security definer)
create or replace function public.increment_download_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val bigint;
begin
  update public.app_stats
  set value = value + 1
  where key = 'downloads'
  returning value into new_val;
  return new_val;
end;
$$;

grant execute on function public.increment_download_count() to anon;
grant select on public.app_stats to anon;
