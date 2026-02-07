# Settings ideas

Settings that make the app feel different or more configurable. Some are already in place.

## Implemented

- **Theme** — Light / dark. Toggle in settings (Feed & Map).
- **Distance units** — Miles / km. Toggle in settings (Feed & Map). Affects distance on cards and Spot detail.
- **Download count** — Shown in settings (Feed & Map) and on the website under the download button. Update `public/stats.json` and `website/stats.json` (same `downloads` number) when you have new numbers.

## Easy adds

- **Default sort** — Remember last sort (newest, score, name, near me, best time) so Feed opens with that order.
- **Default map zoom** — Remember preferred default zoom when opening Map.
- **Show/hide distance on cards** — When you have location, always show “X mi away” or hide it for a cleaner list.

## Medium effort

- **Notifications** — Optional “Best time today” reminder for saved spots (would need permission and a simple scheduler).
- **Data saver** — Lower image quality or lazy-load images to reduce data usage.
- **Default filter** — Remember last category/distance filter (e.g. “Has parking” or “Within 10 mi”) when opening Feed or Map.

## Polish / later

- **Language / locale** — If you add i18n, a setting to pick language.
- **Map style** — If you add multiple tile layers (e.g. satellite, dark), a setting to pick default.
- **Spot count in nav** — Show “For You (N)” in nav; optional setting to hide the count.
- **First-day prompt** — One-time “Allow location for distance?” with a “Don’t ask again” option stored in localStorage.

Update this list as you ship or deprioritize items.
