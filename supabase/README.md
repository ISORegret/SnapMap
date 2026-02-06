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
