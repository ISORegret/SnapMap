alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_social_links_object_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_social_links_object_check
      check (jsonb_typeof(social_links) = 'object');
  end if;
end $$;
