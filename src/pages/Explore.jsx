import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Heart, Star, Search, Info } from 'lucide-react';
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
    <div className="min-h-screen pb-24">
      {/* Compact header */}
      <header className="sticky top-0 z-10 border-b border-white/[0.08] px-4 py-4" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Explore</h1>
            <p className="mt-0.5 text-sm text-slate-500">Find spots near you or browse by category</p>
          </div>
          <Link
            to="/about"
            className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-white/10 hover:text-accent-400"
            aria-label="About SnapMap"
          >
            <Info className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spots…"
            className="w-full rounded-xl border border-white/10 bg-[#1a191f] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
      </header>

      <div className="px-4 py-4 space-y-8">
        {/* Near you - horizontal scroll */}
        {userPosition && nearYouSpots.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Near you</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1">
              {nearYouSpots.map((spot) => {
                const km = haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude);
                const dist = units === 'km' ? `${km.toFixed(1)} km` : `${kmToMi(km).toFixed(1)} mi`;
                return (
                  <Link
                    key={spot.id}
                    to={`/spot/${spot.id}`}
                    className="group shrink-0 w-[160px] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#1a191f] transition hover:border-accent-500/30"
                  >
                    <div className="aspect-[4/3] relative">
                      <img
                        src={getSpotPrimaryImage(spot)}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="font-semibold text-white text-sm truncate">{spot.name}</p>
                        <p className="text-xs text-slate-300">{dist} away</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Category chips */}
        <section>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  category === c.id ? 'bg-accent-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/15'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Full-width image cards */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {category === 'all' ? 'All spots' : CATEGORIES.find((c) => c.id === category)?.label}
          </h2>
          {filteredSpots.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No spots match. Try another category or search.</p>
          ) : (
            <div className="space-y-4">
              {filteredSpots.map((spot) => {
                const r = spotRatings[spot.id];
                const avg = r?.average ?? 0;
                return (
                  <Link
                    key={spot.id}
                    to={`/spot/${spot.id}`}
                    className="group block rounded-2xl overflow-hidden border border-white/[0.08] bg-[#1a191f] transition hover:border-accent-500/30"
                  >
                    <div className="aspect-[16/10] relative">
                      <img
                        src={getSpotPrimaryImage(spot)}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); toggleFavorite(spot.id); }}
                        className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
                        aria-label="Save"
                      >
                        <Heart
                          className="h-4 w-4"
                          fill={favoriteIds.includes(spot.id) ? '#f43f5e' : 'transparent'}
                          stroke={favoriteIds.includes(spot.id) ? '#f43f5e' : 'currentColor'}
                          strokeWidth={2}
                        />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white text-lg">{spot.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-300">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {spot.address && spot.address !== 'Not specified'
                            ? spot.address
                            : spot.latitude != null && spot.longitude != null
                              ? `${Number(spot.latitude).toFixed(2)}, ${Number(spot.longitude).toFixed(2)}`
                              : '—'}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                          {r?.count > 0 && (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className="h-3 w-3"
                                  fill={star <= Math.round(avg) ? 'currentColor' : 'transparent'}
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                />
                              ))}
                              <span className="text-slate-400 ml-0.5">{avg.toFixed(1)}</span>
                            </span>
                          )}
                          {spot.bestTime && spot.bestTime !== 'Not specified' && (
                            <span>{spot.bestTime}</span>
                          )}
                          {spot.createdBy && (
                            <span>by @{String(spot.createdBy).trim()}</span>
                          )}
                        </div>
                      </div>
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
