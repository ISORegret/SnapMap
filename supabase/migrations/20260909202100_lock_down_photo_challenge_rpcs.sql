-- Harden the photo challenge API and expose entrant profiles through PostgREST.

alter table public.photo_challenge_entries
  drop constraint if exists photo_challenge_entries_user_id_fkey;

alter table public.photo_challenge_entries
  add constraint photo_challenge_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

revoke all on function public.submit_photo_challenge_entry(uuid, uuid) from public;
revoke all on function public.submit_photo_challenge_entry(uuid, uuid) from anon;
grant execute on function public.submit_photo_challenge_entry(uuid, uuid) to authenticated;

revoke all on function public.choose_photo_challenge_winner(uuid, uuid) from public;
revoke all on function public.choose_photo_challenge_winner(uuid, uuid) from anon;
grant execute on function public.choose_photo_challenge_winner(uuid, uuid) to authenticated;
