import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Heart, Star, Search, Info, ArrowUpRight, Navigation } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { haversineKm, getCurrentPosition, kmToMi } from '../utils/geo';
import { getSpotRatingsForSpotIds } from '../api/ratings';
import { hasSupabase } from '../api/supabase';

function matchesSearch(spot, q) {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().trim();
  return (
    (spot.name || '').toLowerCase().includes(lower) ||
    (spot.address || '').toLowerCase().includes(lower) ||
    (spot.description || '').toLowerCase().includes(lower) ||
    (spot.tags || []).join(' ').toLowerCase().includes(lower)
  );
}

export default function Explore({
  allSpots,
  favoriteIds,
  toggleFavorite,
  onDismissSpotError,
  userPosition: userPositionProp = null,
  requestPosition: requestPositionProp,
  units = 'mi',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [spotRatings, setSpotRatings] = useState({});
  const userPosition = userPositionProp;

  useEffect(() => {
    requestPositionProp?.();
  }, [requestPositionProp]);

  const filteredSpots = useMemo(() => {
    let list = allSpots.filter((s) => matchesCategory(s, category) && matchesSearch(s, searchQuery));
    if (userPosition) {
      list = list
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          spot: s,
          km: haversineKm(userPosition.lat, userPosition.lng, s.latitude, s.longitude),
        }))
        .sort((a, b) => a.km - b.km)
        .map((x) => x.spot);
    } else {
      list = [...list].sort((a, b) => {
        const aAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bAt - aAt;
      });
    }
    return list;
  }, [allSpots, category, searchQuery, userPosition]);

  const nearYouSpots = useMemo(() => {
    if (!userPosition || allSpots.length === 0) return [];
    return allSpots
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({ spot: s, km: haversineKm(userPosition.lat, userPosition.lng, s.latitude, s.longitude) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 8)
      .map((x) => x.spot);
  }, [allSpots, userPosition]);

  useEffect(() => {
    if (!hasSupabase || filteredSpots.length === 0) {
      setSpotRatings({});
      return;
    }
    let cancelled = false;
    getSpotRatingsForSpotIds(filteredSpots.map((s) => s.id)).then((obj) => {
      if (!cancelled) setSpotRatings(obj);
    });
    return () => { cancelled = true; };
  }, [filteredSpots]);

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Spot directory</p>
              <h1 className="mt-1 text-[2rem] font-extrabold leading-none tracking-[-0.045em] text-primary sm:text-4xl">
                Find the frame.
              </h1>
              <p className="mt-2 text-sm font-medium text-muted">
                {allSpots.length} community locations ready to explore
              </p>
            </div>
            <Link to="/about" className="icon-button h-11 w-11 shrink-0 rounded-2xl" aria-label="About SnapMap">
              <Info className="h-5 w-5" />
            </Link>
          </div>

          <div className="surface-card relative mt-5 rounded-[1.25rem] p-1.5">
            <Search className="absolute left-5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations, cities, or tags"
              className="surface-input w-full rounded-2xl border-0 py-3.5 pl-12 pr-4 text-sm font-semibold placeholder:text-[var(--text-muted)] focus:shadow-none"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-6">
        {userPosition && nearYouSpots.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="eyebrow">Closest first</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Near you</h2>
              </div>
              <Navigation className="h-5 w-5 text-accent-400" />
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:-mx-1 md:px-1">
              {nearYouSpots.map((spot) => {
                const km = haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude);
                const dist = units === 'km' ? `${km.toFixed(1)} km` : `${kmToMi(km).toFixed(1)} mi`;
                return (
                  <Link key={spot.id} to={`/spot/${spot.id}`} className="surface-card group relative aspect-[4/5] w-[13.5rem] shrink-0 snap-start overflow-hidden rounded-[1.5rem]">
                    <img src={getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-black/10" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <span className="inline-flex rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#211603]">{dist}</span>
                      <p className="mt-2 truncate text-base font-extrabold text-white">{spot.name}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-white/60">{spot.address || 'Pinned location'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-extrabold transition ${
                  category === c.id
                    ? 'border-accent-500 bg-accent-500 text-[#211603] shadow-glow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-input)] text-secondary hover:border-[var(--border-strong)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Curated by the community</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">
                {category === 'all' ? 'All spots' : CATEGORIES.find((c) => c.id === category)?.label}
              </h2>
            </div>
            <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold text-muted">
              {filteredSpots.length}
            </span>
          </div>

          {filteredSpots.length === 0 ? (
            <div className="surface-card rounded-[1.5rem] px-6 py-16 text-center">
              <Search className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-4 font-bold text-primary">Nothing matched that search</p>
              <p className="mt-1 text-sm text-muted">Try another category or a broader location.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredSpots.map((spot) => {
                const r = spotRatings[spot.id];
                const avg = r?.average ?? 0;
                return (
                  <Link key={spot.id} to={`/spot/${spot.id}`} className="surface-card group overflow-hidden rounded-[1.6rem] transition duration-300 hover:-translate-y-0.5 hover:border-accent-500/30">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img src={getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/15" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); toggleFavorite(spot.id); }}
                        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-black/45 text-white backdrop-blur-xl transition hover:scale-105"
                        aria-label={favoriteIds.includes(spot.id) ? 'Remove from saved' : 'Save spot'}
                      >
                        <Heart className="h-[1.1rem] w-[1.1rem]" fill={favoriteIds.includes(spot.id) ? '#ff5d73' : 'transparent'} stroke={favoriteIds.includes(spot.id) ? '#ff5d73' : 'currentColor'} strokeWidth={2.2} />
                      </button>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        {r?.count > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-lg">
                            <Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" /> {avg.toFixed(1)}
                          </span>
                        )}
                        {spot.bestTime && spot.bestTime !== 'Not specified' && (
                          <span className="max-w-[12rem] truncate rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white/80 backdrop-blur-lg">{spot.bestTime}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-extrabold tracking-tight text-primary">{spot.name}</h3>
                        <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-muted">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-400" />
                          <span className="truncate">{spot.address && spot.address !== 'Not specified' ? spot.address : 'Pinned location'}</span>
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-accent-400 transition group-hover:bg-accent-500 group-hover:text-[#211603]">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
