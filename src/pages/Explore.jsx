import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Heart, Star, Search, Info, ArrowUpRight, Navigation, SlidersHorizontal, X, Users, User, UserPlus, UserCheck, Clock3, Camera, CalendarDays } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { haversineKm, getCurrentPosition, kmToMi } from '../utils/geo';
import { getSpotRatingsForSpotIds } from '../api/ratings';
import { hasSupabase } from '../api/supabase';
import { searchProfiles } from '../api/profiles';
import { getFriendConnections, sendFriendRequest, acceptFriendRequest, removeFriend } from '../api/follows';
import { getBlockedUserIds } from '../api/safety';
import SpotFeed from '../components/SpotFeed';
import EventHub from '../components/EventHub';

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
  currentUser = null,
  showToast,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const [viewMode, setViewMode] = useState(['feed', 'spots', 'creators', 'events'].includes(requestedView) ? requestedView : 'feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [spotRatings, setSpotRatings] = useState({});
  const [sortMode, setSortMode] = useState(userPositionProp ? 'nearest' : 'newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [bestTime, setBestTime] = useState('any');
  const [creators, setCreators] = useState([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [friendConnections, setFriendConnections] = useState({ friends: [], incoming: [], outgoing: [] });
  const [friendActionId, setFriendActionId] = useState(null);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const sortChosenRef = useRef(false);
  const userPosition = userPositionProp;

  const selectView = (nextView) => {
    setViewMode(nextView);
    setSearchQuery('');
    const nextParams = new URLSearchParams();
    if (nextView !== 'feed') nextParams.set('view', nextView);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    requestPositionProp?.();
  }, [requestPositionProp]);

  useEffect(() => {
    if (viewMode !== 'creators' || !hasSupabase) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setCreatorsLoading(true);
      searchProfiles(searchQuery).then((result) => {
        if (!cancelled) setCreators(result);
      }).finally(() => {
        if (!cancelled) setCreatorsLoading(false);
      });
    }, searchQuery ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [viewMode, searchQuery]);

  const refreshFriendConnections = async () => {
    if (!currentUser?.id) return;
    setFriendConnections(await getFriendConnections(currentUser.id));
  };

  useEffect(() => {
    if (viewMode === 'creators' && currentUser?.id) {
      refreshFriendConnections();
      getBlockedUserIds().then(setBlockedUserIds);
    }
  }, [viewMode, currentUser?.id]);

  useEffect(() => {
    if (userPosition && !sortChosenRef.current) setSortMode('nearest');
  }, [userPosition]);

  const matchedSpots = useMemo(
    () => allSpots.filter((spot) => matchesCategory(spot, category) && matchesSearch(spot, searchQuery)),
    [allSpots, category, searchQuery]
  );

  const filteredSpots = useMemo(() => {
    let list = matchedSpots.filter((spot) => {
      if (parkingOnly && !String(spot.parking || '').trim()) return false;
      if (minRating > 0 && (spotRatings[spot.id]?.average || 0) < minRating) return false;
      if (bestTime !== 'any') {
        const time = String(spot.bestTime || '').toLowerCase();
        if (bestTime === 'golden' && !/(golden|sunrise|sunset)/.test(time)) return false;
        if (bestTime === 'blue' && !/(blue|dawn|dusk)/.test(time)) return false;
        if (bestTime === 'night' && !/(night|after dark|evening)/.test(time)) return false;
      }
      return true;
    });
    if (sortMode === 'nearest' && userPosition) {
      return [...list].sort((a, b) => (
        (a.latitude == null || a.longitude == null ? Infinity : haversineKm(userPosition.lat, userPosition.lng, a.latitude, a.longitude))
        - (b.latitude == null || b.longitude == null ? Infinity : haversineKm(userPosition.lat, userPosition.lng, b.latitude, b.longitude))
      ));
    }
    if (sortMode === 'rating') {
      return [...list].sort((a, b) => (spotRatings[b.id]?.average || 0) - (spotRatings[a.id]?.average || 0));
    }
    return [...list].sort((a, b) => {
      const aAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bAt - aAt;
    });
  }, [matchedSpots, parkingOnly, minRating, bestTime, sortMode, userPosition, spotRatings]);

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
    if (!hasSupabase || matchedSpots.length === 0) {
      setSpotRatings({});
      return;
    }
    let cancelled = false;
    getSpotRatingsForSpotIds(matchedSpots.map((s) => s.id)).then((obj) => {
      if (!cancelled) setSpotRatings(obj);
    });
    return () => { cancelled = true; };
  }, [matchedSpots]);

  const advancedFilterCount = Number(parkingOnly) + Number(minRating > 0) + Number(bestTime !== 'any');
  const clearAdvancedFilters = () => {
    setParkingOnly(false);
    setMinRating(0);
    setBestTime('any');
  };

  const creatorCards = useMemo(() => {
    const normalized = (value) => String(value || '').trim().toLowerCase().replace(/^@/, '');
    return creators
      .filter((creator) => creator.id !== currentUser?.id && !blockedUserIds.includes(creator.id))
      .map((creator) => {
        const spots = allSpots.filter((spot) => normalized(spot.createdBy) === normalized(creator.username));
        const closestKm = userPosition && spots.length
          ? Math.min(...spots.filter((spot) => spot.latitude != null && spot.longitude != null).map((spot) => haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude)))
          : Infinity;
        return { ...creator, spotCount: spots.length, closestKm };
      })
      .sort((a, b) => {
        if (Number.isFinite(a.closestKm) !== Number.isFinite(b.closestKm)) return Number.isFinite(a.closestKm) ? -1 : 1;
        if (a.closestKm !== b.closestKm) return a.closestKm - b.closestKm;
        return b.spotCount - a.spotCount;
      });
  }, [creators, allSpots, userPosition, currentUser?.id, blockedUserIds]);

  const friendStateFor = (creatorId) => {
    if (friendConnections.friends.some((creator) => creator.id === creatorId)) return 'friends';
    if (friendConnections.incoming.some((creator) => creator.id === creatorId)) return 'incoming';
    if (friendConnections.outgoing.some((creator) => creator.id === creatorId)) return 'outgoing';
    return 'none';
  };

  const handleFriendAction = async (creator) => {
    if (!currentUser?.id || friendActionId) return;
    const state = friendStateFor(creator.id);
    setFriendActionId(creator.id);
    if (state === 'none') await sendFriendRequest(creator.id);
    else if (state === 'incoming') await acceptFriendRequest(creator.id);
    else if (state === 'outgoing') await removeFriend(creator.id);
    await refreshFriendConnections();
    setFriendActionId(null);
  };

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Explore SnapMap</p>
              <h1 className="mt-1 text-[2rem] font-extrabold leading-none tracking-[-0.045em] text-primary sm:text-4xl">
                {viewMode === 'feed' ? 'See what’s out there.' : viewMode === 'spots' ? 'Find the frame.' : viewMode === 'creators' ? 'Meet the creators.' : 'Meet at the frame.'}
              </h1>
              <p className="mt-2 text-sm font-medium text-muted">
                {viewMode === 'feed' ? 'Photos, places, and the people who found them' : viewMode === 'events' ? 'Shoots, photo walks, and creator meetups' : `${allSpots.length} community locations ready to explore`}
              </p>
            </div>
            <Link to="/about" className="icon-button h-11 w-11 shrink-0 rounded-2xl" aria-label="About SnapMap">
              <Info className="h-5 w-5" />
            </Link>
          </div>

          {['spots', 'creators'].includes(viewMode) && <div className="surface-card relative mt-5 rounded-[1.25rem] p-1.5">
            <Search className="absolute left-5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={viewMode === 'spots' ? 'Search locations, cities, or tags' : 'Search creators or specialties'}
              className="surface-input w-full rounded-2xl border-0 py-3.5 pl-12 pr-4 text-sm font-semibold placeholder:text-[var(--text-muted)] focus:shadow-none"
            />
          </div>}
          <div className="mt-3 grid grid-cols-4 rounded-[1.2rem] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
            <button type="button" onClick={() => selectView('feed')} className={`min-w-0 rounded-2xl px-1 py-2.5 text-[10px] font-extrabold transition sm:text-xs ${viewMode === 'feed' ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>
              <Camera className="mr-1 inline h-3.5 w-3.5 sm:h-4 sm:w-4" /> Feed
            </button>
            <button type="button" onClick={() => selectView('spots')} className={`min-w-0 rounded-2xl px-1 py-2.5 text-[10px] font-extrabold transition sm:text-xs ${viewMode === 'spots' ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>
              <MapPin className="mr-1 inline h-3.5 w-3.5 sm:h-4 sm:w-4" /> Spots
            </button>
            <button type="button" onClick={() => selectView('creators')} className={`min-w-0 rounded-2xl px-1 py-2.5 text-[10px] font-extrabold transition sm:text-xs ${viewMode === 'creators' ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>
              <Users className="mr-1 inline h-3.5 w-3.5 sm:h-4 sm:w-4" /> Creators
            </button>
            <button type="button" onClick={() => selectView('events')} className={`min-w-0 rounded-2xl px-1 py-2.5 text-[10px] font-extrabold transition sm:text-xs ${viewMode === 'events' ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>
              <CalendarDays className="mr-1 inline h-3.5 w-3.5 sm:h-4 sm:w-4" /> Events
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-6">
        {viewMode === 'feed' ? (
          <SpotFeed allSpots={allSpots} currentUser={currentUser} userPosition={userPosition} requestPosition={requestPositionProp} units={units} showToast={showToast} />
        ) : viewMode === 'events' ? (
          <EventHub allSpots={allSpots} currentUser={currentUser} showToast={showToast} />
        ) : viewMode === 'creators' ? (
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">The people behind the pins</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Discover creators</h2>
                <p className="mt-1 text-xs text-muted">Creators with spots near you appear first.</p>
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold text-muted">{creatorCards.length}</span>
            </div>

            {!hasSupabase ? (
              <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Users className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">Creator discovery needs cloud sync</p></div>
            ) : creatorsLoading ? (
              <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="surface-card h-32 animate-pulse rounded-[1.5rem]" />)}</div>
            ) : creatorCards.length === 0 ? (
              <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">No creators matched that search</p><p className="mt-1 text-sm text-muted">Try a username, name, or photography specialty.</p></div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {creatorCards.map((creator) => {
                  const state = friendStateFor(creator.id);
                  const labels = { none: 'Add friend', incoming: 'Accept', outgoing: 'Requested', friends: 'Friends' };
                  const FriendIcon = state === 'friends' ? UserCheck : state === 'outgoing' ? Clock3 : UserPlus;
                  const nearby = Number.isFinite(creator.closestKm) && creator.closestKm <= 80;
                  return (
                    <article key={creator.id} className="surface-card flex gap-3 rounded-[1.5rem] p-4">
                      <Link to={`/user/${creator.username}`} state={{ from: '/explore?view=creators' }} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                        {creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <Link to={`/user/${creator.username}`} state={{ from: '/explore?view=creators' }} className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-extrabold text-primary">{creator.display_name || creator.username}</h3>
                            <p className="truncate text-xs text-muted">@{creator.username}</p>
                          </Link>
                          {nearby && <span className="shrink-0 rounded-full bg-accent-500/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-accent-400">Near you</span>}
                        </div>
                        {creator.bio && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary">{creator.bio}</p>}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-muted">{creator.spotCount} spot{creator.spotCount === 1 ? '' : 's'}</span>
                          {currentUser ? (
                            <button type="button" disabled={state === 'friends' || friendActionId === creator.id} onClick={() => handleFriendAction(creator)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:opacity-60 ${state === 'incoming' ? 'bg-accent-500 text-[#211603]' : 'border border-white/10 text-secondary hover:border-accent-500/40 hover:text-accent-400'}`}>
                              <FriendIcon className="h-3.5 w-3.5" />{friendActionId === creator.id ? 'Working…' : labels[state]}
                            </button>
                          ) : <Link to="/signin" className="text-[11px] font-extrabold text-accent-400">Sign in to connect</Link>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : <>
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

        <section className="surface-card rounded-[1.5rem] p-3">
          <div className="flex items-center gap-2">
            <select
              value={sortMode}
              onChange={(event) => { sortChosenRef.current = true; setSortMode(event.target.value); }}
              className="surface-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-primary outline-none"
            >
              {userPosition && <option value="nearest">Nearest first</option>}
              <option value="newest">Newest first</option>
              <option value="rating">Highest rated</option>
            </select>
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={`relative flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-extrabold ${filtersOpen || advancedFilterCount ? 'border-accent-500/40 bg-accent-500/10 text-accent-400' : 'border-white/10 text-secondary'}`}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {advancedFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] text-[#211603]">{advancedFilterCount}</span>}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
              <label className="flex items-center justify-between rounded-xl bg-black/10 px-3 py-2.5 text-xs font-semibold text-secondary">
                Parking details
                <input type="checkbox" checked={parkingOnly} onChange={(event) => setParkingOnly(event.target.checked)} className="h-4 w-4 accent-amber-500" />
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2.5 text-xs font-semibold text-secondary">
                Rating
                <select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))} className="ml-auto bg-transparent text-primary outline-none">
                  <option value="0">Any</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="4.5">4.5+ stars</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2.5 text-xs font-semibold text-secondary">
                Best time
                <select value={bestTime} onChange={(event) => setBestTime(event.target.value)} className="ml-auto bg-transparent text-primary outline-none">
                  <option value="any">Any</option>
                  <option value="golden">Golden hour</option>
                  <option value="blue">Blue hour</option>
                  <option value="night">Night</option>
                </select>
              </label>
              {advancedFilterCount > 0 && (
                <button type="button" onClick={clearAdvancedFilters} className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-500 hover:text-accent-400 sm:col-span-3">
                  <X className="h-3.5 w-3.5" /> Clear advanced filters
                </button>
              )}
            </div>
          )}
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
        </>}
      </div>
    </div>
  );
}
