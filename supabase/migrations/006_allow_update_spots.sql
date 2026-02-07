-- Allow anyone to update spots (e.g. adding photos, description, best_time).
-- Critical fields (created_by, created_at, name, latitude, longitude) are protected
-- by trigger in 010_protect_spot_immutable_fields.sql and cannot be changed.
drop policy if exists "Anyone can update spots" on public.spots;
create policy "Anyone can update spots"
  on public.spots for update
  using (true)
  with check (true);
