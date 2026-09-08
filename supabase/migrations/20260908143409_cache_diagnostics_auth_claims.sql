alter policy "Signed-in users submit their own diagnostics" on public.snapmap_diagnostics
with check ((select auth.uid()) = user_id and ((select auth.jwt())->>'is_anonymous') is distinct from 'true');
