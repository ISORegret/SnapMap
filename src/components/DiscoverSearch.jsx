import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Camera, ChevronRight, Clock3, Heart, Loader2, MapPin, Search, Sparkles, User, X } from 'lucide-react';
import { fetchUpcomingEvents } from '../api/events';
import { fetchPosts } from '../api/posts';
import { searchProfiles } from '../api/profiles';
import { hasSupabase } from '../api/supabase';
import { getBlockedUserIds } from '../api/safety';
import { getSpotPrimaryImage } from '../utils/spotImages';

const RECENT_SEARCHES_KEY = 'snapmap_recent_searches_v1';
const SEARCH_SUGGESTIONS = ['Car show', 'Cars & coffee', 'Night', 'Parking'];

function searchable(...values) {
  return values.flat(Infinity).filter(Boolean).join(' ').toLowerCase();
}

function eventDate(value) {
  if (!value) return 'Date to be announced';
  return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function readRecentSearches() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export default function DiscoverSearch({ allSpots = [], favoriteIds = [], toggleFavorite }) {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const [creators, setCreators] = useState([]);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(hasSupabase);

  useEffect(() => {
    if (!hasSupabase) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      searchProfiles('', 200),
      fetchUpcomingEvents(100),
      fetchPosts({ mode: 'newest', limit: 75 }),
      getBlockedUserIds(),
    ]).then(([profileRows, eventResult, postRows, blockedIds]) => {
      if (cancelled) return;
      const blocked = new Set(blockedIds || []);
      setCreators((profileRows || []).filter((creator) => !blocked.has(creator.id)));
      setEvents(eventResult?.events || []);
      setPosts(postRows || []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();
  const results = useMemo(() => {
    if (!needle) return { spots: [], events: [], creators: [], posts: [] };
    return {
      spots: allSpots.filter((spot) => searchable(spot.name, spot.address, spot.description, spot.tags, spot.category, spot.parking, spot.bestTime).includes(needle)).slice(0, 6),
      events: events.filter((event) => searchable(event.title, event.description, event.venueName, event.address, event.eventType, event.sourceLabel, event.spot?.name).includes(needle)).slice(0, 6),
      creators: creators.filter((creator) => searchable(creator.display_name, creator.username, creator.bio).includes(needle)).slice(0, 6),
      posts: posts.filter((post) => searchable(post.caption, post.locationName, post.author?.display_name, post.author?.username, post.spot?.name, post.event?.title).includes(needle)).slice(0, 6),
    };
  }, [allSpots, creators, events, needle, posts]);

  const totalResults = Object.values(results).reduce((total, items) => total + items.length, 0);

  const rememberSearch = () => {
    if (!trimmedQuery) return;
    const next = [trimmedQuery, ...recentSearches.filter((item) => item.toLowerCase() !== needle)].slice(0, 5);
    setRecentSearches(next);
    try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
  };

  const clearRecent = () => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* Storage may be unavailable. */ }
  };

  const resultLinkClass = 'surface-card group flex min-h-[5.25rem] items-center gap-3 rounded-[1.35rem] p-3 transition hover:border-accent-500/30';

  return (
    <section>
      <div className="surface-card rounded-[1.65rem] p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-accent-400" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') rememberSearch(); }}
            placeholder="Search all of SnapMap"
            aria-label="Search spots, events, creators, and posts"
            className="surface-input w-full rounded-[1.2rem] py-4 pl-12 pr-12 text-base font-bold placeholder:text-[var(--text-muted)]"
          />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-muted"><Sparkles className="h-3.5 w-3.5 text-accent-400" />Spots, events, people, and photos</p>
          {trimmedQuery && <span className="shrink-0 font-extrabold text-secondary">{totalResults} found</span>}
        </div>
      </div>

      {!trimmedQuery ? (
        <div className="mt-7 space-y-7">
          {recentSearches.length > 0 && <section>
            <div className="mb-3 flex items-center justify-between">
              <div><p className="eyebrow">Pick up where you left off</p><h2 className="mt-1 text-lg font-extrabold text-primary">Recent searches</h2></div>
              <button type="button" onClick={clearRecent} className="text-xs font-bold text-muted hover:text-accent-400">Clear</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item) => <button key={item} type="button" onClick={() => setQuery(item)} className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-xs font-bold text-secondary"><Clock3 className="h-3.5 w-3.5" />{item}</button>)}
            </div>
          </section>}
          <section>
            <p className="eyebrow">Try a quick search</p>
            <h2 className="mt-1 text-lg font-extrabold text-primary">Find your next frame</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SEARCH_SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => setQuery(item)} className="surface-card rounded-[1.25rem] px-4 py-4 text-left text-sm font-extrabold text-secondary transition hover:border-accent-500/30 hover:text-accent-400">{item}<ChevronRight className="mt-3 h-4 w-4 text-accent-400" /></button>)}
            </div>
          </section>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-muted"><Loader2 className="h-5 w-5 animate-spin text-accent-400" />Searching SnapMap…</div>
      ) : totalResults === 0 ? (
        <div className="surface-card mt-7 rounded-[1.5rem] px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">Nothing matched “{trimmedQuery}”</p><p className="mt-1 text-sm text-muted">Try a city, creator, event type, or broader keyword.</p></div>
      ) : (
        <div className="mt-7 space-y-8">
          {results.spots.length > 0 && <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-extrabold text-primary"><MapPin className="h-5 w-5 text-accent-400" />Spots</h2><span className="text-xs font-bold text-muted">{results.spots.length}</span></div>
            <div className="grid gap-2 md:grid-cols-2">{results.spots.map((spot) => <div key={spot.id} className={resultLinkClass}>
              <Link to={`/spot/${spot.id}`} onClick={rememberSearch} className="flex min-w-0 flex-1 items-center gap-3"><img src={getSpotPrimaryImage(spot)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" /><div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-primary">{spot.name}</h3><p className="mt-1 truncate text-xs text-muted">{spot.address || 'Pinned location'}</p></div></Link>
              <button type="button" onClick={() => toggleFavorite?.(spot.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-secondary" aria-label={favoriteIds.includes(spot.id) ? 'Remove from saved' : 'Save spot'}><Heart className={`h-5 w-5 ${favoriteIds.includes(spot.id) ? 'fill-rose-400 text-rose-400' : ''}`} /></button>
            </div>)}</div>
          </section>}

          {results.events.length > 0 && <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-extrabold text-primary"><CalendarDays className="h-5 w-5 text-cyan-300" />Events</h2><span className="text-xs font-bold text-muted">{results.events.length}</span></div>
            <div className="grid gap-2 md:grid-cols-2">{results.events.map((event) => <Link key={event.id} to={`/event/${event.id}`} onClick={rememberSearch} className={resultLinkClass}>
              <img src={event.coverImageUrl || getSpotPrimaryImage(event.spot)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold text-primary">{event.title}</h3><p className="mt-1 truncate text-xs font-bold text-cyan-300">{eventDate(event.startsAt)}</p><p className="mt-0.5 truncate text-xs text-muted">{event.venueName || event.address || 'Location to be announced'}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>)}</div>
          </section>}

          {results.creators.length > 0 && <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-extrabold text-primary"><User className="h-5 w-5 text-accent-400" />Creators</h2><span className="text-xs font-bold text-muted">{results.creators.length}</span></div>
            <div className="grid gap-2 md:grid-cols-2">{results.creators.map((creator) => <Link key={creator.id} to={`/user/${creator.username}`} state={{ from: '/explore?view=search' }} onClick={rememberSearch} className={resultLinkClass}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/10 text-accent-400">{creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold text-primary">{creator.display_name || 'SnapMap user'}</h3>{creator.bio && <p className="mt-1 line-clamp-1 text-xs text-secondary">{creator.bio}</p>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>)}</div>
          </section>}

          {results.posts.length > 0 && <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-extrabold text-primary"><Camera className="h-5 w-5 text-accent-400" />Posts</h2><span className="text-xs font-bold text-muted">{results.posts.length}</span></div>
            <div className="grid gap-2 md:grid-cols-2">{results.posts.map((post) => <Link key={post.id} to={`/explore?post=${post.id}`} onClick={rememberSearch} className={resultLinkClass}>
              <img src={post.images?.[0]?.public_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-black object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold text-primary">{post.author?.display_name || 'Creator'}</h3><p className="mt-1 truncate text-xs font-bold text-accent-400">{post.locationName}</p><p className="mt-1 line-clamp-1 text-xs text-muted">{post.caption || 'Photo post'}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>)}</div>
          </section>}
        </div>
      )}
    </section>
  );
}
