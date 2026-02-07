import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight, Search, RefreshCw, ExternalLink, MapPinOff, ChevronDown } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { getSpotPrimaryImage, getSpotImages } from '../utils/spotImages';
import { haversineKm, getCurrentPosition, DISTANCE_OPTIONS_MI, milesToKm } from '../utils/geo';

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

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'score', label: 'Score' },
  { id: 'name', label: 'Name' },
  { id: 'bestTime', label: 'Best time' },
  { id: 'nearMe', label: 'Near me' },
];

const BEST_TIME_ORDER = ['Morning', 'Golden hour', 'Blue hour', 'Sunset', 'Night', 'Anytime'];

function applySort(spots, sortId, userPosition) {
  const list = [...spots];
  if (sortId === 'newest') {
    list.sort((a, b) => {
      const aAt = a.createdAt ? new Date(a.createdAt).getTime() : (a.id && typeof a.id === 'string' && a.id.startsWith('user-') ? parseInt(a.id.replace('user-', ''), 10) : 0);
      const bAt = b.createdAt ? new Date(b.createdAt).getTime() : (b.id && typeof b.id === 'string' && b.id.startsWith('user-') ? parseInt(b.id.replace('user-', ''), 10) : 0);
      return bAt - aAt;
    });
  } else if (sortId === 'score') {
    list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  } else if (sortId === 'name') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  } else if (sortId === 'bestTime') {
    list.sort((a, b) => {
      const ai = BEST_TIME_ORDER.indexOf(a.bestTime || '');
      const bi = BEST_TIME_ORDER.indexOf(b.bestTime || '');
      const aIdx = ai === -1 ? BEST_TIME_ORDER.length : ai;
      const bIdx = bi === -1 ? BEST_TIME_ORDER.length : bi;
      return aIdx - bIdx;
    });
  } else if (sortId === 'nearMe' && userPosition) {
    list.sort((a, b) => {
      const da = haversineKm(userPosition.lat, userPosition.lng, a.latitude, a.longitude);
      const db = haversineKm(userPosition.lat, userPosition.lng, b.latitude, b.longitude);
      return da - db;
    });
  }
  return list;
}

function applyDistanceFilter(spots, userPosition, distanceMi) {
  if (!userPosition || distanceMi == null) return spots;
  const km = milesToKm(distanceMi);
  return spots.filter(
    (s) => haversineKm(userPosition.lat, userPosition.lng, s.latitude, s.longitude) <= km
  );
}

function matchesTag(spot, tag) {
  if (!tag) return true;
  const t = String(tag).toLowerCase().trim();
  return (spot.tags || []).some((x) => String(x).toLowerCase() === t);
}

function openInMaps(spot) {
  const lat = spot.latitude;
  const lng = spot.longitude;
  if (lat == null || lng == null) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lng)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function FeedSkeletonCard() {
  return (
    <li className="flex gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#151a18] p-3">
      <div className="h-16 w-20 shrink-0 animate-pulse rounded-lg bg-white/10" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-white/10" />
        <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
      </div>
    </li>
  );
}

