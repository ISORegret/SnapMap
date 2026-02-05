# SnapMap — Photography & Automotive Spot App

Build this app **the same way as PepTalk**: Vite + React, PWA, then Capacitor for native (Android/iOS). This folder lives **outside** PepTalk so the two projects stay separate.

**App name:** **SnapMap** ✓

---

## 1. App name (chosen: SnapMap)

Other options considered (for reference):

### Photography + location
| Name | Why it works |
|------|----------------|
| **FrameScout** | Scouting frames/shots; short, memorable. |
| **LensSpot** | Lens + spot; good for photo + automotive. |
| **ShotPin** | Pin spots on a map; “shot” = photo. |
| **SnapMap** | Snap + map (check trademark if you care). |
| **ScoutFrame** | Scouting locations for the frame. |

### Automotive-focused
| Name | Why it works |
|------|----------------|
| **DriveFrame** | Driving + framing the shot. |
| **CarScout** | Direct; car + location scouting. |
| **WheelSpot** | Wheels + spot; car vibe. |
| **GaragePin** | Pin spots; “garage” = car culture. |

### Neutral / multi-use
| Name | Why it works |
|------|----------------|
| **SpotStack** | Stack of spots; works for any niche. |
| **PinFrame** | Pin + frame; photo + map. |
| **Scout** | One word; clean (check availability). |
| **SpotHunt** | Hunting for spots. |

**Chosen:** **SnapMap** — snap + map; short, memorable. (Check trademark if you plan to publish.)

---

## 2. Competitors & what they do well

Research covered: **PhotoHound**, **Atlas Photo**, **Explorest**, **LensScape**, **LocationScout**, **GoSnap**, **ShotHotspot**, **MapAPic**, **PhotoPills**, **MapAPic**.

### PhotoHound
- World map, 10k+ spots, 54k+ images, 161 countries.
- **Parking**, trail starts, **exact coordinates**, directions.
- **Golden hour / sunrise–sunset** at each spot.
- **7-day weather**, multiple models, rain radar.
- **Webcams** near locations.
- **Collections** for trip planning; save spots.
- **Google Maps / Waze / What3Words** for navigation.
- Local tips, gear, EXIF from other photographers.
- iOS & Android.

### Atlas Photo
- **GPS**, **lighting predictions**, community photos.
- **Golden hour & sunset times** per location.
- 50k+ photographers; 3-day free trial.

### LensScape
- 261k+ locations, 310 cities; **production-ready** spots.
- **GPS**, **sun path**, **golden hour** preview.
- **Weather** and **crowd levels**.
- Filter: terrain, lighting, **accessibility**, permits, ratings.
- **Shot lists**, **boards**, notes; add new locations.
- iOS + web; Android offered.

### LocationScout (locationscout.net)
- **Scale:** 219k–243k entries worldwide (locations, countries, photo themes); 139k+ users.
- **Messaging:** “The best places for photography and travel”; “Get exact geo-positions for the world’s most beautiful photo spots”; “No matter where you are, you always know the best spots”; “Say goodbye to endless searching” / **“Plan less, travel more.”**; “Craft your dream itinerary”; “The World in your Pocket” (app).
- **Features:** Exact coordinates, photo tips, travel info; real-time discovery around you or a destination; **crowd levels**, **best visiting times**, sunrise/sunset; **navigation** (Apple/Google Maps, Waze) — users cite “navigation to the spot” as a killer feature; **private/public boards** for bookmarking and trip planning; synced across devices; Learn section (tutorials). Premium: “Around Me”, direct GPS to location.
- **UI (2025–2026):** Floating bottom nav; unified search with filters; **location type badges** below spot names; infinite scroll + lazy loading; profile/settings top-right.
- **Takeaways for SnapMap:** Lead with “best places” + exact geo; emphasize “plan less, travel more” and “craft your itinerary” (Saved = boards); push “Open in Maps” as a key action; consider location-type badges (tags) under spot names.

### GoSnap
- **Community** spots and real photos per spot.
- Access info, **best times**, tips from community.

### ShotHotspot
- **Search**: keywords, style, distance, match strength; **draw a box on map** to search area.
- **User-added** hotspots; edit type, best times, gear, cost, description.
- Data from Flickr/Panoramio; crowdsourced corrections.

