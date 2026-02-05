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
- **Android emulator (native build):** Add Capacitor, then build and run in Android Studio’s emulator (see PLAN.md).

---

## Next steps

1. Create a GitHub repo (e.g. **SnapMap**).
2. Scaffold with Vite + React; implement map, spots, save/favorites, add spot, categories.
3. Add PWA (manifest + service worker).
4. Add Capacitor and build Android (then backend for other users when ready).

Start with [PLAN.md](./PLAN.md).
