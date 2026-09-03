import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, ImagePlus, LocateFixed, MapPin, Save, Search, Trash2, X } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { removeEventCoverImage, replaceEventCoverImage, updateEvent } from '../api/events';
import { compressPostImage } from '../api/posts';
import { getSpotPrimaryImage } from '../utils/spotImages';

const pinIcon = L.divIcon({
  className: 'snapmap-marker-wrap',
  html: '<span class="snapmap-event-marker"><b>◆</b></span>',
  iconSize: [38, 46],
  iconAnchor: [19, 42],
});

function validCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Number(latitude) >= -90 && Number(latitude) <= 90
    && Number(longitude) >= -180 && Number(longitude) <= 180;
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function PinPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function Recenter({ position }) {
  const map = useMap();
  React.useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.55 });
  }, [map, position?.[0], position?.[1]]);
  return null;
}

export default function EventEditor({ event, spot, onCancel, onSaved, showToast }) {
  const initialPin = validCoordinate(event.latitude, event.longitude)
    ? { lat: Number(event.latitude), lng: Number(event.longitude) }
    : null;
  const fallbackCenter = validCoordinate(spot?.latitude, spot?.longitude)
    ? [Number(spot.latitude), Number(spot.longitude)]
    : [30.3322, -81.6557];
  const [form, setForm] = useState({
    title: event.title || '',
    venueName: event.venueName || '',
    address: event.address || '',
    eventType: event.eventType || 'car_show',
    startsAt: localDateTime(event.startsAt),
    endsAt: localDateTime(event.endsAt),
    description: event.description || '',
    maxAttendees: event.maxAttendees || '',
    latitude: initialPin?.lat ?? '',
    longitude: initialPin?.lng ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);
  const pin = useMemo(() => validCoordinate(form.latitude, form.longitude)
    ? [Number(form.latitude), Number(form.longitude)]
    : null, [form.latitude, form.longitude]);
  const displayedPhoto = photo?.previewUrl || (!removePhoto && event.coverImageUrl) || getSpotPrimaryImage(spot);

  useEffect(() => () => { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); }, [photo?.previewUrl]);

  const choosePhoto = async (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const processed = await compressPostImage(file);
      setPhoto(processed);
      setRemovePhoto(false);
    } catch (error) {
      setPhotoError(error?.message || 'That photo could not be processed.');
    }
  };

  const setPin = (lat, lng) => setForm((current) => ({
    ...current,
    latitude: Number(lat).toFixed(6),
    longitude: Number(lng).toFixed(6),
  }));

  const findAddress = async () => {
    if (!form.address.trim()) return showToast?.('Enter an address first.');
    setFinding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.address.trim())}&format=json&limit=1`, { headers: { Accept: 'application/json' } });
      const result = response.ok ? (await response.json())?.[0] : null;
      if (!result) showToast?.('Address not found. Tap the map to place the pin manually.');
      else setPin(result.lat, result.lon);
    } catch {
      showToast?.('Address lookup failed. Tap the map to place the pin manually.');
    } finally {
      setFinding(false);
    }
  };

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    const result = await updateEvent(event.id, form);
    if (result.error) { setSaving(false); return showToast?.(result.error); }
    let savedEvent = { ...event, ...result.event };
    if (photo) {
      const photoResult = await replaceEventCoverImage(savedEvent, photo);
      if (photoResult.error) { setSaving(false); return showToast?.(`Event details saved. ${photoResult.error}`); }
      savedEvent = { ...savedEvent, ...photoResult.event };
    } else if (removePhoto && event.coverImageUrl) {
      const photoResult = await removeEventCoverImage(savedEvent);
      if (photoResult.error) { setSaving(false); return showToast?.(`Event details saved. ${photoResult.error}`); }
      savedEvent = { ...savedEvent, ...photoResult.event };
    }
    setSaving(false);
    showToast?.('Event updated.');
    onSaved({
      ...savedEvent,
      rsvps: event.rsvps,
      rsvpStatus: event.rsvpStatus,
      attendeeCount: event.attendeeCount,
      interestedCount: event.interestedCount,
      attending: event.attending,
      interested: event.interested,
    });
  };

  return (
    <form onSubmit={submit} className="surface-card mt-4 rounded-[1.75rem] border-cyan-400/20 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow text-cyan-300">Event editor</p><h2 className="mt-1 text-lg font-extrabold text-primary">Correct this listing</h2></div>
        <button type="button" onClick={onCancel} className="icon-button h-10 w-10" aria-label="Close editor"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/25">
          <img src={displayedPhoto} alt="Event cover preview" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur">{photo ? 'New event photo' : removePhoto ? 'Location photo fallback' : event.coverImageUrl ? 'Current event photo' : 'Location photo fallback'}</span>
        </div>
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => photoInputRef.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 text-sm font-extrabold text-cyan-300"><ImagePlus className="h-4 w-4" />{event.coverImageUrl || photo ? 'Replace photo' : 'Add event photo'}</button>
          {(event.coverImageUrl || photo) ? <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(Boolean(event.coverImageUrl)); setPhotoError(''); }} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 text-sm font-extrabold text-secondary"><Trash2 className="h-4 w-4" />{photo && !event.coverImageUrl ? 'Clear photo' : 'Remove photo'}</button> : <div />}
        </div>
        <p className="mt-2 text-xs text-muted">Use the event flyer or an actual photo from the show. JPG, PNG, or WebP up to 20 MB.</p>
        {photoError && <p className="mt-2 text-xs font-bold text-rose-400">{photoError}</p>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-muted sm:col-span-2">Event name<input required maxLength={100} value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
        <label className="text-xs font-bold text-muted">Venue<input maxLength={160} value={form.venueName} onChange={(e) => setForm((current) => ({ ...current, venueName: e.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
        <label className="text-xs font-bold text-muted">Type<select value={form.eventType} onChange={(e) => setForm((current) => ({ ...current, eventType: e.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary"><option value="car_show">Car show</option><option value="cruise_in">Cruise-in</option><option value="cars_and_coffee">Cars & coffee</option><option value="meetup">Meetup</option></select></label>
        <label className="text-xs font-bold text-muted sm:col-span-2">Address<div className="mt-1.5 flex gap-2"><input maxLength={300} value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} className="surface-input min-w-0 flex-1 rounded-2xl px-3.5 py-3 text-sm text-primary" /><button type="button" onClick={findAddress} disabled={finding} className="icon-button h-12 w-12 shrink-0" aria-label="Find address on map">{finding ? <LocateFixed className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div></label>
        <label className="text-xs font-bold text-muted">Starts<input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
        <label className="text-xs font-bold text-muted">Ends <span className="font-normal">(optional)</span><input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
        <label className="text-xs font-bold text-muted sm:col-span-2">Details<textarea rows={4} maxLength={1200} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className="surface-input mt-1.5 w-full resize-none rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-extrabold text-primary">Exact map pin</p><p className="text-xs text-muted">Search the address, tap the map, or drag the pin.</p></div>{pin && <button type="button" onClick={() => setForm((current) => ({ ...current, latitude: '', longitude: '' }))} className="text-xs font-bold text-muted">Clear</button>}</div>
        <div className="h-64 overflow-hidden rounded-[1.35rem] border border-white/10">
          <MapContainer center={pin || fallbackCenter} zoom={pin ? 15 : 11} className="h-full w-full" zoomControl>
            <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
            <PinPicker onPick={setPin} />
            {pin && <><Recenter position={pin} /><Marker position={pin} icon={pinIcon} draggable eventHandlers={{ dragend: (e) => { const next = e.target.getLatLng(); setPin(next.lat, next.lng); } }} /></>}
          </MapContainer>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">{pin ? <><Crosshair className="h-4 w-4 text-cyan-300" />{Number(pin[0]).toFixed(6)}, {Number(pin[1]).toFixed(6)}</> : <><MapPin className="h-4 w-4" />No exact pin set yet</>}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="rounded-2xl border border-white/10 py-3 text-sm font-extrabold text-secondary">Cancel</button><button type="submit" disabled={saving} className="primary-button py-3 text-sm disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  );
}
