# Supabase backend for community spots

Shared spots are stored in Supabase so anyone can post and others can see them.

## Setup

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is enough).

2. **Create the `spots` table**  
   In the Supabase dashboard: **SQL Editor** → New query → paste the contents of `migrations/001_spots.sql` → Run.

3. **Get your API keys**  
   **Settings** → **API** → copy **Project URL** and **anon public** key.

4. **Add env vars**  
   In the project root, create a `.env` file (or copy from `.env.example`):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Restart the dev server (`npm run dev`). The app will fetch community spots on load and post new spots to Supabase when users add one.

## Without Supabase

If you don’t set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the app still works: spots are saved only on the device (localStorage). No backend is required.

## Phone vs web not syncing / no rows in Supabase

- **Phone (Android APK)**  
  The APK only has Supabase if `.env` was in the project root **when you ran the build**. Rebuild the app on your machine (with `.env` present), then reinstall the APK:
  ```bash
  npm run build:apk
  ```
  Install the new APK from `android/app/build/outputs/apk/debug/app-debug.apk`.

- **Web (GitHub Pages)**  
  The deployed app is built in GitHub Actions. Add repo secrets: **Settings** → **Secrets and variables** → **Actions** → `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then push to `main` so the workflow runs and redeploys.

- **Check the Add page**  
  Under "Add a spot" it should say *"Spots will be shared with everyone (saved to cloud)."* If it says *"Data stays on your device"*, Supabase env vars are not set for that build.

- **Sync failed message**  
  After adding a spot, if you see *"Saved on device only. Couldn't sync to cloud: …"* on the feed, the message shows the reason (e.g. missing env, network, or Supabase error).
