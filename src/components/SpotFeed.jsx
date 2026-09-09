import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, Clock3, LocateFixed, MapPin, Sparkles } from 'lucide-react';
import { fetchPosts, subscribeToFeed } from '../api/posts';
import { fetchEvent, fetchUpcomingEvents } from '../api/events';
import { getFriendConnections } from '../api/follows';
import { haversineKm, kmToMi } from '../utils/geo';
import { getSpotPrimaryImage } from '../utils/spotImages';
import PostCard from './community/PostCard';
import PostComposer from './community/PostComposer';
import PostEditor from './community/PostEditor';

export default function SpotFeed({ allSpots = [], favoriteIds = [], currentUser, userPosition, requestPosition, units = 'mi', showToast } = {}) {
  const [searchParams] = useSearchParams();
  const focusedPostId = searchParams.get('post');
  const composeSpotId = searchParams.get('spot');
  const composeEventId = searchParams.get('event');
  const [mode, setMode] = useState(focusedPostId ? 'newest' : (currentUser ? 'for_you' : 'newest'));
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [composeEvent, setComposeEvent] = useState(null);
  const [friendIds, setFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(searchParams.get('compose') === '1');
  const [editingPost, setEditingPost] = useState(null);
  const signedInDefaultApplied = useRef(false);
  const refresh = useCallback(async (silent = false) => { if (!silent) setLoading(true); setPosts(await fetchPosts({ mode: mode === 'for_you' ? 'newest' : mode, limit: focusedPostId ? 75 : 40 })); setLoading(false); }, [mode, currentUser?.id, focusedPostId]);
  useEffect(() => { refresh(); const unsubscribe = subscribeToFeed(() => refresh(true)); return unsubscribe; }, [refresh]);
  useEffect(() => {
    let active = true;
    fetchUpcomingEvents(12).then((result) => { if (active) setEvents(result.events || []); });
    return () => { active = false; };
  }, [currentUser?.id]);
  useEffect(() => {
    if (!composeEventId) return setComposeEvent(null);
    let active = true;
    const existing = events.find((item) => String(item.id) === String(composeEventId));
    if (existing) setComposeEvent(existing);
    else fetchEvent(composeEventId).then((result) => { if (active) setComposeEvent(result.event || null); });
    return () => { active = false; };
  }, [composeEventId, events]);
  useEffect(() => {
    let active = true;
    if (!currentUser?.id) {
      setFriendIds(new Set());
      return () => { active = false; };
    }
    getFriendConnections(currentUser.id).then((connections) => {
      if (active) setFriendIds(new Set(connections.friends.map((friend) => friend.id)));
    });
    return () => { active = false; };
  }, [currentUser?.id]);
  useEffect(() => {
    if (currentUser && !focusedPostId && !signedInDefaultApplied.current) {
      signedInDefaultApplied.current = true;
      setMode('for_you');
    }
  }, [currentUser?.id, focusedPostId]);

  const savedSpotIds = useMemo(() => new Set(favoriteIds.map(String)), [favoriteIds]);
  const savedCategories = useMemo(() => new Set(allSpots
    .filter((spot) => savedSpotIds.has(String(spot.id)))
    .map((spot) => String(spot.category || '').trim().toLowerCase())
    .filter(Boolean)), [allSpots, savedSpotIds]);
  const eventRsvpById = useMemo(() => new Map(events.map((event) => [String(event.id), event.rsvpStatus])), [events]);

  const displayed = useMemo(() => {
    const withDistance = posts.map((post) => ({
      ...post,
      distanceKm: userPosition && post.latitude != null ? haversineKm(userPosition.lat, userPosition.lng, post.latitude, post.longitude) : null,
      recommendationEventStatus: post.eventId ? eventRsvpById.get(String(post.eventId)) : null,
    }));
    if (mode === 'nearby') return withDistance.filter((post) => post.distanceKm != null && post.distanceKm <= 160).sort((a, b) => a.distanceKm - b.distanceKm);
    if (mode === 'for_you') return [...withDistance].sort((a, b) => {
      const score = (post) => {
        const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 3600000);
        const relationship = post.userId === currentUser?.id ? 420 : friendIds.has(post.userId) ? 520 : 0;
        const savedPlace = post.spotId && savedSpotIds.has(String(post.spotId)) ? 360 : 0;
        const rsvp = post.recommendationEventStatus === 'going' ? 320 : post.recommendationEventStatus === 'interested' ? 180 : 0;
        const nearby = post.distanceKm == null ? 0 : Math.max(0, 160 - post.distanceKm) * 2.5;
        const recency = Math.max(0, 240 - ageHours);
        const activity = (post.likeCount || 0) * 8 + (post.comments?.length || 0) * 12;
        return relationship + savedPlace + rsvp + nearby + recency + activity;
      };
      return score(b) - score(a);
    });
    return withDistance;
  }, [posts, userPosition, mode, currentUser?.id, friendIds, savedSpotIds, eventRsvpById]);

  const recommendationReason = useCallback((post) => {
    if (friendIds.has(post.userId)) return 'From a friend';
    if (post.spotId && savedSpotIds.has(String(post.spotId))) return 'At a saved spot';
    if (post.recommendationEventStatus === 'going') return 'Event you’re attending';
    if (post.recommendationEventStatus === 'interested') return 'Event you’re interested in';
    if (post.distanceKm != null && post.distanceKm <= 40) return 'Near you';
    if ((post.likeCount || 0) + (post.comments?.length || 0) >= 3) return 'Active in the community';
    return 'Recently posted';
  }, [friendIds, savedSpotIds]);

  const featuredEvents = useMemo(() => events.map((event) => {
    const lat = event.latitude ?? event.spot?.latitude;
    const lng = event.longitude ?? event.spot?.longitude;
    const distanceKm = userPosition && lat != null && lng != null ? haversineKm(userPosition.lat, userPosition.lng, lat, lng) : null;
    return { ...event, distanceKm };
  }).sort((a, b) => {
    const savedA = a.spotId && savedSpotIds.has(String(a.spotId));
    const savedB = b.spotId && savedSpotIds.has(String(b.spotId));
    if (savedA !== savedB) return savedA ? -1 : 1;
    const interestA = a.rsvpStatus === 'going' ? 0 : a.rsvpStatus === 'interested' ? 1 : 2;
    const interestB = b.rsvpStatus === 'going' ? 0 : b.rsvpStatus === 'interested' ? 1 : 2;
    if (interestA !== interestB) return interestA - interestB;
    if (a.distanceKm != null && b.distanceKm != null && Math.abs(a.distanceKm - b.distanceKm) > 30) return a.distanceKm - b.distanceKm;
    return new Date(a.startsAt) - new Date(b.startsAt);
  }).slice(0, 4), [events, userPosition, savedSpotIds]);

  const freshSpots = useMemo(() => allSpots.map((spot) => ({
    spot,
    createdTime: spot.createdAt ? new Date(spot.createdAt).getTime() : 0,
    distanceKm: userPosition && spot.latitude != null && spot.longitude != null ? haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude) : null,
  })).sort((a, b) => {
    const categoryA = savedCategories.has(String(a.spot.category || '').trim().toLowerCase());
    const categoryB = savedCategories.has(String(b.spot.category || '').trim().toLowerCase());
    if (categoryA !== categoryB) return categoryA ? -1 : 1;
    if (userPosition) {
      const localA = a.distanceKm != null && a.distanceKm <= 160;
      const localB = b.distanceKm != null && b.distanceKm <= 160;
      if (localA !== localB) return localA ? -1 : 1;
    }
    if (a.createdTime !== b.createdTime) return b.createdTime - a.createdTime;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  }).slice(0, 6), [allSpots, userPosition, savedCategories]);

  useEffect(() => { if (mode === 'nearby' || mode === 'for_you') requestPosition?.(); }, [mode, requestPosition]);
  useEffect(() => {
    if (!loading && focusedPostId) requestAnimationFrame(() => document.getElementById(`post-${focusedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [loading, focusedPostId, posts.length]);

  return <section className="mx-auto w-full max-w-2xl pb-4">
    <div className="mb-5 flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="eyebrow">Location stories</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">{mode === 'for_you' ? 'For You' : 'Spot Feed'}</h2></div>
      {currentUser ? <button type="button" onClick={() => setComposerOpen(true)} className="primary-button px-4 py-2.5 text-sm"><Camera className="h-4 w-4" />Post</button> : <Link to="/signin" className="primary-button px-4 py-2.5 text-sm">Sign in to post</Link>}
    </div>
    <div className={`mb-5 grid ${currentUser ? 'grid-cols-4' : 'grid-cols-3'} rounded-[1.2rem] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1`}>
      {(currentUser ? [['for_you', 'For You'], ['friends', 'Friends'], ['nearby', 'Nearby'], ['newest', 'Newest']] : [['nearby', 'Nearby'], ['newest', 'Newest'], ['friends', 'Friends']]).map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-2xl px-2 py-2.5 text-[11px] font-extrabold transition sm:text-xs ${mode === value ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>{label}</button>)}
    </div>
    {mode === 'for_you' && !loading && <div className="mb-5 space-y-5">
      <div className="rounded-[1.5rem] border border-accent-500/20 bg-accent-500/[0.06] p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-primary"><Sparkles className="h-4 w-4 text-accent-400" />Picked for your next shoot</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">Based on your friends, saved spots, location, events, and community activity.</p>
      </div>
      {featuredEvents.length > 0 && <div>
        <div className="mb-2.5 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-extrabold text-primary"><CalendarDays className="h-4 w-4 text-cyan-300" />Coming up</p><Link to="/explore?view=events" className="text-xs font-extrabold text-accent-400">All events</Link></div>
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {featuredEvents.map((event) => <Link key={event.id} to={`/event/${event.id}`} className="surface-card min-w-[15rem] snap-start rounded-[1.25rem] p-3.5 transition hover:border-accent-500/30">
            <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-center"><span className="text-[10px] font-black uppercase text-cyan-300">{new Date(event.startsAt).toLocaleDateString([], { month: 'short' })}</span><span className="-mt-1 text-base font-black text-primary">{new Date(event.startsAt).getDate()}</span></div><div className="min-w-0"><p className="truncate text-sm font-extrabold text-primary">{event.title}</p><p className="mt-1 truncate text-[11px] text-muted">{event.venueName || event.address || 'Location details inside'}</p></div></div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-secondary"><Clock3 className="h-3.5 w-3.5 text-cyan-300" />{new Date(event.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{event.distanceKm != null ? ` · ${units === 'km' ? `${event.distanceKm.toFixed(0)} km` : `${kmToMi(event.distanceKm).toFixed(0)} mi`} away` : ''}</p>
          </Link>)}
        </div>
      </div>}
      {freshSpots.length > 0 && <div>
        <div className="mb-2.5 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-extrabold text-primary"><MapPin className="h-4 w-4 text-accent-400" />Fresh spots nearby</p><Link to="/explore?view=spots" className="text-xs font-extrabold text-accent-400">Browse spots</Link></div>
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {freshSpots.map(({ spot, distanceKm }) => <Link key={spot.id} to={`/spot/${spot.id}`} className="surface-card min-w-[10.5rem] snap-start overflow-hidden rounded-[1.25rem]">
            <img src={getSpotPrimaryImage(spot)} alt="" className="aspect-[16/10] w-full object-cover" />
            <div className="p-3"><p className="truncate text-xs font-extrabold text-primary">{spot.name}</p><p className="mt-1 truncate text-[10px] text-muted">{distanceKm != null ? `${units === 'km' ? distanceKm.toFixed(1) : kmToMi(distanceKm).toFixed(1)} ${units === 'km' ? 'km' : 'mi'} away` : spot.address || 'View location'}</p></div>
          </Link>)}
        </div>
      </div>}
    </div>}
    {loading ? <div className="space-y-4">{[0, 1].map((item) => <div key={item} className="surface-card aspect-[4/5] animate-pulse rounded-[1.65rem]" />)}</div>
    : mode === 'nearby' && !userPosition ? <div className="surface-card rounded-[1.65rem] px-6 py-12 text-center"><LocateFixed className="mx-auto h-8 w-8 text-accent-400" /><p className="mt-4 font-extrabold text-primary">Turn on location for nearby posts</p><button type="button" onClick={requestPosition} className="primary-button mt-4 px-5 py-2.5 text-sm">Use my location</button></div>
    : displayed.length === 0 ? <div className="surface-card rounded-[1.65rem] px-6 py-12 text-center"><Camera className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">{mode === 'friends' ? 'Your friends haven’t posted yet' : mode === 'nearby' ? 'No posts nearby yet' : mode === 'for_you' ? 'Your photo feed is ready to grow' : 'The feed is ready for its first frame'}</p><p className="mt-1 text-sm text-muted">{currentUser ? 'Share a photo from a location worth finding.' : 'Sign in and help start the community.'}</p>{currentUser && <button type="button" onClick={() => setComposerOpen(true)} className="primary-button mt-5 px-5 py-2.5 text-sm">Create a post</button>}</div>
    : <div className="space-y-5">{displayed.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} units={units} recommendationReason={mode === 'for_you' ? recommendationReason(post) : ''} onChanged={() => refresh(true)} onEdit={setEditingPost} showToast={showToast} />)}</div>}
    <PostComposer key={`${composeSpotId || 'spot'}-${composeEvent?.id || composeEventId || 'event'}`} open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={() => refresh(true)} allSpots={allSpots} availableEvents={events} currentUser={currentUser} userPosition={userPosition} requestPosition={requestPosition} showToast={showToast} initialSpotId={composeSpotId} initialEvent={composeEvent} />
    <PostEditor post={editingPost} open={Boolean(editingPost)} onClose={() => setEditingPost(null)} onSaved={() => refresh(true)} allSpots={allSpots} availableEvents={events} userPosition={userPosition} requestPosition={requestPosition} showToast={showToast} />
  </section>;
}
