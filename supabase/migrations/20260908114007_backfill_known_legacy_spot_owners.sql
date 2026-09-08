-- Assign only legacy spots whose stored attribution can be tied to a profile
-- without relying on a generated UUID. Ambiguous anonymous spots stay unowned.
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
