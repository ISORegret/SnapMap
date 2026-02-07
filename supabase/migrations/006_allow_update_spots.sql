-- Allow anyone to update spots (e.g. adding photos to a spot)
drop policy if exists "Anyone can update spots" on public.spots;
create policy "Anyone can update spots"
  on public.spots for update
  using (true)
  with check (true);
