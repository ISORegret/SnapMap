create table public.snapmap_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  event text not null check (event in ('map_view','spot_view','save_spot','directions','app_error')),
  page text not null check (page in ('map','explore','add','saved','spot','user','profile','event','settings','signin','messages','notifications','route','admin','about','privacy','change-password','other')),
  app_version text not null check (app_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' or app_version = 'unknown'),
  error_type text not null default '' check (error_type in ('','Error','TypeError','RangeError','ReferenceError','SyntaxError','ChunkLoadError')),
  source text not null default '' check (source = '' or source ~ '^[A-Za-z0-9_-]{1,90}\.js:[0-9]{1,8}:[0-9]{1,8}$')
);
create index snapmap_diagnostics_created_at_idx on public.snapmap_diagnostics (created_at desc);
create index snapmap_diagnostics_user_id_idx on public.snapmap_diagnostics (user_id);
alter table public.snapmap_diagnostics enable row level security;
revoke all on public.snapmap_diagnostics from public, anon, authenticated;
grant insert (event,page,app_version,error_type,source) on public.snapmap_diagnostics to authenticated;
grant select (event,page,app_version,error_type,source,created_at) on public.snapmap_diagnostics to authenticated;
create policy "Signed-in users submit their own diagnostics"
on public.snapmap_diagnostics for insert to authenticated
with check ((select auth.uid()) = user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Only SnapMap admins read diagnostics"
on public.snapmap_diagnostics for select to authenticated
using ((select public.is_app_admin()));
comment on table public.snapmap_diagnostics is 'Optional SnapMap diagnostics: fixed categories, no user content. Account deletion cascades. Client opt-in, throttled and capped per page session.';
