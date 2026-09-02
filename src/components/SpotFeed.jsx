import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight, Heart, ImagePlus, LocateFixed, MapPin, MessageCircle, MoreHorizontal, Navigation, Send, Trash2, User, X } from 'lucide-react';
import { addPostComment, compressPostImage, createPost, deletePost, deletePostComment, fetchPosts, reportPost, subscribeToFeed, togglePostLike } from '../api/posts';
import { haversineKm, kmToMi } from '../utils/geo';

function timeAgo(value) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function PostCard({ post, currentUser, units, onChanged, showToast }) {
  const [slide, setSlide] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [working, setWorking] = useState(false);
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
    if (action === 'delete') {
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
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="icon-button h-9 w-9 rounded-xl" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></button>
          {menuOpen && <div className="absolute right-0 top-11 z-20 w-40 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-1.5 shadow-2xl">
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
          <div className="ml-auto flex items-center gap-2">
            {distance && <span className="hidden text-[11px] font-bold text-muted sm:inline">{distance}</span>}
            {post.spotId ? <Link to={`/spot/${post.spotId}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />View spot</Link> : post.latitude != null && <Link to={`/?lat=${post.latitude}&lng=${post.longitude}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />Map</Link>}
          </div>
        </div>
        {post.caption && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary"><Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="mr-1 font-extrabold text-primary">{post.author?.display_name || post.author?.username || 'Creator'}</Link>{post.caption}</p>}
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

function Composer({ open, onClose, onCreated, allSpots, currentUser, userPosition, requestPosition, showToast, initialSpotId = '' }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [spotId, setSpotId] = useState(initialSpotId);
  const initialSpot = allSpots.find((item) => item.id === initialSpotId);
  const [locationName, setLocationName] = useState(initialSpot?.name || '');
  const [useCurrent, setUseCurrent] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const filesRef = useRef([]);
  const cloudSpots = useMemo(() => allSpots.filter((spot) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(spot.id))), [allSpots]);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);
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

  const submit = async (event) => {
    event.preventDefault();
    if (!files.length) return setError('Add at least one photo.');
    const spot = cloudSpots.find((item) => item.id === spotId);
    const position = useCurrent ? userPosition : spot ? { lat: spot.latitude, lng: spot.longitude } : null;
    if (!locationName.trim() || !position) return setError('Choose a SnapMap spot or use your current location.');
    setSaving(true); setError('');
    const result = await createPost({ caption, locationName, latitude: position.lat, longitude: position.lng, locationPrecision: approximate ? 'approximate' : 'exact', spotId: approximate ? null : (spot?.id || null), images: files });
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

export default function SpotFeed({ allSpots = [], currentUser, userPosition, requestPosition, units = 'mi', showToast }) {
  const [searchParams] = useSearchParams();
  const focusedPostId = searchParams.get('post');
  const composeSpotId = searchParams.get('spot');
  const [mode, setMode] = useState(focusedPostId ? 'newest' : (currentUser ? 'friends' : 'newest'));
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(searchParams.get('compose') === '1');
  const signedInDefaultApplied = useRef(false);
  const refresh = useCallback(async (silent = false) => { if (!silent) setLoading(true); setPosts(await fetchPosts({ mode, limit: focusedPostId ? 75 : 40 })); setLoading(false); }, [mode, currentUser?.id, focusedPostId]);
  useEffect(() => { refresh(); const unsubscribe = subscribeToFeed(() => refresh(true)); return unsubscribe; }, [refresh]);
  useEffect(() => {
    if (currentUser && !focusedPostId && !signedInDefaultApplied.current) {
      signedInDefaultApplied.current = true;
      setMode('friends');
    }
  }, [currentUser?.id, focusedPostId]);

  const displayed = useMemo(() => {
    const withDistance = posts.map((post) => ({ ...post, distanceKm: userPosition && post.latitude != null ? haversineKm(userPosition.lat, userPosition.lng, post.latitude, post.longitude) : null }));
    if (mode === 'nearby') return withDistance.filter((post) => post.distanceKm != null && post.distanceKm <= 160).sort((a, b) => a.distanceKm - b.distanceKm);
    return withDistance;
  }, [posts, userPosition, mode]);

  useEffect(() => { if (mode === 'nearby') requestPosition?.(); }, [mode, requestPosition]);
  useEffect(() => {
    if (!loading && focusedPostId) requestAnimationFrame(() => document.getElementById(`post-${focusedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [loading, focusedPostId, posts.length]);

  return <section className="mx-auto w-full max-w-2xl pb-4">
    <div className="mb-5 flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="eyebrow">Location stories</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Spot Feed</h2></div>
      {currentUser ? <button type="button" onClick={() => setComposerOpen(true)} className="primary-button px-4 py-2.5 text-sm"><Camera className="h-4 w-4" />Post</button> : <Link to="/signin" className="primary-button px-4 py-2.5 text-sm">Sign in to post</Link>}
    </div>
    <div className="mb-5 grid grid-cols-3 rounded-[1.2rem] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
      {[['friends', 'Friends'], ['nearby', 'Nearby'], ['newest', 'Newest']].map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-2xl px-3 py-2.5 text-xs font-extrabold transition ${mode === value ? 'bg-accent-500 text-[#211603] shadow-glow-sm' : 'text-secondary'}`}>{label}</button>)}
    </div>
    {loading ? <div className="space-y-4">{[0, 1].map((item) => <div key={item} className="surface-card aspect-[4/5] animate-pulse rounded-[1.65rem]" />)}</div>
    : mode === 'nearby' && !userPosition ? <div className="surface-card rounded-[1.65rem] px-6 py-12 text-center"><LocateFixed className="mx-auto h-8 w-8 text-accent-400" /><p className="mt-4 font-extrabold text-primary">Turn on location for nearby posts</p><button type="button" onClick={requestPosition} className="primary-button mt-4 px-5 py-2.5 text-sm">Use my location</button></div>
    : displayed.length === 0 ? <div className="surface-card rounded-[1.65rem] px-6 py-12 text-center"><Camera className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">{mode === 'friends' ? 'Your friends haven’t posted yet' : mode === 'nearby' ? 'No posts nearby yet' : 'The feed is ready for its first frame'}</p><p className="mt-1 text-sm text-muted">{currentUser ? 'Share a photo from a location worth finding.' : 'Sign in and help start the community.'}</p>{currentUser && <button type="button" onClick={() => setComposerOpen(true)} className="primary-button mt-5 px-5 py-2.5 text-sm">Create a post</button>}</div>
    : <div className="space-y-5">{displayed.map((post) => <PostCard key={post.id} post={post} currentUser={currentUser} units={units} onChanged={() => refresh(true)} showToast={showToast} />)}</div>}
    <Composer key={composeSpotId || 'composer'} open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={() => refresh(true)} allSpots={allSpots} currentUser={currentUser} userPosition={userPosition} requestPosition={requestPosition} showToast={showToast} initialSpotId={composeSpotId} />
  </section>;
}
