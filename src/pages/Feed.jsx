import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight, Search } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { getSpotPrimaryImage } from '../utils/spotImages';

function matchesSearch(spot, q) {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().trim();
  const name = (spot.name || '').toLowerCase();
  const address = (spot.address || '').toLowerCase();
  const desc = (spot.description || '').toLowerCase();
  const tags = (spot.tags || []).join(' ').toLowerCase();
  return name.includes(lower) || address.includes(lower) || desc.includes(lower) || tags.includes(lower);
}

function hasParking(spot) {
  return Boolean(spot.parking && String(spot.parking).trim());
}

// Single filter: 'all' | 'hasParking' | categoryId (automotive, urban, ...)
function applyFilter(spots, filter) {
  if (filter === 'all') return spots;
  if (filter === 'hasParking') return spots.filter(hasParking);
  return spots.filter((s) => matchesCategory(s, filter));
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'hasParking', label: 'Has parking' },
  ...CATEGORIES.filter((c) => c.id !== 'all'),
];

export default function Feed({ allSpots, favoriteIds, toggleFavorite, addError, onDismissAddError }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSpots = useMemo(() => applyFilter(allSpots, filter), [allSpots, filter]);
  const displaySpots = useMemo(
    () => filteredSpots.filter((s) => matchesSearch(s, searchQuery)),
    [filteredSpots, searchQuery]
  );

  return (
    <div className="min-h-[calc(100vh-56px)] pb-6">
      {addError && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-amber-200 flex-1 min-w-0">
            Saved on device only. Couldn&apos;t sync to cloud: {addError}
          </p>
          <button
            type="button"
            onClick={onDismissAddError}
            className="shrink-0 rounded px-2 py-1 text-amber-300 hover:bg-amber-500/20 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* App title + tagline */}
      <header className="relative border-b border-emerald-500/10 bg-gradient-to-b from-emerald-950/30 to-transparent px-4 pt-6 pb-5 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(52,211,153,0.08),transparent)] pointer-events-none" />
        <h1 className="relative text-2xl font-bold tracking-tight text-gradient">
          SnapMap
        </h1>
        <p className="relative mt-0.5 text-sm font-medium text-emerald-400">
          The best places for photography and cars
        </p>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-slate-400 leading-relaxed">
          Exact geo-positions, best times, and directions. Save spots to your list, open in Maps, and plan less — travel more.
        </p>
      </header>

      {/* Single filter row: All, Has parking, categories */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Filter
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                filter === opt.id
                  ? 'bg-emerald-500 text-white shadow-glow-sm'
                  : 'bg-white/5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border border border-transparent hover:border-emerald-500/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spots by name, address, tags…"
            className="w-full rounded-xl border border-white/10 bg-[#151a18] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          For You
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {displaySpots.length} spot{displaySpots.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` · ${FILTER_OPTIONS.find((o) => o.id === filter)?.label}`}
          {searchQuery.trim() && ` · "${searchQuery.trim()}"`}
        </p>
      </div>

      {/* Spot cards — image-first, title, description, tags, location */}
      <ul className="space-y-3 px-4 pt-2">
        {displaySpots.map((spot) => (
          <li key={spot.id}>
            <Link
              to={`/spot/${spot.id}`}
              className="group flex gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#151a18] transition-all duration-200 hover:border-emerald-500/30 hover:bg-[#1a211e] hover:shadow-glow-sm"
            >
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                <img
                  src={getSpotPrimaryImage(spot)}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(spot.id);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white backdrop-blur-sm transition hover:bg-black/70"
                  aria-label={favoriteIds.includes(spot.id) ? 'Unsave' : 'Save'}
                >
                  <Heart
                    className="h-3 w-3"
                    fill={favoriteIds.includes(spot.id) ? '#f43f5e' : 'transparent'}
                    stroke={favoriteIds.includes(spot.id) ? '#f43f5e' : 'currentColor'}
                    strokeWidth={2}
                  />
                </button>
              </div>
              <div className="min-w-0 flex-1 py-2 pr-3">
                <h3 className="font-semibold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                  {spot.name}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 line-clamp-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {(spot.address && spot.address !== 'Not specified')
                    ? spot.address
                    : (spot.latitude != null && spot.longitude != null
                      ? `${Number(spot.latitude).toFixed(2)}, ${Number(spot.longitude).toFixed(2)}`
                      : '—')}
                </p>
                {spot.description && spot.description !== 'Not specified' && (
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                    {spot.description}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {spot.bestTime && spot.bestTime !== 'Not specified' ? spot.bestTime : ''}
                    {spot.score != null && spot.score > 0 && (
                      <span className="ml-1 text-emerald-400">· {spot.score}</span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {displaySpots.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          {searchQuery.trim()
            ? `No spots match "${searchQuery.trim()}". Try another search or filter.`
            : filter !== 'all'
              ? `No spots match this filter. Try "All" or add a spot from the map.`
              : 'No spots yet. Add one from the map or the Add tab.'}
        </p>
      )}
    </div>
  );
}
