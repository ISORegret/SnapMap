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

## CORS and “Share as image”

The **Share as image** feature fetches the spot’s photo (e.g. from Supabase Storage or Unsplash) and draws it into a card. That `fetch()` is cross-origin, so the image server must allow CORS from your app’s origin. **Supabase does not expose CORS settings in the dashboard**, so for Supabase Storage URLs the app uses an **image-proxy** Edge Function that fetches the image server-side and returns it with CORS headers.

### Deploy the image-proxy function (Supabase Storage)

If spot images use **Supabase Storage** (`https://<project>.supabase.co/storage/...`), deploy the included proxy so Share as image works:

1. **Install the Supabase CLI** (one of these):
   - **npm global:** `npm install -g supabase` (then use `supabase` in the steps below).
   - **Or use npx** (no install): run `npx supabase` instead of `supabase` in the steps below.

2. **Log in:** `supabase login` (or `npx supabase login`). A browser window will open to authenticate.

3. **Link your project:**  
   Get your **project ref** from the Supabase dashboard URL:  
   `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`  
   The ref is the part after `/project/` (e.g. `abcdefghijklmnop`). Then run:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Replace `YOUR_PROJECT_REF` with that value (no angle brackets).

4. **Deploy:** `supabase functions deploy image-proxy`.

The app will use `.../functions/v1/image-proxy?url=<image-url>` (with your anon key) when the image URL is from Supabase, so the shared card shows the photo instead of black.

### When do you need this?

- If **Share as image** works but the shared picture is **black**, the image URL is likely blocked by CORS (canvas is tainted). For Supabase Storage: deploy the `image-proxy` function above.

### 2. Images from other hosts (e.g. Unsplash)

For URLs like `https://images.unsplash.com/...`:

- The host must respond with `Access-Control-Allow-Origin` including your app’s origin or `*`.
- Unsplash’s API and CDN often allow CORS for common use; if not, use their recommended domain or API.
- You cannot change CORS on someone else’s server; you’d need a proxy (e.g. your own backend or Edge Function) that fetches the image and serves it with CORS headers.

### 3. Your app’s origin

- **Web (e.g. GitHub Pages):** `https://your-username.github.io` (or your custom domain).
- **Capacitor (Android/iOS):** `capacitor://localhost` or `http://localhost` (check in the app; the WebView uses one of these).

The image server’s `Access-Control-Allow-Origin` must include that origin (or be `*`).

### 4. How to check CORS

1. Open DevTools → **Network**.
2. In the app, tap **Share as image** (so it runs the fetch).
3. Find the request to the image URL (e.g. `...supabase.co/storage/...` or `images.unsplash.com`).
4. If it fails with a CORS error in the console, or the response headers don’t include `Access-Control-Allow-Origin`, the server is blocking the request. Fix CORS on that server (or use a proxy that adds the header).
