-- Integration checks against an environment with an admin and a regular profile.
begin;
select set_config('test.snapmap_member', (select p.id::text from public.profiles p where not exists (select 1 from public.app_admins a where a.user_id=p.id) limit 1), true);
select set_config('test.snapmap_admin', (select user_id::text from public.app_admins limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.snapmap_member'), 'role','authenticated','is_anonymous',false)::text, true);
set local role authenticated;
insert into public.snapmap_diagnostics(event,page,app_version) values ('map_view','map','0.0.0');
do $$ begin
  if (select count(event) from public.snapmap_diagnostics) <> 0 then raise exception 'Non-admin can read diagnostics'; end if;
  begin
    insert into public.snapmap_diagnostics(user_id,event,page,app_version) values (current_setting('test.snapmap_admin')::uuid,'map_view','map','0.0.0');
    raise exception 'User can spoof ownership';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.snapmap_diagnostics(event,page,app_version) values ('private content','map','0.0.0');
    raise exception 'Invalid event accepted';
  exception when check_violation then null; end;
  begin
    update public.snapmap_diagnostics set page='other';
    raise exception 'User can update reports';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.snapmap_diagnostics;
    raise exception 'User can delete reports';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.snapmap_admin'), 'role','authenticated','is_anonymous',false)::text, true);
set local role authenticated;
do $$ begin
  if (select count(event) from public.snapmap_diagnostics where app_version='0.0.0') <> 1 then raise exception 'Admin cannot read diagnostics'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    select count(event) from public.snapmap_diagnostics;
    raise exception 'Guest can read reports';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.snapmap_diagnostics(event,page,app_version) values ('map_view','map','0.0.0');
    raise exception 'Guest can insert reports';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
