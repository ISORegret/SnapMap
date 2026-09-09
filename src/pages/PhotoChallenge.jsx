import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Clock3, ImagePlus, Sparkles, Trophy, X } from 'lucide-react';
import { compressPostImage, createPost, fetchPosts } from '../api/posts';
import {
  fetchPhotoChallenge,
  fetchPhotoChallengeEntries,
  fetchPhotoChallengeWinnerId,
  submitPhotoChallengeEntry,
} from '../api/photoChallenges';

function formatDeadline(value) {
  return new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PhotoChallenge({ allSpots = [], currentUser, showToast } = {}) {
  const { id } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [entries, setEntries] = useState([]);
  const [winnerId, setWinnerId] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [mode, setMode] = useState('existing');
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [spotId, setSpotId] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef(null);

  const refreshEntries = async () => {
    if (!id) return;
    const [nextEntries, nextWinner] = await Promise.all([
      fetchPhotoChallengeEntries(id),
      fetchPhotoChallengeWinnerId(id),
    ]);
    setEntries(nextEntries);
    setWinnerId(nextWinner);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchPhotoChallenge(id), fetchPhotoChallengeEntries(id), fetchPhotoChallengeWinnerId(id)]).then(([nextChallenge, nextEntries, nextWinner]) => {
      if (!active) return;
      setChallenge(nextChallenge);
      setEntries(nextEntries);
      setWinnerId(nextWinner);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setMyPosts([]);
      return;
    }
    let active = true;
    fetchPosts({ profileId: currentUser.id, limit: 75 }).then((posts) => {
      if (active) setMyPosts(posts.filter((post) => post.images?.length));
    });
    return () => { active = false; };
  }, [currentUser?.id]);

  useEffect(() => () => { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); }, [photo?.previewUrl]);

  const myEntry = useMemo(() => entries.find((entry) => entry.userId === currentUser?.id) || null, [entries, currentUser?.id]);
  const winnerEntry = useMemo(() => entries.find((entry) => entry.id === winnerId) || null, [entries, winnerId]);
  const displayEntries = useMemo(() => [...entries].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  }), [entries, winnerId]);

  const chooseUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const processed = await compressPostImage(file);
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      setPhoto(processed);
    } catch (processingError) {
      setError(processingError.message || 'That photo could not be processed.');
    }
  };

  const submitExisting = async () => {
    if (!selectedPostId) return setError('Choose one of your posts first.');
    setSaving(true);
    setError('');
    const result = await submitPhotoChallengeEntry(id, selectedPostId);
    setSaving(false);
    if (!result.ok) return setError(result.error || 'Could not submit that photo.');
    await refreshEntries();
    showToast?.(myEntry ? 'Challenge entry changed.' : 'Photo entered in the challenge.');
  };

  const submitUpload = async () => {
    if (!photo) return setError('Choose a photo first.');
    const selectedSpot = allSpots.find((spot) => String(spot.id) === String(spotId));
    const locationName = selectedSpot?.name || customLocation.trim();
    if (!locationName) return setError('Choose a SnapMap spot or name the location.');
    setSaving(true);
    setError('');
    const created = await createPost({
      caption,
      locationName,
      latitude: selectedSpot?.latitude ?? null,
      longitude: selectedSpot?.longitude ?? null,
      spotId: selectedSpot?.id || null,
      images: [photo],
    });
    if (!created.post) {
      setSaving(false);
      return setError(created.error || 'Could not publish that photo.');
    }
    const result = await submitPhotoChallengeEntry(id, created.post.id);
    setSaving(false);
    if (!result.ok) return setError(result.error || 'The post published, but the challenge entry failed.');
    setCaption('');
    setSpotId('');
    setCustomLocation('');
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    await refreshEntries();
    setMyPosts(await fetchPosts({ profileId: currentUser.id, limit: 75 }));
    showToast?.('Photo published and entered in the challenge.');
  };

  if (loading) return <div className="page-shell flex min-h-[55vh] items-center justify-center"><Sparkles className="h-8 w-8 animate-pulse text-accent-400" /></div>;
  if (!challenge) return <div className="page-shell px-4 py-16 text-center"><Trophy className="mx-auto h-10 w-10 text-muted" /><h1 className="mt-4 text-xl font-extrabold text-primary">Challenge not found</h1><Link to="/explore?view=community" className="mt-5 inline-flex text-sm font-extrabold text-accent-400">Back to Community</Link></div>;

  return <div className="page-shell pb-28 animate-fade-in">
    <header className="page-header">
      <div className="mx-auto max-w-4xl">
        <Link to="/explore?view=community" className="icon-button mb-4 w-fit gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold"><ArrowLeft className="h-5 w-5" />Community</Link>
        <div className="rounded-[1.8rem] border border-accent-500/20 bg-gradient-to-br from-accent-500/[0.13] via-[var(--bg-page-elevated)] to-cyan-400/[0.06] p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-500 text-[#211603]"><Camera className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1"><p className="eyebrow">Weekly photo challenge</p><h1 className="mt-1 text-3xl font-black tracking-tight text-primary">{challenge.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">{challenge.prompt}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-1.5 ${challenge.isOpen ? 'bg-emerald-400/10 text-emerald-400' : challenge.isClosed ? 'bg-white/[0.06] text-muted' : 'bg-cyan-400/10 text-cyan-300'}`}>{challenge.isOpen ? 'Entries open' : challenge.isClosed ? 'Entries closed' : 'Coming soon'}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-muted"><Clock3 className="h-3.5 w-3.5" />{challenge.isClosed ? `Closed ${formatDeadline(challenge.endsAt)}` : `Closes ${formatDeadline(challenge.endsAt)}`}</span>
            <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
      </div>
    </header>

    <main className="mx-auto w-full max-w-4xl space-y-7 px-4 py-6 md:px-6">
      {winnerEntry && <section className="surface-card overflow-hidden rounded-[1.7rem] border-accent-500/25">
        <div className="grid sm:grid-cols-[1.2fr_1fr]">
          <Link to={`/explore?post=${winnerEntry.postId}`} className="aspect-[16/10] overflow-hidden bg-black sm:aspect-auto"><img src={winnerEntry.post?.images?.[0]?.public_url} alt="Challenge winner" className="h-full w-full object-cover" /></Link>
          <div className="p-5"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-accent-400"><Trophy className="h-4 w-4" />Featured winner</p><h2 className="mt-3 text-xl font-extrabold text-primary">{winnerEntry.author?.display_name || 'SnapMap creator'}</h2><p className="mt-2 line-clamp-4 text-sm leading-6 text-secondary">{winnerEntry.post?.caption || winnerEntry.post?.locationName || 'Winning frame'}</p><Link to={`/explore?post=${winnerEntry.postId}`} className="primary-button mt-5 w-fit px-4 py-2.5 text-sm">View winning post</Link></div>
        </div>
      </section>}

      {challenge.isOpen && <section className="surface-card rounded-[1.7rem] p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Your entry</p><h2 className="mt-1 text-xl font-extrabold text-primary">{myEntry ? 'You’re in. Change it anytime before close.' : 'Enter one photo'}</h2><p className="mt-1 text-xs leading-5 text-muted">Entries are regular SnapMap posts, so the same reporting and moderation rules apply.</p></div>{myEntry && <Check className="h-6 w-6 shrink-0 text-emerald-400" />}</div>
        {!currentUser ? <Link to="/signin" state={{ from: `/challenge/${challenge.id}`, authMessage: 'Sign in to enter the weekly photo challenge.' }} className="primary-button mt-5 w-full py-3 text-sm">Sign in to enter</Link> : <>
          <div className="mt-5 grid grid-cols-2 rounded-2xl bg-[var(--bg-input)] p-1"><button type="button" onClick={() => setMode('existing')} className={`rounded-xl px-3 py-2.5 text-xs font-extrabold ${mode === 'existing' ? 'bg-accent-500 text-[#211603]' : 'text-secondary'}`}>Use a post</button><button type="button" onClick={() => setMode('upload')} className={`rounded-xl px-3 py-2.5 text-xs font-extrabold ${mode === 'upload' ? 'bg-accent-500 text-[#211603]' : 'text-secondary'}`}>Upload here</button></div>
          {mode === 'existing' ? <div className="mt-4">
            {myPosts.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-5 py-8 text-center"><Camera className="mx-auto h-7 w-7 text-muted" /><p className="mt-3 text-sm font-extrabold text-primary">No photo posts yet</p><p className="mt-1 text-xs text-muted">Use Upload here to create one without leaving the challenge.</p></div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{myPosts.map((post) => <button key={post.id} type="button" onClick={() => setSelectedPostId(post.id)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-black ${selectedPostId === post.id ? 'border-accent-500' : myEntry?.postId === post.id ? 'border-emerald-400/70' : 'border-transparent'}`}><img src={post.images?.[0]?.public_url} alt="" className="h-full w-full object-cover" />{myEntry?.postId === post.id && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-black text-emerald-950">CURRENT</span>}{selectedPostId === post.id && <span className="absolute inset-0 grid place-items-center bg-black/25"><Check className="h-7 w-7 text-white" strokeWidth={3} /></span>}</button>)}</div>}
            <button type="button" onClick={submitExisting} disabled={saving || !selectedPostId} className="primary-button mt-4 w-full py-3 text-sm disabled:opacity-40">{saving ? 'Submitting…' : myEntry ? 'Use this photo instead' : 'Enter this photo'}</button>
          </div> : <div className="mt-4 space-y-3">
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseUpload} className="hidden" />
            {photo ? <div className="relative overflow-hidden rounded-2xl bg-black"><img src={photo.previewUrl} alt="Selected upload" className="aspect-[16/10] w-full object-cover" /><button type="button" onClick={() => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); setPhoto(null); }} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button></div> : <button type="button" onClick={() => photoRef.current?.click()} className="flex aspect-[16/8] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-accent-500/35 bg-accent-500/[0.04] text-accent-400"><ImagePlus className="h-8 w-8" /><span className="mt-2 text-sm font-extrabold">Choose photo</span></button>}
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={3} placeholder="Caption (optional)" className="surface-input w-full resize-none rounded-2xl p-3.5 text-sm" />
            <select value={spotId} onChange={(event) => { setSpotId(event.target.value); if (event.target.value) setCustomLocation(''); }} className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">Choose a SnapMap spot (optional)</option>{allSpots.filter((spot) => !String(spot.id).startsWith('user-')).map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select>
            {!spotId && <input value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} maxLength={160} placeholder="Or name the location" className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm" />}
            <button type="button" onClick={submitUpload} disabled={saving || !photo} className="primary-button w-full py-3 text-sm disabled:opacity-40">{saving ? 'Publishing…' : 'Publish and enter'}</button>
          </div>}
          {error && <p className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2 text-xs font-semibold text-rose-300">{error}</p>}
        </>}
      </section>}

      {challenge.isClosed && !winnerEntry && <section className="surface-card rounded-[1.7rem] px-6 py-8 text-center"><Trophy className="mx-auto h-8 w-8 text-accent-400" /><h2 className="mt-3 text-lg font-extrabold text-primary">Entries are closed</h2><p className="mt-1 text-sm text-muted">The featured winner will appear here after it’s selected.</p></section>}

      <section><div className="mb-4 flex items-end justify-between gap-3"><div><p className="eyebrow">Community entries</p><h2 className="mt-1 text-xl font-extrabold text-primary">This week’s frames</h2></div><span className="text-xs font-bold text-muted">{entries.length}</span></div>
        {displayEntries.length === 0 ? <div className="surface-card rounded-[1.6rem] px-6 py-12 text-center"><Camera className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 text-sm font-extrabold text-primary">No entries yet</p><p className="mt-1 text-xs text-muted">The first frame could be yours.</p></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{displayEntries.map((entry) => <Link key={entry.id} to={`/explore?post=${entry.postId}`} className={`surface-card group overflow-hidden rounded-[1.35rem] ${entry.id === winnerId ? 'ring-2 ring-accent-500' : ''}`}><div className="relative aspect-square overflow-hidden bg-black"><img src={entry.post?.images?.[0]?.public_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{entry.id === winnerId && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent-500 px-2 py-1 text-[9px] font-black text-[#211603]"><Trophy className="h-3 w-3" />WINNER</span>}</div><div className="p-3"><p className="truncate text-xs font-extrabold text-primary">{entry.author?.display_name || 'SnapMap creator'}</p><p className="mt-1 truncate text-[10px] text-muted">{entry.post?.locationName || 'Photo entry'}</p></div></Link>)}</div>}
      </section>
    </main>
  </div>;
}
