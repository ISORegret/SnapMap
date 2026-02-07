-- Enable Realtime for spots so all clients get updates immediately when any spot is inserted/updated/deleted.
-- Required for sync across web and phone without waiting for poll or visibility refetch.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'spots'
  ) then
    alter publication supabase_realtime add table public.spots;
  end if;
end
$$;
