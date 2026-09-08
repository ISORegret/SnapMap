# SnapMap product audit — 2026-09-08

## Product direction

SnapMap is strongest as a planning tool for photographers and car enthusiasts: discover a place or event, understand when to go, save it, and get there. The map, spot details, event discovery, light/weather data, saved lists, and routes all reinforce that loop. Social features should support it rather than compete with it.

Recommended navigation:

- Keep the bottom navigation: **Map, Explore, Add, Saved, Profile**.
- Simplify Explore to **Spots, Events, Community**, with universal search in the header.
- Put posts and creators together under Community.
- Keep infrequent utilities in contextual menus or Settings.

## Current feature inventory

| Area | Live evidence | Decision |
| --- | ---: | --- |
| Map and spot discovery | 15 spots | Keep; primary surface |
| Spot detail, photos, light, weather, directions | Core planning flow | Keep and polish |
| Events | 56 upcoming at follow-up; all geocoded | Keep; improve freshness |
| Favorites and lists | 9 favorites | Keep; simplify the empty state |
| Route planner | Useful extension of saved places | Keep; surface contextually |
| Profiles and follows | 5 profiles, 4 follows | Keep, but group under Community |
| Feed posts | 1 post | De-emphasize until activity grows |
| Ratings and spot comments | 3 each | Keep contextually on spot details |
| Spot check-ins | 5 | Keep lightweight; do not lead with it |
| Event RSVPs and reminders | 5 each | Keep; make reminder behavior explicit |
| Messages | 0 | Remove from primary UI; retain behind profiles |
| Event comments/check-ins/claims | 0 | Keep out of primary UI until used |
| Manual sync codes | Legacy account migration | Move to Settings as a one-time import |
| Download counter | Stale marketing residue | Remove from product UI |

## Completed cleanup

- Stopped requesting browser location automatically on startup. Location is now requested only after the user asks for nearby results or taps the location control.
- Prevented the install banner from appearing over the first-run tutorial.
- Corrected the Creators page description so it no longer reports the spot count as creator activity.
- Updated the landing page to the current product and made its version read from the deployed app metadata.
- Removed the broken, unused landing-page Supabase configuration script and corrected the deployment documentation.
- Replaced the five cramped Explore tabs with Spots, Events, and Community.
- Moved universal search into the Explore header and grouped posts with creators under Community.
- Limited the initial Events render to 12 cards with incremental “load more” pagination.
- Backfilled every upcoming event coordinate and removed bulk address geocoding from map startup.

## Prioritized backlog

### P0 — reliability and clarity

1. Require sign-in at the publish step and clearly label signed-out additions as local drafts.
2. Backfill ownership for the 10 legacy spots with no owner where authorship is known.
3. Upgrade React Router through a tested migration to resolve the two moderate security advisories.
4. Add error monitoring and a small analytics funnel for map → detail → save/directions.

### P1 — simplify the interface

1. Move manual sync-code import, bulk export, and other rare actions into Settings or an overflow menu.
2. Show ratings, comments, check-ins, and live activity only when they have data or clear user intent.
3. Reduce map overlays: one search row, one filter action, one layers action, and one location action.
4. Split large screens into smaller route components and lazy-load non-map routes. The current production JavaScript bundle is about 796 kB (217 kB gzip).

### P2 — grow the core loop

1. Add a reliable event import/refresh pipeline with source, last-verified date, and deduplication.
2. Add photo edit, reorder, replace, and delete controls for spot owners.
3. Add report/claim status tracking so contributors know what happened.
4. Add true push notifications, or label reminders accurately as in-app/browser reminders.
5. Seed Community with event-linked posts and featured local creators before promoting messaging.

## Supabase follow-up

The live schema and key RLS regression checks pass. The next database pass should address advisor warnings in small reviewed migrations: index frequently joined foreign keys, remove demonstrably unused indexes, consolidate overlapping permissive policies, and restrict `SECURITY DEFINER` function execution where public execution is unnecessary. Enable leaked-password protection in Auth settings.
