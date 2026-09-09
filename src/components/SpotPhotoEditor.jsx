import React, { useRef, useState } from 'react';
import { resizeImageToDataUrl } from '../utils/spotImages';

export default function SpotPhotoEditor({ images, setImages, uploaderName, onError, onBusyChange, disabled }) {
  const addInput = useRef(null);
  const replaceInput = useRef(null);
  const replacement = useRef(null);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  const locked = disabled || busy;

  const loadPhotos = async (event, replace = false) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || processing.current || disabled) return;
    const index = replace ? replacement.current : null;
    if (files.some((file) => !file.type.startsWith('image/'))) {
      onError('Please choose an image file.');
      return;
    }
    processing.current = true;
    setBusy(true);
    onBusyChange(true);
    onError('');
    try {
      const selected = replace ? files.slice(0, 1) : files;
      const photos = await Promise.all(selected.map(async (file) => ({
        uri: await resizeImageToDataUrl(file, 1200, 0.85),
        photoBy: uploaderName,
        uploadedBy: uploaderName,
      })));
      setImages((current) => index == null
        ? [...current, ...photos]
        : current.map((photo, i) => i === index ? photos[0] : photo));
    } catch {
      onError('Could not load that photo. Your existing photos are unchanged. Try another image.');
    } finally {
      processing.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= images.length) return;
    setImages((current) => {
      const next = [...current];
      const [photo] = next.splice(from, 1);
      next.splice(to, 0, photo);
      return next;
    });
  };
  const buttonClass = 'rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-secondary disabled:opacity-30';

  return <fieldset disabled={locked} className="mt-2 space-y-3">
    <legend className="sr-only">Spot photos</legend>
    <p className="text-xs text-muted">The first photo is the cover. Changes take effect when you save the spot.</p>
    <input ref={addInput} type="file" multiple accept="image/*" onChange={(event) => loadPhotos(event)} className="hidden" aria-label="Add spot photos" />
    <input ref={replaceInput} type="file" accept="image/*" onChange={(event) => loadPhotos(event, true)} className="hidden" aria-label="Replace spot photo" />
    {images.map((photo, index) => <div key={index} className="rounded-2xl border border-white/10 bg-[var(--bg-input)] p-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-800">
        <img src={photo.uri} alt={`Spot photo ${index + 1}`} className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {index > 0 && <button type="button" className={buttonClass} onClick={() => move(index, 0)}>Make cover</button>}
        <button type="button" className={buttonClass} disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, index - 1)}>Move earlier</button>
        <button type="button" className={buttonClass} disabled={index === images.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => move(index, index + 1)}>Move later</button>
        <button type="button" className={buttonClass} aria-label={`Replace photo ${index + 1}`} onClick={() => { replacement.current = index; replaceInput.current?.click(); }}>Replace</button>
        <button type="button" className={buttonClass} aria-label={`Remove photo ${index + 1}`} onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>Remove</button>
      </div>
      <label className="mt-3 block text-xs text-muted">Photographer credit
        <input type="text" value={photo.photoBy || ''} onChange={(event) => {
          const photoBy = event.target.value;
          setImages((current) => current.map((item, i) => i === index ? { ...item, photoBy } : item));
        }} className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-primary" />
      </label>
      <p className="mt-1 text-xs text-muted">Uploaded by {photo.uploadedBy || uploaderName}</p>
    </div>)}
    <button type="button" onClick={() => addInput.current?.click()} className="w-full rounded-2xl border border-dashed border-accent-500/40 px-4 py-3 text-sm font-semibold text-accent-400">{images.length ? 'Add more photos' : 'Choose photos'}</button>
    {busy && <p role="status" className="text-sm text-muted">Preparing photos…</p>}
  </fieldset>;
}
