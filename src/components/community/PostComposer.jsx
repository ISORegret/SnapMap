import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, LocateFixed, X } from 'lucide-react';
import { compressPostImage, createPost } from '../../api/posts';

export default function PostComposer({ open, onClose, onCreated, allSpots = [], availableEvents = [], currentUser, userPosition, requestPosition, showToast, initialSpotId = '', initialEvent = null } = {}) {
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
