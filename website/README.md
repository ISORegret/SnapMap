# SnapMap landing site

Static marketing page deployed with the app by GitHub Pages.

The deployment workflow copies the built app to `website/app/`, then publishes this directory.

## APK

"Download APK" links to `./snapmap.apk`. Replace that file with the latest signed build when publishing an Android release.

The landing page reads `app/version.json` at runtime, so the displayed version follows the deployed app build.
