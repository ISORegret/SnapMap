-- The normal update trigger keeps owner_id immutable for app users. Disable
-- only that trigger while completing this reviewed administrative backfill.
alter table public.spots disable trigger spots_immutable_fields_trigger;

update public.spots as s
set
  owner_id = p.id,
  created_by = p.username,
  created_by_display_name = p.display_name
from public.profiles as p
where p.username = 'rtaylorbrick'
  and s.owner_id is null
  and (
    lower(btrim(coalesce(s.created_by, ''))) = lower('Iso.Regret')
    or (
      lower(btrim(coalesce(s.created_by, ''))) = lower('It''s Brickel')
      and lower(btrim(coalesce(s.last_edited_by, ''))) = lower(p.username)
    )
  );

alter table public.spots enable trigger spots_immutable_fields_trigger;
