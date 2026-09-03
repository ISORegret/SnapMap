-- Organizer claims for one-time imported event listings.
create table if not exists public.event_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  organizer_role text not null check (organizer_role in ('organizer', 'venue', 'staff')),
  verification_contact text not null default '',
  proof_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, claimant_id),
  check (char_length(verification_contact) between 3 and 300),
  check (char_length(proof_note) between 10 and 1500)
);

create index if not exists event_claims_status_created_idx on public.event_claims(status, created_at desc);
create index if not exists event_claims_event_idx on public.event_claims(event_id, created_at desc);
alter table public.event_claims enable row level security;

drop policy if exists "Users can view own event claims" on public.event_claims;
drop policy if exists "Admins can view event claims" on public.event_claims;
create policy "Users can view own event claims" on public.event_claims
  for select to authenticated using (auth.uid() = claimant_id);
create policy "Admins can view event claims" on public.event_claims
  for select to authenticated using (public.is_app_admin());

create or replace function public.submit_event_claim(
  target_event_id uuid,
  claim_role text,
  claim_contact text,
  claim_proof text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare viewer_id uuid := auth.uid(); claim_id uuid;
begin
  if viewer_id is null then raise exception 'Sign in to claim an event'; end if;
  if not public.is_account_active(viewer_id) then raise exception 'Account unavailable'; end if;
  if claim_role not in ('organizer', 'venue', 'staff') then raise exception 'Choose a valid role'; end if;
  if length(trim(claim_contact)) not between 3 and 300 or length(trim(claim_proof)) not between 10 and 1500 then
    raise exception 'Add verification details';
  end if;
  if not exists (select 1 from public.events where id = target_event_id and listing_type = 'listed') then
    raise exception 'This event is not available to claim';
  end if;

  insert into public.event_claims(event_id, claimant_id, organizer_role, verification_contact, proof_note)
  values (target_event_id, viewer_id, claim_role, trim(claim_contact), trim(claim_proof))
  on conflict (event_id, claimant_id) do update
    set organizer_role = excluded.organizer_role,
        verification_contact = excluded.verification_contact,
        proof_note = excluded.proof_note,
        status = 'pending', reviewed_by = null, reviewed_at = null, updated_at = now()
  where public.event_claims.status = 'rejected'
  returning id into claim_id;

  if claim_id is null then raise exception 'A claim is already pending for this event'; end if;
  return claim_id;
end;
$$;

revoke all on function public.submit_event_claim(uuid, text, text, text) from public;
grant execute on function public.submit_event_claim(uuid, text, text, text) to authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'spot_comment', 'comment_reply', 'post_like', 'post_comment', 'event_rsvp', 'event_reminder', 'event_claim_approved', 'event_claim_rejected'));

create or replace function public.review_event_claim(target_claim_id uuid, approve_claim boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_row public.event_claims%rowtype;
begin
  if not public.is_app_admin() then raise exception 'Admin access required'; end if;
  select * into claim_row from public.event_claims where id = target_claim_id and status = 'pending' for update;
  if claim_row.id is null then return false; end if;

  if approve_claim then
    update public.events
       set host_id = claim_row.claimant_id,
           listing_type = 'hosted',
           source_label = 'Claimed by organizer',
           updated_at = now()
     where id = claim_row.event_id and listing_type = 'listed';
    if not found then return false; end if;

    insert into public.event_rsvps(event_id, user_id)
    values (claim_row.event_id, claim_row.claimant_id)
    on conflict (event_id, user_id) do nothing;

    update public.event_claims
       set status = case when id = target_claim_id then 'approved' else 'rejected' end,
           reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
     where event_id = claim_row.event_id and status = 'pending';
  else
    update public.event_claims
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
     where id = target_claim_id;
  end if;
  insert into public.notifications(recipient_id, actor_id, type, event_id)
  values (claim_row.claimant_id, auth.uid(), case when approve_claim then 'event_claim_approved' else 'event_claim_rejected' end, claim_row.event_id);
  return true;
end;
$$;

revoke all on function public.review_event_claim(uuid, boolean) from public;
grant execute on function public.review_event_claim(uuid, boolean) to authenticated;
