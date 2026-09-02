-- Allow a signed-in user to permanently remove their own account.
-- Profile-owned data follows through cascades. Username-attributed spots and account
-- favorites are removed explicitly because the legacy schema predates auth ownership IDs.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid := auth.uid();
  target_username text;
begin
  if target_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select username into target_username
  from public.profiles
  where id = target_user_id;

  if target_username is not null then
    delete from public.spots
    where lower(trim(created_by)) = lower(trim(target_username));
  end if;

  delete from public.favorites
  where sync_code = 'user_' || target_user_id::text;

  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = target_user_id::text;

  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
