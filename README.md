# SnapMap

Photography & automotive location spotting app — find and save photo spots, built the same way as **PepTalk**: Vite + React → PWA → Capacitor for native.

This folder is **separate from PepTalk** so the two projects stay independent.

---

## Status

- **App name:** SnapMap ✓
- **Planning:** See [PLAN.md](./PLAN.md) for competitor research, feature list, tech stack, and next steps.

---

## Test on phone or emulator

- **Chrome device emulation (no setup):** Run `npm run dev`, open the app in Chrome, press **F12** → click the device icon (or **Ctrl+Shift+M**). Pick a phone (e.g. iPhone 14, Pixel 7) to see the mobile layout.
- **Real phone on same WiFi:** Run `npm run dev:phone`. In the terminal you’ll see a **Network** URL (e.g. `http://192.168.1.x:5173`). Open that URL on your phone’s browser to use the app like on a device.
- **Android (native build):** Capacitor + Android are set up. Build the web app, sync, then open in Android Studio:
  1. `npm run build:android` — builds for Android and syncs to the `android` folder.
  2. `npm run cap:open:android` — opens the project in Android Studio (or open `android/` in Android Studio).
  3. In Android Studio: pick an emulator or connected device and run (green Play).  
  After code changes, run `npm run build:android` again (or `npm run build -- --mode android` then `npm run cap:sync`), then run from Android Studio.

- **Get an APK (installable file):** Run `npm run build:apk` from the project root. The APK is at **`android/app/build/outputs/apk/debug/app-debug.apk`**. Copy it to your phone and open it to install (enable “Install from unknown sources” if prompted), or run from Android Studio with a device connected.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local dev server |
| `npm run dev:phone` | Dev server with network URL for phone browser |
| `npm run build` | Production build (e.g. for GitHub Pages) |
| `npm run build:android` | Build for Android + sync to native project |
| `npm run cap:sync` | Sync `dist` to Android (after a build) |
| `npm run cap:open:android` | Open Android project in Android Studio |
| `npm run build:apk` | Build web app + sync + assemble debug APK |

---

## Share APK on the website (like PepTalk)

The site can show a **Download Android app (APK)** link that points to the latest GitHub Release.

1. **Create a release with an APK**
   - **Option A (recommended):** Push a version tag to trigger the workflow:
     ```bash
     git tag v1.0.0
     git push origin v1.0.0
     ```
     The workflow builds the APK and creates a release with asset **SnapMap.apk**.
   - **Option B:** Run the workflow manually: **Actions → Build and release APK → Run workflow**. The APK is uploaded as a workflow artifact (download from the run). To have it on Releases, create a release in the repo and upload the APK, or use Option A.

2. **Download URL**
   - After at least one release with `SnapMap.apk`, the link on the site goes to:
   - **https://github.com/OWNER/SnapMap/releases/latest/download/SnapMap.apk**
   - The deployed site (GitHub Pages) gets `VITE_GITHUB_REPO` from the workflow, so the “Download Android app” button on the front page uses the correct repo automatically.

3. **Local dev**
   - To show the button locally, add to `.env`: `VITE_GITHUB_REPO=YOUR_USERNAME/SnapMap`

---

## Next steps

- Run on Android emulator or device (see above).
- Backend when you want sync / multi-user (see [PLAN.md](./PLAN.md)).
