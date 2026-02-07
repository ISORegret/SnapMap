# SnapMap landing site

Static marketing/launch page (PepTalk-style). Deploy with **Cloudflare Pages**.

## Cloudflare Pages

- **Build command:** leave empty (static site, no build).
- **Build output directory:** `website`  
  (So the *contents* of this folder are the site root: `index.html`, `favicon.svg`, `SnapMap.apk`.)

Push to your connected branch; Cloudflare will deploy the `website` folder.

## APK

“Download APK” links to `./SnapMap.apk`. Add your built APK here (e.g. copy from `android/app/build/outputs/apk/debug/app-debug.apk` and rename to `SnapMap.apk`).

## Download count (Supabase: live count + increment on click)

1. **Run the migration** `supabase/migrations/011_app_stats.sql` so the `app_stats` table and `increment_download_count()` RPC exist.

2. **Website:** To have the count come from Supabase and **increment when “Download APK” is clicked**, set your Supabase URL and anon key before the main script. Add this in `index.html` right before the existing `<script>` that contains the download logic (or in a separate `config.js` that you load first):

   ```html
   <script>
     window.SNAPMAP_SUPABASE = { url: 'https://YOUR_PROJECT.supabase.co', anonKey: 'YOUR_ANON_KEY' };
   </script>
   ```

   If `SNAPMAP_SUPABASE` is set, the page will load the count from Supabase and call `increment_download_count` when the user clicks “Download APK”, then start the download. If not set, the page falls back to `./stats.json` and the link works as a normal download (no increment).

3. **App:** The app already reads the count from Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set; otherwise it uses `stats.json`.
