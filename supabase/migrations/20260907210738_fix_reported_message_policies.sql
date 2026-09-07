-- Correlate reports with the message being moderated, not the report's own ID.
-- Keep access restricted to administrators and reported messages.
drop policy if exists "Admins can view reported private messages" on public.private_messages;
drop policy if exists "Admins can remove reported private messages" on public.private_messages;

create policy "Admins can view reported private messages" on public.private_messages
  for select to authenticated
  using (
    public.is_app_admin()
    and exists (
      select 1 from public.private_message_reports r
      where r.message_id = private_messages.id
    )
  );

create policy "Admins can remove reported private messages" on public.private_messages
  for delete to authenticated
  using (
    public.is_app_admin()
    and exists (
      select 1 from public.private_message_reports r
      where r.message_id = private_messages.id
    )
  );
