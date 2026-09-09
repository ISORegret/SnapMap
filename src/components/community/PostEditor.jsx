import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocateFixed, X } from 'lucide-react';
import { updatePost } from '../../api/posts';

export default function PostEditor({ post, open, onClose, onSaved, allSpots = [], availableEvents = [], userPosition, requestPosition, showToast }) {
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
