# SnapMap landing site

Static marketing/launch page (PepTalk-style). Deploy with **Cloudflare Pages**.

## Cloudflare Pages

- **Build command:** leave empty (static site, no build).
- **Build output directory:** `website`  
  (So the *contents* of this folder are the site root: `index.html`, `favicon.svg`, `SnapMap.apk`.)

Push to your connected branch; Cloudflare will deploy the `website` folder.

## APK

"Download APK" links to `./SnapMap.apk`. Add your built APK here (e.g. copy from `android/app/build/outputs/apk/debug/app-debug.apk` and rename to `SnapMap.apk`).

## Download count (Supabase: live count + increment on click)

1. **Run the migration** `supabase/migrations/011_app_stats.sql` so the `app_stats` table and `increment_download_count()` RPC exist.

2. **Website:** For the count to come from Supabase and **increment when "Download APK" is clicked**, add a `config.js` file:
   - Copy `config.example.js` to `config.js`.
   - Edit `config.js` and set your Supabase **Project URL** and **anon public key** (Supabase → Settings → API).
   - Deploy the `website` folder **including** `config.js`.

   The page loads `config.js` before the main script. If `config.js` is missing or doesn't set `window.SNAPMAP_SUPABASE`, the page falls back to `./stats.json` and the link works as a normal download (**no increment**). So if the counter never changes when you click Download, add `config.js` with your Supabase URL and anon key.

3. **App:** The app reads the count from Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set; otherwise it uses `stats.json`.