export default function Feed({ allSpots, favoriteIds, toggleFavorite, onDismissSpotError, onRefresh, spotsLoading }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [userPosition, setUserPosition] = useState(null);
  const [distanceFilterMi, setDistanceFilterMi] = useState(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [openPopover, setOpenPopover] = useState(null); // null | 'filter' | 'distance' | 'sort'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);

  const requestPosition = useCallback(async () => {
    if (userPosition) return userPosition;
    setPositionLoading(true);
    const pos = await getCurrentPosition();
    setPositionLoading(false);
    if (pos) setUserPosition(pos);
    return pos;
  }, [userPosition]);

  const setDistanceFilter = useCallback(async (mi) => {
    if (mi === null) {
      setDistanceFilterMi(null);
      return;
    }
    const pos = await requestPosition();
    if (pos) setDistanceFilterMi(mi);
  }, [requestPosition]);

  const setSortNearMe = useCallback(async () => {
    const pos = await requestPosition();
    if (pos) setSort('nearMe');
    setOpenPopover(null);
  }, [requestPosition]);

  const filterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? 'All';
  const distanceLabel = distanceFilterMi == null ? 'All' : `Within ${distanceFilterMi} mi`;
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Newest';

  const handleRefresh = useCallback(() => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    Promise.resolve(onRefresh()).finally(() => setIsRefreshing(false));
  }, [onRefresh, isRefreshing]);

  const onTouchStart = useCallback((e) => {
    if (typeof window === 'undefined' || window.scrollY > 10) return;
    touchStartY.current = e.touches[0].clientY;
    setPullY(0);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (touchStartY.current === 0) return;
    const y = e.touches[0].clientY;
    const delta = y - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta, 80));
    else setPullY(0);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullY >= 50) handleRefresh();
    touchStartY.current = 0;
    setPullY(0);
  }, [pullY, handleRefresh]);

  const filteredSpots = useMemo(() => applyFilter(allSpots, filter), [allSpots, filter]);
  const byDistance = useMemo(
    () => applyDistanceFilter(filteredSpots, userPosition, distanceFilterMi),
    [filteredSpots, userPosition, distanceFilterMi]
  );
  const byTag = useMemo(
    () => (tagFilter ? byDistance.filter((s) => matchesTag(s, tagFilter)) : byDistance),
    [byDistance, tagFilter]
  );
  const bySearch = useMemo(() => byTag.filter((s) => matchesSearch(s, searchQuery)), [byTag, searchQuery]);
  const displaySpots = useMemo(() => applySort(bySearch, sort, userPosition), [bySearch, sort, userPosition]);

  return (
    <div
      className="min-h-[calc(100vh-56px)] pb-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullY > 0 && (
        <div className="flex justify-center py-2 text-emerald-400">
          {pullY >= 50 ? (
            <span className="text-xs font-medium">Release to refresh</span>
          ) : (
            <RefreshCw className="h-4 w-4 animate-pulse" />
          )}
        </div>
      )}
      {/* App title + tagline */}
      <header className="relative border-b border-emerald-500/10 bg-gradient-to-b from-emerald-950/30 to-transparent px-4 pt-6 pb-5 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(52,211,153,0.08),transparent)] pointer-events-none" />
        <h1 className="relative text-2xl font-bold tracking-tight text-gradient">
          SnapMap
        </h1>
        <p className="relative mt-1 text-xs font-medium text-slate-500" aria-hidden="true">
          App v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </p>
        <p className="relative mt-0.5 text-sm font-medium text-emerald-400">
          The best places for photography and cars
        </p>
        <div className="relative mt-2 flex items-center justify-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/10 hover:text-emerald-400 disabled:opacity-50"
              aria-label="Refresh spots"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>
        <p className="relative mx-auto mt-3 max-w-md text-sm text-slate-400 leading-relaxed">
          Exact geo-positions, best times, and directions. Save spots to your list, open in Maps, and plan less — travel more.
        </p>
      </header>

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

      {/* Filter, Distance, Sort — popover selectors */}
      <div className="relative border-b border-white/[0.06] px-4 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'filter' ? null : 'filter')}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition ${
              openPopover === 'filter'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
          >
            <span className="truncate">{filterLabel}</span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${openPopover === 'filter' ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'distance' ? null : 'distance')}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition ${
              openPopover === 'distance'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
          >
            <span className="truncate">{distanceLabel}</span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${openPopover === 'distance' ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'sort' ? null : 'sort')}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition ${
              openPopover === 'sort'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
          >
            <span className="truncate">{sortLabel}</span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${openPopover === 'sort' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {openPopover && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpenPopover(null)}
              aria-hidden
            />
            <div className="absolute left-4 right-4 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#151a18] py-2 shadow-xl">
              {openPopover === 'filter' &&
                FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFilter(opt.id);
                      setOpenPopover(null);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                      filter === opt.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                    {filter === opt.id && <span className="text-emerald-400">✓</span>}
                  </button>
                ))}
              {openPopover === 'distance' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDistanceFilterMi(null);
                      setOpenPopover(null);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                      distanceFilterMi === null ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    All
                    {distanceFilterMi === null && <span className="text-emerald-400">✓</span>}
                  </button>
                  {DISTANCE_OPTIONS_MI.map((mi) => (
                    <button
                      key={mi}
                      type="button"
                      onClick={async () => {
                        await setDistanceFilter(mi);
                        setOpenPopover(null);
                      }}
                      disabled={positionLoading}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                        distanceFilterMi === mi ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Within {mi} mi
                      {distanceFilterMi === mi && <span className="text-emerald-400">✓</span>}
                    </button>
                  ))}
                  {!userPosition && (distanceFilterMi != null || positionLoading) && (
                    <p className="flex items-center gap-1.5 px-4 py-2 text-xs text-slate-500">
                      <MapPinOff className="h-3.5 w-3.5" />
                      Allow location for distance
                    </p>
                  )}
                </>
              )}
              {openPopover === 'sort' &&
                SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={async () => {
                      if (opt.id === 'nearMe') await setSortNearMe();
                      else {
                        setSort(opt.id);
                        setOpenPopover(null);
                      }
                    }}
                    disabled={opt.id === 'nearMe' && positionLoading}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                      sort === opt.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {opt.id === 'nearMe' && positionLoading && !userPosition ? '…' : opt.label}
                    {sort === opt.id && opt.id !== 'nearMe' && <span className="text-emerald-400">✓</span>}
                    {sort === opt.id && opt.id === 'nearMe' && userPosition && <span className="text-emerald-400">✓</span>}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Section label */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          For You
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {displaySpots.length} spot{displaySpots.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` · ${FILTER_OPTIONS.find((o) => o.id === filter)?.label}`}
          {tagFilter && (
            <>
              {' · Tag: '}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-emerald-400">
                {tagFilter}
                <button
                  type="button"
                  onClick={() => setTagFilter('')}
                  className="rounded p-0.5 hover:bg-emerald-500/30"
                  aria-label="Clear tag filter"
                >
                  ×
                </button>
              </span>
            </>
          )}
          {searchQuery.trim() && ` · "${searchQuery.trim()}"`}
        </p>
      </div>

      {/* Spot cards — image-first, title, description, tags, location */}
      <ul className="space-y-3 px-4 pt-2">
        {spotsLoading && displaySpots.length === 0 ? (
          Array.from({ length: 5 }, (_, i) => <FeedSkeletonCard key={`skeleton-${i}`} />)
        ) : (
        displaySpots.map((spot) => (
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
                {(() => {
                  const count = getSpotImages(spot).length;
                  if (count <= 0) return null;
                  return (
                    <span className="absolute bottom-0.5 left-0.5 rounded px-1 text-[10px] font-medium text-white/90 bg-black/50 backdrop-blur-sm">
                      {count} photo{count !== 1 ? 's' : ''}
                    </span>
                  );
                })()}
                {spot.uploadError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-950/95 p-1.5 text-center backdrop-blur-sm">
                    <p className="text-[10px] font-medium leading-tight text-amber-200 line-clamp-3">
                      Couldn&apos;t sync: {spot.uploadError}
                    </p>
                    {onDismissSpotError && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onDismissSpotError(spot.id);
                        }}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}
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
                {spot.tags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {spot.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTagFilter(String(tag).toLowerCase().trim());
                        }}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                          tagFilter && String(tag).toLowerCase() === tagFilter
                            ? 'bg-emerald-500/30 text-emerald-400'
                            : 'bg-white/10 text-slate-500 hover:bg-white/15 hover:text-slate-400'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {spot.bestTime && spot.bestTime !== 'Not specified' ? spot.bestTime : ''}
                    {spot.score != null && spot.score > 0 && (
                      <span className="ml-1 text-emerald-400">· {spot.score}</span>
                    )}
                    {(spot.createdBy != null && String(spot.createdBy).trim()) ? (
                      <span className="ml-1 text-slate-600">· Added by @{String(spot.createdBy).trim()}</span>
                    ) : (
                      <span className="ml-1 text-slate-600">· Anonymous</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {spot.latitude != null && spot.longitude != null && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openInMaps(spot);
                        }}
                        className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-emerald-400"
                        aria-label="Open in Maps"
                        title="Open in Maps"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))
        )}
      </ul>
      {displaySpots.length === 0 && !spotsLoading && (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          {searchQuery.trim()
            ? `No spots match "${searchQuery.trim()}". Try another search or filter.`
            : tagFilter
              ? `No spots with tag "${tagFilter}". Clear the tag or try another.`
              : filter !== 'all'
                ? `No spots match this filter. Try "All" or add a spot from the map.`
                : 'No spots yet. Add one from the map or the Add tab.'}
        </p>
      )}
    </div>
  );
}
