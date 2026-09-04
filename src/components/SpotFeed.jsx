import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Camera, ChevronLeft, ChevronRight, Clock3, Heart, ImagePlus, LocateFixed, MapPin, MessageCircle, MoreHorizontal, Navigation, Pencil, Send, Share2, Sparkles, Trash2, User, X } from 'lucide-react';
import { addPostComment, compressPostImage, createPost, deletePost, deletePostComment, fetchPosts, reportPost, subscribeToFeed, togglePostLike, updatePost } from '../api/posts';
import { fetchEvent, fetchUpcomingEvents } from '../api/events';
import { getFriendConnections } from '../api/follows';
import { haversineKm, kmToMi } from '../utils/geo';
import { getSpotPrimaryImage } from '../utils/spotImages';

function timeAgo(value) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function PostCard({ post, currentUser, units, onChanged, onEdit, showToast }) {
  const [slide, setSlide] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [working, setWorking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const image = post.images[slide];
  const isOwn = currentUser?.id === post.userId;
  const distance = post.distanceKm != null
    ? (units === 'km' ? `${post.distanceKm.toFixed(1)} km away` : `${kmToMi(post.distanceKm).toFixed(1)} mi away`)
    : null;

  const handleLike = async () => {
    if (!currentUser) return showToast?.('Sign in to like posts.');
    const ok = await togglePostLike(post.id, post.likedByMe);
    if (ok) onChanged?.();
  };

  const sharePost = async () => {
    if (sharing) return;
    setSharing(true);
    const url = `${window.location.origin}${window.location.pathname || ''}#/explore?post=${post.id}`;
    const creator = post.author?.display_name || post.author?.username || 'a SnapMap creator';
    const text = post.caption?.trim() ? `${post.caption.trim().slice(0, 180)}${post.caption.trim().length > 180 ? '…' : ''}` : `Photo from ${post.locationName} by ${creator}`;
    try {
      if (navigator.share) {
        const imageUrl = post.images[0]?.public_url;
        if (imageUrl && navigator.canShare) {
          try {
            const response = await fetch(imageUrl);
            if (response.ok) {
              const blob = await response.blob();
              const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
              const file = new File([blob], `snapmap-${post.id}.${extension}`, { type: blob.type || 'image/webp' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `${post.locationName} · SnapMap`, text, url });
                return;
              }
            }
          } catch (imageShareError) {
            if (imageShareError?.name === 'AbortError') return;
          }
        }
        await navigator.share({ title: `${post.locationName} · SnapMap`, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast?.('Post link copied.');
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        showToast?.('Post link copied.');
      } catch {
        showToast?.('Could not share this post.');
      }
    } finally {
      setSharing(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!currentUser) return showToast?.('Sign in to join the conversation.');
    if (!comment.trim() || working) return;
    setWorking(true);
    const created = await addPostComment(post.id, comment);
    setWorking(false);
    if (created) { setComment(''); onChanged?.(); }
    else showToast?.('Could not add your comment.');
  };

  const handlePostAction = async (action) => {
    setMenuOpen(false);
    if (action === 'edit') {
      onEdit?.(post);
    } else if (action === 'delete') {
      if (!window.confirm('Delete this post and its photos?')) return;
      if (await deletePost(post)) { showToast?.('Post deleted.'); onChanged?.(); }
    } else if (await reportPost(post.id)) showToast?.('Post reported. Thank you.');
  };

  return (
    <article id={`post-${post.id}`} className="surface-card overflow-hidden rounded-[1.65rem]">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
          {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="truncate text-sm font-extrabold text-primary">{post.author?.display_name || post.author?.username || 'Creator'}</Link>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3 shrink-0 text-accent-400" /><span className="truncate">{post.locationName}</span><span>·</span><span className="shrink-0">{timeAgo(post.createdAt)}</span></p>
          {post.event && <Link to={`/event/${post.event.id}`} className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-cyan-300"><CalendarDays className="h-3 w-3 shrink-0" /><span className="truncate">{post.event.title}</span></Link>}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="icon-button h-9 w-9 rounded-xl" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></button>
          {menuOpen && <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-1.5 shadow-2xl">
            {isOwn && <button type="button" onClick={() => handlePostAction('edit')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-secondary hover:bg-white/5"><Pencil className="h-4 w-4 text-accent-400" />Edit post</button>}
            <button type="button" onClick={() => handlePostAction(isOwn ? 'delete' : 'report')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-secondary hover:bg-white/5">
              {isOwn ? <Trash2 className="h-4 w-4 text-rose-400" /> : <MoreHorizontal className="h-4 w-4" />}{isOwn ? 'Delete post' : 'Report post'}
            </button>
          </div>}
        </div>
      </div>

      <div className="relative aspect-[4/5] max-h-[42rem] bg-black">
        <img src={image?.public_url} alt={`Photo ${slide + 1} from ${post.locationName}`} className="h-full w-full object-contain" />
        {post.images.length > 1 && <>
          <button type="button" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-20" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" disabled={slide === post.images.length - 1} onClick={() => setSlide((value) => value + 1)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-20" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{slide + 1}/{post.images.length}</span>
        </>}
        {post.locationPrecision === 'approximate' && <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/80 backdrop-blur">Approximate location</span>}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleLike} className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold ${post.likedByMe ? 'text-rose-400' : 'text-secondary'}`}><Heart className={`h-5 w-5 ${post.likedByMe ? 'fill-current' : ''}`} />{post.likeCount || ''}</button>
          <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary"><MessageCircle className="h-5 w-5" />{post.comments.length || ''}</button>
          <button type="button" onClick={sharePost} disabled={sharing} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary disabled:opacity-50" aria-label="Share post outside SnapMap"><Share2 className="h-5 w-5" /></button>
          {currentUser && <Link to="/messages" state={{ share: { type: 'post', id: post.id, title: post.locationName, subtitle: `Post by ${post.author?.display_name || post.author?.username || 'a creator'}`, imageUrl: post.images[0]?.public_url || '' } }} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary" aria-label="Send post to a friend"><Send className="h-5 w-5" /></Link>}
          <div className="ml-auto flex items-center gap-2">
            {distance && <span className="hidden text-[11px] font-bold text-muted sm:inline">{distance}</span>}
            {post.spotId ? <Link to={`/spot/${post.spotId}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />View spot</Link> : post.latitude != null && <Link to={`/?lat=${post.latitude}&lng=${post.longitude}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />Map</Link>}
          </div>
        </div>
        {post.caption && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary"><Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="mr-1 font-extrabold text-primary">{post.author?.display_name || post.author?.username || 'Creator'}</Link>{post.caption}{post.updated_at && new Date(post.updated_at).getTime() > new Date(post.createdAt).getTime() + 1000 && <span className="ml-1.5 text-[10px] font-semibold text-muted">Edited</span>}</p>}
        {!commentsOpen && post.comments.length > 0 && <button type="button" onClick={() => setCommentsOpen(true)} className="mt-2 text-xs font-semibold text-muted">View {post.comments.length === 1 ? 'comment' : `all ${post.comments.length} comments`}</button>}
        {commentsOpen && <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {post.comments.length === 0 && <p className="text-xs text-muted">No comments yet. Start the conversation.</p>}
            {post.comments.map((item) => <div key={item.id} className="group flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/10 text-accent-400">{item.author?.avatar_url ? <img src={item.author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5" />}</div>
              <div className="min-w-0 flex-1 rounded-2xl bg-black/10 px-3 py-2"><p className="text-xs"><Link to={`/user/${item.author?.username}`} state={{ from: '/explore' }} className="font-extrabold text-primary">{item.author?.display_name || item.author?.username}</Link><span className="ml-2 text-secondary">{item.body}</span></p><p className="mt-1 text-[10px] text-muted">{timeAgo(item.created_at)}</p></div>
              {currentUser?.id === item.user_id && <button type="button" onClick={async () => { if (await deletePostComment(item.id)) onChanged?.(); }} className="self-center p-1 text-muted opacity-0 transition group-hover:opacity-100" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>)}
          </div>
          <form onSubmit={submitComment} className="mt-3 flex gap-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder={currentUser ? 'Add a comment…' : 'Sign in to comment'} disabled={!currentUser} className="surface-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm" />
            <button type="submit" disabled={!comment.trim() || working} className="primary-button h-10 w-10 rounded-xl disabled:opacity-40" aria-label="Post comment"><Send className="h-4 w-4" /></button>
          </form>
        </div>}
      </div>
    </article>
  );
}

function PostEditor({ post, open, onClose, onSaved, allSpots = [], availableEvents = [], userPosition, requestPosition, showToast }) {
  const cloudSpots = useMemo(() => allSpots.filter((spot) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(spot.id))), [allSpots]);
  const eventOptions = useMemo(() => post?.event && !availableEvents.some((item) => item.id === post.event.id) ? [post.event, ...availableEvents] : availableEvents, [availableEvents, post?.event]);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [spotId, setSpotId] = useState('');
  const [eventId, setEventId] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [approximate, setApproximate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!post || !open) return;
    setCaption(post.caption || '');
    setLocationName(post.locationName || '');
    setSpotId(post.spotId || '');
    setEventId(post.eventId || '');
    setLatitude(post.latitude ?? null);
    setLongitude(post.longitude ?? null);
    setApproximate(post.locationPrecision === 'approximate');
    setError('');
  }, [open, post?.id]);

  if (!open || !post) return null;

  const chooseSpot = (value) => {
    setSpotId(value);
    const selected = cloudSpots.find((spot) => String(spot.id) === String(value));
    if (!selected) return;
    setLocationName(selected.name);
    setLatitude(selected.latitude);
    setLongitude(selected.longitude);
    setApproximate(false);
  };

  const useMyLocation = async () => {
    const position = userPosition || await requestPosition?.();
    if (!position) return setError('Location access is needed to use your current position.');
    setSpotId('');
    setLatitude(position.lat);
    setLongitude(position.lng);
    if (!locationName.trim() || post.spotId) setLocationName('Current location');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!locationName.trim() || latitude == null || longitude == null) return setError('Choose a spot or use your current location.');
    setSaving(true);
    setError('');
    const result = await updatePost({ postId: post.id, caption, locationName, latitude, longitude, locationPrecision: approximate ? 'approximate' : 'exact', spotId, eventId });
    setSaving(false);
    if (!result.post) return setError(result.error || 'Could not save your changes.');
    showToast?.('Post updated.');
    onSaved?.(result.post);
    onClose?.();
  };

  return createPortal(<div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="edit-post-title">
    <form onSubmit={submit} className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-page-elevated)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]">
      <div className="flex items-center justify-between"><div><p className="eyebrow">Your post</p><h2 id="edit-post-title" className="mt-1 text-xl font-extrabold text-primary">Edit post</h2></div><button type="button" onClick={onClose} className="icon-button h-10 w-10 rounded-xl" aria-label="Close"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--bg-input)] p-3"><img src={post.images[0]?.public_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /><div><p className="text-sm font-extrabold text-primary">Photos stay with this post</p><p className="mt-1 text-xs leading-relaxed text-muted">You can update the caption, location, privacy, and event tag.</p></div></div>
      <label className="mt-4 block text-xs font-extrabold text-secondary">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={4} placeholder="What made this spot worth the stop?" className="surface-input mt-2 w-full resize-none rounded-2xl p-3.5 text-sm font-normal" /></label>
      <label className="mt-4 block text-xs font-extrabold text-secondary">Tagged event<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">No event tagged</option>{eventOptions.map((item) => { const startsAt = item.startsAt || item.starts_at; return <option key={item.id} value={item.id}>{item.title}{startsAt ? ` · ${new Date(startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}</option>; })}</select></label>
      <label className="mt-4 block text-xs font-extrabold text-secondary">SnapMap location<select value={spotId} onChange={(event) => chooseSpot(event.target.value)} className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">Custom or current location</option>{cloudSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select></label>
      <button type="button" onClick={useMyLocation} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-extrabold text-secondary"><LocateFixed className="h-4 w-4 text-accent-400" />Use my current location</button>
      <label className="mt-4 block text-xs font-extrabold text-secondary">Location name<input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={160} className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm font-normal" /></label>
      <label className="mt-3 flex items-start gap-3 rounded-2xl bg-[var(--bg-input)] p-3 text-sm text-secondary"><input type="checkbox" checked={approximate} onChange={(event) => setApproximate(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" /><span><strong className="block text-primary">Show approximate location</strong><span className="text-xs text-muted">Coordinates are blurred and the exact spot link is removed.</span></span></label>
      {error && <p className="mt-3 text-sm font-semibold text-rose-400">{error}</p>}
      <button type="submit" disabled={saving} className="primary-button mt-5 w-full py-3.5 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  </div>, document.body);
}

function Composer({ open, onClose, onCreated, allSpots = [], availableEvents = [], currentUser, userPosition, requestPosition, showToast, initialSpotId = '', initialEvent = null } = {}) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const startingSpotId = initialSpotId || initialEvent?.spotId || '';
  const [spotId, setSpotId] = useState(startingSpotId);
  const initialSpot = allSpots.find((item) => String(item.id) === String(startingSpotId));
  const [locationName, setLocationName] = useState(initialEvent?.venueName || initialSpot?.name || '');
  const [eventId, setEventId] = useState(initialEvent?.id || '');
  const [useCurrent, setUseCurrent] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const filesRef = useRef([]);
  const cloudSpots = useMemo(() => allSpots.filter((spot) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(spot.id))), [allSpots]);
  const eventOptions = useMemo(() => initialEvent && !availableEvents.some((item) => item.id === initialEvent.id) ? [initialEvent, ...availableEvents] : availableEvents, [availableEvents, initialEvent]);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);
  useEffect(() => {
    if (!initialEvent?.id) return;
    setEventId(initialEvent.id);
    const linkedSpot = cloudSpots.find((item) => String(item.id) === String(initialEvent.spotId));
    if (linkedSpot) setSpotId(linkedSpot.id);
    setUseCurrent(false);
    setLocationName(initialEvent.venueName || linkedSpot?.name || initialEvent.address || initialEvent.title);
  }, [initialEvent?.id, initialEvent?.spotId, initialEvent?.venueName, initialEvent?.address, initialEvent?.title, cloudSpots]);
  if (!open) return null;

  const resetAndClose = () => {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]); setCaption(''); setError('');
    onClose();
  };

  const addFiles = async (event) => {
    const selected = [...(event.target.files || [])].slice(0, 5 - files.length);
    setError('');
    try {
      const compressed = [];
      for (const file of selected) compressed.push(await compressPostImage(file));
      setFiles((current) => [...current, ...compressed].slice(0, 5));
    } catch (processingError) { setError(processingError.message); }
    event.target.value = '';
  };

  const chooseCurrent = async () => {
    const position = userPosition || await requestPosition?.();
    if (!position) { setError('Location access is needed to use your current position.'); return; }
    setUseCurrent(true); setSpotId('');
    if (!locationName) setLocationName('Current location');
  };

  const chooseSpot = (value) => {
    setSpotId(value); setUseCurrent(false);
    const spot = cloudSpots.find((item) => item.id === value);
    if (spot) setLocationName(spot.name);
  };

  const chooseEvent = (value) => {
    setEventId(value);
    const selected = eventOptions.find((item) => item.id === value);
    if (!selected) return;
    const selectedSpot = cloudSpots.find((item) => String(item.id) === String(selected.spotId));
    setUseCurrent(false);
    if (selectedSpot) setSpotId(selectedSpot.id);
    setLocationName(selected.venueName || selectedSpot?.name || selected.address || selected.title);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!files.length) return setError('Add at least one photo.');
    const spot = cloudSpots.find((item) => item.id === spotId);
    const selectedEvent = eventOptions.find((item) => item.id === eventId);
    const eventLat = selectedEvent?.latitude ?? selectedEvent?.spot?.latitude;
    const eventLng = selectedEvent?.longitude ?? selectedEvent?.spot?.longitude;
    const position = useCurrent ? userPosition : spot ? { lat: spot.latitude, lng: spot.longitude } : eventLat != null && eventLng != null ? { lat: eventLat, lng: eventLng } : null;
    if (!locationName.trim() || !position) return setError('Choose a SnapMap spot or use your current location.');
    setSaving(true); setError('');
    const result = await createPost({ caption, locationName, latitude: position.lat, longitude: position.lng, locationPrecision: approximate ? 'approximate' : 'exact', spotId: approximate ? null : (spot?.id || selectedEvent?.spotId || null), eventId: eventId || null, images: files });
    setSaving(false);
    if (result.post) { showToast?.('Posted to the Spot Feed.'); onCreated(result.post); resetAndClose(); }
    else setError(result.error || 'Could not publish your post.');
  };

  return createPortal(<div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create a post">
    <form onSubmit={submit} className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-page-elevated)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]">
      <div className="flex items-center justify-between"><div><p className="eyebrow">Share the frame</p><h2 className="mt-1 text-xl font-extrabold text-primary">New spot post</h2></div><button type="button" onClick={resetAndClose} className="icon-button h-10 w-10 rounded-xl" aria-label="Close"><X className="h-5 w-5" /></button></div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles} className="hidden" />
      {files.length === 0 ? <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-accent-500/35 bg-accent-500/[0.05] text-accent-400"><ImagePlus className="h-8 w-8" /><span className="mt-3 text-sm font-extrabold">Choose photos</span><span className="mt-1 text-xs text-muted">Up to 5 · optimized before upload</span></button>
      : <div className="mt-5 grid grid-cols-3 gap-2">{files.map((file, index) => <div key={file.previewUrl} className="group relative aspect-square overflow-hidden rounded-xl bg-black"><img src={file.previewUrl} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => { URL.revokeObjectURL(file.previewUrl); setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index)); }} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white" aria-label="Remove photo"><X className="h-3.5 w-3.5" /></button></div>)}{files.length < 5 && <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] text-muted"><ImagePlus className="h-6 w-6" /></button>}</div>}
      <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={3} placeholder="What made this spot worth the stop?" className="surface-input mt-4 w-full resize-none rounded-2xl p-3.5 text-sm" />
      <select value={eventId} onChange={(event) => chooseEvent(event.target.value)} className="surface-input mt-4 w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">Tag an event (optional)</option>{eventOptions.map((item) => <option key={item.id} value={item.id}>{item.title} · {new Date(item.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</option>)}</select>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select value={spotId} onChange={(event) => chooseSpot(event.target.value)} className="surface-input min-w-0 rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">Choose an existing spot</option>{cloudSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select>
        <button type="button" onClick={chooseCurrent} className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-extrabold ${useCurrent ? 'border-accent-500 bg-accent-500/10 text-accent-400' : 'border-[var(--border-subtle)] text-secondary'}`}><LocateFixed className="h-4 w-4" />Current location</button>
      </div>
      {useCurrent && <input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={160} placeholder="Name this location" className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm" />}
      {(spotId || useCurrent) && <label className="mt-3 flex items-start gap-3 rounded-2xl bg-[var(--bg-input)] p-3 text-sm text-secondary"><input type="checkbox" checked={approximate} onChange={(event) => setApproximate(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" /><span><strong className="block text-primary">Show approximate location</strong><span className="text-xs text-muted">The feed will blur the coordinates by roughly one mile.</span></span></label>}
      {error && <p className="mt-3 text-sm font-semibold text-rose-400">{error}</p>}
      <button type="submit" disabled={saving || !currentUser} className="primary-button mt-5 w-full py-3.5 text-sm disabled:opacity-50">{saving ? 'Uploading…' : 'Publish post'}</button>
    </form>
  </div>, document.body);
}

export default function SpotFeed({ allSpots = [], currentUser, userPosition, requestPosition, units = 'mi', showToast } = {}) {
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

  const displayed = useMemo(() => {
    const withDistance = posts.map((post) => ({ ...post, distanceKm: userPosition && post.latitude != null ? haversineKm(userPosition.lat, userPosition.lng, post.latitude, post.longitude) : null }));
    if (mode === 'nearby') return withDistance.filter((post) => post.distanceKm != null && post.distanceKm <= 160).sort((a, b) => a.distanceKm - b.distanceKm);
    if (mode === 'for_you') return [...withDistance].sort((a, b) => {
      const score = (post) => {
        const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 3600000);
        const relationship = post.userId === currentUser?.id ? 420 : friendIds.has(post.userId) ? 520 : 0;
        const nearby = post.distanceKm == null ? 0 : Math.max(0, 160 - post.distanceKm) * 2.5;
        const recency = Math.max(0, 240 - ageHours);
        const activity = (post.likeCount || 0) * 8 + (post.comments?.length || 0) * 12;
        return relationship + nearby + recency + activity;
      };
      return score(b) - score(a);
    });
    return withDistance;
  }, [posts, userPosition, mode, currentUser?.id, friendIds]);

  const featuredEvents = useMemo(() => events.map((event) => {
    const lat = event.latitude ?? event.spot?.latitude;
    const lng = event.longitude ?? event.spot?.longitude;
    const distanceKm = userPosition && lat != null && lng != null ? haversineKm(userPosition.lat, userPosition.lng, lat, lng) : null;
    return { ...event, distanceKm };
  }).sort((a, b) => {
    const interestA = a.rsvpStatus === 'going' ? 0 : a.rsvpStatus === 'interested' ? 1 : 2;
    const interestB = b.rsvpStatus === 'going' ? 0 : b.rsvpStatus === 'interested' ? 1 : 2;
    if (interestA !== interestB) return interestA - interestB;
    if (a.distanceKm != null && b.distanceKm != null && Math.abs(a.distanceKm - b.distanceKm) > 30) return a.distanceKm - b.distanceKm;
    return new Date(a.startsAt) - new Date(b.startsAt);
  }).slice(0, 4), [events, userPosition]);

  const freshSpots = useMemo(() => allSpots.map((spot) => ({
    spot,
    createdTime: spot.createdAt ? new Date(spot.createdAt).getTime() : 0,
    distanceKm: userPosition && spot.latitude != null && spot.longitude != null ? haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude) : null,
  })).sort((a, b) => {
    if (userPosition) {
      const localA = a.distanceKm != null && a.distanceKm <= 160;
      const localB = b.distanceKm != null && b.distanceKm <= 160;
      if (localA !== localB) return localA ? -1 : 1;
    }
    if (a.createdTime !== b.createdTime) return b.createdTime - a.createdTime;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  }).slice(0, 6), [allSpots, userPosition]);

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
        <p className="mt-1 text-xs leading-relaxed text-muted">Friends first, then active posts and places close to you.</p>
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
    : <div className="space-y-5">{displayed.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} units={units} onChanged={() => refresh(true)} onEdit={setEditingPost} showToast={showToast} />)}</div>}
    <Composer key={`${composeSpotId || 'spot'}-${composeEvent?.id || composeEventId || 'event'}`} open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={() => refresh(true)} allSpots={allSpots} availableEvents={events} currentUser={currentUser} userPosition={userPosition} requestPosition={requestPosition} showToast={showToast} initialSpotId={composeSpotId} initialEvent={composeEvent} />
    <PostEditor post={editingPost} open={Boolean(editingPost)} onClose={() => setEditingPost(null)} onSaved={() => refresh(true)} allSpots={allSpots} availableEvents={events} userPosition={userPosition} requestPosition={requestPosition} showToast={showToast} />
  </section>;
}
