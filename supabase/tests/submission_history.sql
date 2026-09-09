-- Uses temporary records and rolls back all changes. Requires two regular profiles.
begin;
select set_config('test.report_user', (select p.id::text from public.profiles p where not exists(select 1 from public.app_admins a where a.user_id=p.id) limit 1), true);
select set_config('test.other_user', (select p.id::text from public.profiles p where p.id::text <> current_setting('test.report_user') and not exists(select 1 from public.app_admins a where a.user_id=p.id) limit 1), true);
select set_config('test.spot_id', gen_random_uuid()::text, true);
select set_config('test.report_id', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.report_user'),'role','authenticated')::text,true);
insert into public.spots(id,name,address,latitude,longitude,best_time,image_uri,photo_by)
values(current_setting('test.spot_id')::uuid,'Transactional report test','Test',0,0,'Test','test.jpg','Test');
insert into public.spot_reports(id,spot_id,reporter_id,report_type)
values(current_setting('test.report_id')::uuid,current_setting('test.spot_id')::uuid,current_setting('test.report_user')::uuid,'wrong_location');
delete from public.spots where id=current_setting('test.spot_id')::uuid;
do $$ begin
  if not exists(select 1 from public.spot_reports where id=current_setting('test.report_id')::uuid and spot_id is null) then raise exception 'Report lost when target removed'; end if;
  if (select count(*) from pg_constraint where conname in ('spot_reports_spot_id_fkey','post_reports_post_id_fkey','comment_reports_comment_id_fkey','private_message_reports_message_id_fkey','event_reports_event_id_fkey','event_claims_event_id_fkey') and confdeltype='n') <> 6 then raise exception 'History foreign keys are incomplete'; end if;
end $$;
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.spot_reports where id=current_setting('test.report_id')::uuid) then raise exception 'Owner cannot read report history'; end if;
  begin
    insert into public.spot_reports(spot_id,reporter_id,report_type) values(null,auth.uid(),'wrong_location');
    raise exception 'New report without target was accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.other_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.spot_reports where id=current_setting('test.report_id')::uuid) then raise exception 'Other user can read report'; end if;
end $$;
reset role;
rollback;
