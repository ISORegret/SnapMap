# SnapMap UI vs location / spot / parking finders

Comparison of SnapMap’s UI with photo-spot apps (LensScape, LocationScout, PhotoPills, MapAPic), parking finders (SpotHero, ParkWhiz), and map UI patterns (Map UI Patterns). Use this to align with common patterns and prioritize changes.

---

## 1. Competitor UI patterns (summary)

### Photo & location spot apps

| App | UI strengths |
|-----|----------------|
| **LensScape** | Map-first discovery, nearby search, filters (terrain/lighting/accessibility), save boards & shot lists, sunrise/sunset previews, live weather, crowd levels, smart caching, community contribution. |
| **LocationScout** | Floating bottom nav; unified search with type filters (all / locations / countries / themes); **location-type badges below spot names**; infinite scroll + lazy loading; profile/settings top-right; “Open in Maps” as key action; boards for trip planning. |
| **PhotoPills** | Toolbox of “pills”; Planner = top panels + map + time bar + options; sun/moon/Milky Way on map; AR on location; widgets for quick sun/moon data. |
| **MapAPic** | List + map (list or map view); tagging, filtering, EXIF GPS import; sunrise/sunset per spot. |
| **NoFilter** | World map with geotagged spots and sample images from photographers. |

### Parking finders (SpotHero, ParkWhiz)

- **Bottom-positioned search** for one-handed access.
- **2-tap rebooking**: recent reservations, rebook with auto-filled times.
- **Favorites** for quick rebook.
- **Event parking**: auto-fill time frames for venue.
- **Flow**: Look → Book → Park (compare rates, pre-pay, follow directions).

### Map UI Patterns (mapuipatterns.com)

- **Location list**: List + map with a **key** linking list items to markers (e.g. numbers); **data brushing** (hover list → highlight marker, hover marker → highlight list).
- **List content**: Names, addresses, **status**, **metrics** (e.g. distance to user), **actions** (zoom to item, view details, edit).
- **Layouts**: List superposed on map (full map) or list + map side-by-side (partial map).
- **Extent-driven content**: Option to show only items visible in current map extent.

---

## 2. SnapMap current UI (what you have)

| Area | What SnapMap does |
|------|--------------------|
| **Nav** | Fixed bottom nav: For You (count), Map, Add, Saved. Version + “Update available” under nav. |
| **Feed (For You)** | Centered header (logo + “SnapMap”, tagline, Refresh); search bar; **Filter / Distance / Sort** in one row (popovers); “For You” section label + spot count + active filters; **card list**: image (16×20), name, address/coords, best time; link to spot detail. |
| **Map** | Full-width map; **floating filter + distance pills** (top-left, over map); clusters; click map → “Add spot” with pin; select marker → bottom sheet / detail. Filter by category + distance. |
| **Spot detail** | Back; image gallery (swipe); name, address; Open in Maps; sunrise/sunset; weather; best time; crowd; parking; access; description; tags; “Add to collection”; heart; share; edit; report. |
| **Saved** | Header; search saved; “New list” form; Export (CSV/JSON/link); Favorites list + other collections; spot cards with unsave; shared list via `?ids=`. |
| **Add/Edit** | Form: name, description, address, parking, access, location (Use my location + lat/lng), added by, best time, crowd, photos, tags, link. Validation: name required, valid lat/lng. |

**Shared patterns you already use**

- Bottom nav (like LocationScout / parking apps).
- Search on main screen (unified search).
- Filter + distance + sort in one row (compact, like “unified filters”).
- Map with floating filter chips (like LensScape / map-first apps).
- List of cards with image, name, location, best time (like location list + attributes).
- Spot detail: gallery, key info, Open in Maps, sunrise/sunset, weather (like LensScape/PhotoPills).
- Collections/lists (like LocationScout boards, SpotHero favorites).
- Pull-to-refresh on Feed; location permission modal for Map/Feed.

---

## 3. Gaps and recommendations

### High impact, familiar from competitors

| Gap | Competitor pattern | Recommendation |
|-----|--------------------|-----------------|
| **Location-type badges under spot names** | LocationScout: type/category below name. | On Feed and Spot detail: show **category/tag pills** (e.g. Automotive, Urban) directly under the spot name so type is visible without opening the card. |
| **Distance on list items** | Map UI Patterns: “miles to user” in list. Parking apps: distance to destination. | When user has location: show **“X mi”** (or “X km”) on each Feed card and in Spot detail so “near me” is obvious at a glance. |
| **List ↔ map link** | Map UI Patterns: key + data brushing between list and map. | Optional: **Map + list** view (e.g. half map, half list, or bottom sheet list on Map tab) with **shared selection** (tap card → highlight marker; tap marker → scroll to card). |
| **“Open in Maps” as primary CTA** | LocationScout: navigation as killer feature. | In Spot detail, make **Open in Maps** the main button (top or sticky) so it’s the default action for “go there.” |

### Medium impact

| Gap | Competitor pattern | Recommendation |
|-----|--------------------|-----------------|
| **Floating / compact nav** | LocationScout: floating bottom nav for more space. | Consider a **floating pill** nav (rounded bar with icons) with slight inset and shadow so the map/content feels larger. |
| **Unified search + instant type filter** | LocationScout: search with filter by type (all / locations / themes). | Add **quick filter chips** next to or under search (e.g. All, Automotive, Urban) so “search + filter by type” is one place. |
| **Lazy loading / infinite scroll** | LocationScout, LensScape: infinite scroll, lazy images. | For large lists, **virtualize** or **lazy-load** Feed cards and images so scroll stays smooth and data usage is lower. |
| **Spot count / result summary** | Store locators: “N results” near search. | You have “For You” + count; consider **“N spots”** or **“N near you”** in the header or right under search so the scope is clear. |

### Lower priority / polish

| Gap | Competitor pattern | Recommendation |
|-----|--------------------|-----------------|
| **Profile/settings in corner** | LocationScout: profile/settings top-right. | If you add profile or theme/settings, put them **top-right** on Feed/Map to match. |
| **Extent-driven list** | Map UI Patterns: “only show items in map extent.” | On a future Map+list view: optional **“Only spots in map”** to sync list with visible area. |
| **Status or planning cues** | Map UI Patterns: status (open/closed); planning (distance). | You have crowd level and best time; consider **simple status** (e.g. “Open 24/7” / “Check hours”) if you add hours data. |

---

## 4. Quick wins (minimal code, big clarity)

1. **Category/tag pills under spot name** on Feed cards and Spot detail header (you have tags/categories; just surface them under the title).
2. **Distance on cards**: when `userPosition` exists, show “2.3 mi” (or km) on each Feed card and in Spot detail so “near me” is visible without opening the card.
3. **“Open in Maps” as primary CTA** on Spot detail: move or duplicate the button to the top of the content or make it a sticky bar so it’s the first action.

---

## 5. References

- **Map UI Patterns – Location list**: [mapuipatterns.com/location-list](https://mapuipatterns.com/location-list) (list + map, key, data brushing).
- **PLAN.md**: LensScape, LocationScout, PhotoPills, MapAPic, GoSnap, ShotHotspot (features and takeaways).
- **SpotHero / ParkWhiz**: Bottom search, 2-tap rebook, favorites, Look→Book→Park flow.
- **LocationScout 2025–2026**: Floating nav, unified search, location-type badges, infinite scroll, profile top-right.

Use this doc to pick the next UI improvements (e.g. badges + distance + “Open in Maps” as first step) and to keep wording and layout consistent with “location finder” and “spot finder” apps.
