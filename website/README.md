# SnapMap landing site

Static marketing/launch page (PepTalk-style). Deploy with **Cloudflare Pages**.

## Cloudflare Pages

- **Build command:** leave empty (static site, no build).
- **Build output directory:** `website`  
  (So the *contents* of this folder are the site root: `index.html`, `favicon.svg`, `SnapMap.apk`.)

Push to your connected branch; Cloudflare will deploy the `website` folder.

## APK

“Download APK” links to `./SnapMap.apk`. Add your built APK here (e.g. copy from `android/app/build/outputs/apk/debug/app-debug.apk` and rename to `SnapMap.apk`).
