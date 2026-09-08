-- Read-only regression checks; fixture rows are CTEs, never real messages.
do $test$
declare policy_row record; failures integer; checked integer := 0;
begin
  for policy_row in
    select policyname, qual from pg_policies
    where schemaname = 'public' and tablename = 'private_messages'
      and policyname in ('Admins can view reported private messages', 'Admins can remove reported private messages')
  loop
    execute format(
      'with private_message_reports(id, message_id) as (values (1, 1), (99, 3)),
       private_messages(id, is_admin, expected) as (
         values (1, true, true), (2, true, false), (3, true, true),
                (1, false, false), (2, false, false), (3, false, false)
       )
       select count(*) from private_messages where (%s) is distinct from expected',
       replace(policy_row.qual, 'is_app_admin()', 'private_messages.is_admin')
    ) into failures;
    if failures <> 0 then raise exception 'Policy % failed % access cases', policy_row.policyname, failures; end if;
    checked := checked + 1;
  end loop;
  if checked <> 2 then raise exception 'Expected two moderation policies'; end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.posts'::regclass
      and confrelid = 'public.events'::regclass and conname = 'posts_event_id_fkey'
      and confdeltype = 'n'
  ) then raise exception 'Missing event link with ON DELETE SET NULL'; end if;
end $test$;
select 'Passed: 12 moderation access cases and event foreign-key check' as result;
