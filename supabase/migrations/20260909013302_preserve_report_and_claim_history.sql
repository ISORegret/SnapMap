-- Preserve submission history when its target is removed; retain existing ownership RLS.
alter table public.spot_reports alter column spot_id drop not null;
alter table public.spot_reports drop constraint spot_reports_spot_id_fkey;
alter table public.spot_reports add constraint spot_reports_spot_id_fkey foreign key (spot_id) references public.spots(id) on delete set null;
create policy "New submissions require a target" on public.spot_reports as restrictive for insert to authenticated with check (spot_id is not null);

alter table public.post_reports alter column post_id drop not null;
alter table public.post_reports drop constraint post_reports_post_id_fkey;
alter table public.post_reports add constraint post_reports_post_id_fkey foreign key (post_id) references public.posts(id) on delete set null;
create policy "New submissions require a target" on public.post_reports as restrictive for insert to authenticated with check (post_id is not null);

alter table public.comment_reports alter column comment_id drop not null;
alter table public.comment_reports drop constraint comment_reports_comment_id_fkey;
alter table public.comment_reports add constraint comment_reports_comment_id_fkey foreign key (comment_id) references public.spot_notes(id) on delete set null;
create policy "New submissions require a target" on public.comment_reports as restrictive for insert to authenticated with check (comment_id is not null);

alter table public.private_message_reports alter column message_id drop not null;
alter table public.private_message_reports drop constraint private_message_reports_message_id_fkey;
alter table public.private_message_reports add constraint private_message_reports_message_id_fkey foreign key (message_id) references public.private_messages(id) on delete set null;
create policy "New submissions require a target" on public.private_message_reports as restrictive for insert to authenticated with check (message_id is not null);

alter table public.event_reports alter column event_id drop not null;
alter table public.event_reports drop constraint event_reports_event_id_fkey;
alter table public.event_reports add constraint event_reports_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
create policy "New submissions require a target" on public.event_reports as restrictive for insert to authenticated with check (event_id is not null);

alter table public.event_claims alter column event_id drop not null;
alter table public.event_claims drop constraint event_claims_event_id_fkey;
alter table public.event_claims add constraint event_claims_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
create policy "New submissions require a target" on public.event_claims as restrictive for insert to authenticated with check (event_id is not null);