### MapAPic (photographer-made)
- **Geotags**, **photos**, **tags**, **notes** per location.
- **Sunrise/sunset**, **golden hour**, **blue hour** for saved spots.
- Organize shoot locations.

### PhotoPills
- **Planner**: best location for a time, or best time for a location; **sun/moon**, shadows, Milky Way on map.
- **10.5k+** locations linked to Wikipedia.
- On-location tools; lens selection by composition.

---

## 3. Best features to implement (for your app)

Prioritized for a **PepTalk-style** build (Vite + React, PWA, then native), with focus on **automotive + general photo spots**.

### Must-have (v1)
| Feature | Why |
|--------|-----|
| **Map of spots** | Browse by map (e.g. Leaflet/OSM or similar). |
| **Spot detail** | Name, address/area, **coordinates**, one or more **photos**, short description. |
| **Best time** | Golden hour, sunrise/sunset, or simple “best time” text (e.g. “Golden hour”, “Blue hour”). |
| **Save / favorites** | Save spots per user (local first, like PepTalk). |
| **Add your own spots** | User-added spots (local storage first; backend later). |
| **Categories/tags** | e.g. Automotive, Landscape, Urban, so you can filter. |

### Strong next (v2)
| Feature | Why |
|--------|-----|
| **Sunrise/sunset at spot** | Use lat/lng + date (e.g. suncalc) to show “best light” window. |
| **Directions** | Open in Google Maps / Apple Maps / Waze (link out). |
| **Parking note** | Optional “parking” field per spot. |
| **Weather** | Simple forecast or “check weather” link for the area. |
| **Collections / lists** | e.g. “Weekend road trip”, “Car spots Bay Area”. |

### Nice-to-have (v3+)
| Feature | Why |
|--------|-----|
| **Crowd level** | Quiet / busy (user-reported or placeholder). |
| **Filters** | By tag, distance, “has parking”, “good for cars”. |
| **Offline** | PWA cache + service worker so map and saved spots work offline. |
| **Share spot** | Share link or “Copy coordinates”. |
| **Photo upload** | User photos per spot (needs backend or base64/local). |
| **Webcams / external links** | Link to a nearby webcam or resource. |

### Backend (when you add “for other users”)
- **Auth** (email or social).
- **Spots in DB** (not only on device): public + user-created.
- **Sync** saved spots and collections across devices.
- **Moderation** if spots are public (optional).

---

## 4. Tech stack (match PepTalk)

| Layer | Choice |
|-------|--------|
| **Frontend** | Vite + React |
| **Routing** | React Router (HashRouter for Capacitor) |
| **Map** | Leaflet + OpenStreetMap (no API key) |
| **Styling** | Tailwind (or plain CSS to start) |
| **Data (v1)** | Local only: `localStorage` (like PepTalk) |
| **PWA** | manifest.json, service worker, install prompt |
| **Native** | Capacitor (Android first, then iOS if needed) |
| **Backend (later)** | Supabase, Firebase, or your own API |

---

## 5. Folder structure (when you start)

Keep this folder as the **single app** (sibling to PepTalk). When you create the repo:

- **Option A:** Rename this folder to **SnapMap** and use it as the repo root (init git here).
- **Option B:** Create GitHub repo **SnapMap**, clone into a folder named **SnapMap**, then copy this PLAN and build there.

Suggested structure (same idea as PepTalk):

```
SnapMap/   (repo name = app name)
├── public/         # manifest.json, icons, service-worker.js
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── data/       # curated spots, spotStore (localStorage)
│   ├── pages/      # Map, Feed, Add, Saved, SpotDetail
│   └── ...
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── capacitor.config.json
├── android/        # after: npx cap add android
└── PLAN.md         # this file
```

---

## 6. Next steps

1. **App name:** SnapMap ✓
2. **Create GitHub repo** (e.g. `SnapMap`).
3. **Scaffold** Vite + React in this folder (or in the new repo).
4. **Implement** must-have features (§3) with local-only data.
5. **Add PWA** (manifest + service worker).
6. **Add Capacitor** and build Android app; then backend when you want multi-user.

Use this PLAN as the feature and tech checklist when you build.
