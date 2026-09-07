import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, Clock3, ImagePlus, MapPin, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { fetchUpcomingEvents, setEventRsvpStatus, subscribeToEvents } from '../api/events';
import { createHostedEventSeries } from '../api/hostedEvents';
import { compressPostImage } from '../api/posts';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { haversineKm, milesToKm } from '../utils/geo';
import { fetchActiveEventCheckInCounts, subscribeToEventCheckIns } from '../api/eventCheckIns';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function eventDate(value) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

const EVENT_TYPES = [
  ['all', 'All types'],
  ['car_show', 'Car shows'],
  ['cruise_in', 'Cruise-ins'],
  ['cars_and_coffee', 'Cars & coffee'],
  ['meetup', 'Meetups'],
];

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function weekendRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const daysUntilSaturday = day === 0 ? 0 : (6 - day + 7) % 7;
  if (day !== 0) start.setDate(start.getDate() + daysUntilSaturday);
  const end = new Date(start);
  if (day !== 0) end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  title: '',
  description: '',
  spotId: '',
  venueName: '',
  address: '',
  startsAt: '',
  endsAt: '',
  maxAttendees: '',
  eventType: 'meetup',
};

export default function EventHub({ allSpots = [], currentUser, userPosition = null, units = 'mi', showToast } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [repeat, setRepeat] = useState('none');
  const [occurrences, setOccurrences] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [whenFilter, setWhenFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [distanceMiles, setDistanceMiles] = useState(null);
  const [attendingOnly, setAttendingOnly] = useState(false);
  const [liveCounts, setLiveCounts] = useState({});
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);
  const cloudSpots = useMemo(() => allSpots.filter((spot) => UUID_PATTERN.test(String(spot.id || ''))), [allSpots]);

  useEffect(() => () => {
    if (coverPhoto?.previewUrl) URL.revokeObjectURL(coverPhoto.previewUrl);
  }, [coverPhoto?.previewUrl]);

  const visibleEvents = useMemo(() => {
    const now = new Date();
    const weekend = weekendRange(now);
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const starts = new Date(event.startsAt);
      if (query && ![event.title, event.venueName, event.address, event.description].some((value) => String(value || '').toLowerCase().includes(query))) return false;
      if (whenFilter === 'today' && !isSameDay(starts, now)) return false;
      if (whenFilter === 'weekend' && (starts < weekend.start || starts > weekend.end)) return false;
      if (typeFilter !== 'all' && event.eventType !== typeFilter) return false;
      if (attendingOnly && !event.attending) return false;
      if (distanceMiles != null) {
        if (!userPosition) return false;
        const spot = allSpots.find((item) => String(item.id) === String(event.spotId)) || event.spot;
        const latitude = Number(event.latitude ?? spot?.latitude);
        const longitude = Number(event.longitude ?? spot?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
        if (haversineKm(userPosition.lat, userPosition.lng, latitude, longitude) > milesToKm(distanceMiles)) return false;
      }
      return true;
    });
  }, [events, searchQuery, whenFilter, typeFilter, attendingOnly, distanceMiles, userPosition, allSpots]);

  const activeFilterCount = [whenFilter !== 'all', typeFilter !== 'all', distanceMiles != null, attendingOnly].filter(Boolean).length;
  const clearFilters = () => {
    setWhenFilter('all');
    setTypeFilter('all');
    setDistanceMiles(null);
    setAttendingOnly(false);
    setSearchQuery('');
  };

  const refresh = useCallback(async () => {
    const result = await fetchUpcomingEvents();
    setEvents(result.events);
    setError(result.error || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToEvents(refresh);
  }, [refresh]);

  useEffect(() => {
    if (events.length === 0) return undefined;
    let active = true;
    const refreshLiveCounts = () => fetchActiveEventCheckInCounts(events.map((event) => event.id)).then((counts) => { if (active) setLiveCounts(counts); });
    refreshLiveCounts();
    const unsubscribe = subscribeToEventCheckIns(refreshLiveCounts);
    const interval = window.setInterval(refreshLiveCounts, 60000);
    return () => { active = false; unsubscribe(); window.clearInterval(interval); };
  }, [events]);

  useEffect(() => {
    const duplicateId = searchParams.get('duplicate');
    if (!duplicateId || events.length === 0) return;
    const source = events.find((item) => String(item.id) === duplicateId);
    if (!source) return;
    const nextStart = new Date(source.startsAt);
    nextStart.setDate(nextStart.getDate() + 7);
    const duration = source.endsAt ? new Date(source.endsAt).getTime() - new Date(source.startsAt).getTime() : null;
    setForm({
      title: source.title || '',
      description: source.description || '',
      spotId: source.spotId || '',
      venueName: source.venueName || '',
      address: source.address || '',
      startsAt: localDateTime(nextStart),
      endsAt: duration ? localDateTime(new Date(nextStart.getTime() + duration)) : '',
      maxAttendees: source.maxAttendees || '',
      eventType: source.eventType || 'meetup',
    });
    setRepeat('none');
    setComposerOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('duplicate');
    setSearchParams(nextParams, { replace: true });
  }, [events, searchParams, setSearchParams]);

  const chooseCoverPhoto = async (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const processed = await compressPostImage(file);
      setCoverPhoto(processed);
    } catch (nextError) {
      setPhotoError(nextError?.message || 'That photo could not be processed.');
    }
  };

  const chooseSpot = (spotId) => {
    const selectedSpot = cloudSpots.find((spot) => String(spot.id) === String(spotId));
    setForm((current) => ({
      ...current,
      spotId,
      venueName: selectedSpot && !current.venueName.trim() ? selectedSpot.name || '' : current.venueName,
      address: selectedSpot && !current.address.trim() ? selectedSpot.address || '' : current.address,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.startsAt) return;
    if (new Date(form.startsAt).getTime() <= Date.now()) {
      showToast?.('Choose a future date and time.');
      return;
    }
    setSubmitting(true);
    const result = await createHostedEventSeries({ ...form, repeat, occurrences, coverPhoto });
    setSubmitting(false);
    if (result.error) {
      showToast?.(result.error);
      return;
    }
    setEvents((current) => [...current, ...result.events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
    setForm(EMPTY_FORM);
    setRepeat('none');
    setOccurrences(4);
    setCoverPhoto(null);
    setPhotoError('');
    setComposerOpen(false);
    if (result.warning) showToast?.(result.warning);
    else showToast?.(result.events.length > 1 ? `${result.events.length} events published.` : 'Event published.');
  };

  const chooseRsvp = async (event, selectedStatus) => {
    if (!currentUser) return;
    setRsvpBusy(event.id);
    const nextStatus = event.rsvpStatus === selectedStatus ? null : selectedStatus;
    const result = await setEventRsvpStatus(event.id, nextStatus);
    setRsvpBusy('');
    if (!result.ok) return showToast?.(result.error);
    setEvents((current) => current.map((item) => {
      if (item.id !== event.id) return item;
      const previous = item.rsvpStatus;
      const attendeeCount = Math.max(0, item.attendeeCount - (previous === 'going' ? 1 : 0) + (nextStatus === 'going' ? 1 : 0));
      const interestedCount = Math.max(0, (item.interestedCount || 0) - (previous === 'interested' ? 1 : 0) + (nextStatus === 'interested' ? 1 : 0));
      return { ...item, rsvpStatus: nextStatus, attending: nextStatus === 'going', interested: nextStatus === 'interested', attendeeCount, interestedCount };
    }));
  };

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="eyebrow">Shows & meetups</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Upcoming events</h2><p className="mt-1 text-xs text-muted">Local car shows plus events added manually by creators.</p></div>
        {currentUser ? (
          <button type="button" onClick={() => setComposerOpen((open) => !open)} className="primary-button shrink-0 px-3.5 py-2.5 text-xs"><Plus className="h-4 w-4" />Host</button>
        ) : <Link to="/signin" className="text-xs font-extrabold text-accent-400">Sign in to host</Link>}
      </div>

      <div className="mb-4 flex gap-2">
        <label className="surface-input flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl px-3.5"><Search className="h-4 w-4 shrink-0 text-muted" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search shows or venues" className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted" /></label>
        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={`relative flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-sm font-extrabold ${filtersOpen || activeFilterCount ? 'border-accent-500/30 bg-accent-500/10 text-accent-400' : 'border-[var(--border-subtle)] text-secondary'}`}><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-black text-[#211603]">{activeFilterCount}</span>}</button>
      </div>

      {filtersOpen && <div className="surface-card mb-5 rounded-[1.55rem] p-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-primary">Narrow the list</p>{(activeFilterCount > 0 || searchQuery) && <button type="button" onClick={clearFilters} className="text-xs font-extrabold text-accent-400">Clear all</button>}</div>
        <div className="mt-4 space-y-4">
          <div><p className="mb-2 text-xs font-bold text-muted">When</p><div className="flex flex-wrap gap-2">{[['all', 'Any date'], ['today', 'Today'], ['weekend', 'This weekend']].map(([value, label]) => <button key={value} type="button" onClick={() => setWhenFilter(value)} className={`rounded-full px-3 py-2 text-xs font-extrabold ${whenFilter === value ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.055] text-secondary'}`}>{whenFilter === value && <Check className="mr-1 inline h-3.5 w-3.5" />}{label}</button>)}</div></div>
          <div><p className="mb-2 text-xs font-bold text-muted">Event type</p><div className="flex flex-wrap gap-2">{EVENT_TYPES.map(([value, label]) => <button key={value} type="button" onClick={() => setTypeFilter(value)} className={`rounded-full px-3 py-2 text-xs font-extrabold ${typeFilter === value ? 'bg-cyan-400 text-[#05222a]' : 'bg-white/[0.055] text-secondary'}`}>{label}</button>)}</div></div>
          <div><p className="mb-2 text-xs font-bold text-muted">Distance</p><div className="flex flex-wrap gap-2">{[[null, 'Any distance'], [10, units === 'km' ? '16 km' : '10 mi'], [25, units === 'km' ? '40 km' : '25 mi'], [50, units === 'km' ? '80 km' : '50 mi']].map(([value, label]) => <button key={label} type="button" disabled={value != null && !userPosition} onClick={() => setDistanceMiles(value)} className={`rounded-full px-3 py-2 text-xs font-extrabold disabled:opacity-35 ${distanceMiles === value ? 'bg-cyan-400 text-[#05222a]' : 'bg-white/[0.055] text-secondary'}`}>{label}</button>)}</div>{!userPosition && <p className="mt-2 text-[11px] text-muted">Allow location access to filter by distance.</p>}</div>
          {currentUser && <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-3.5 py-3 text-sm font-bold text-secondary"><span>Only events I’m attending</span><input type="checkbox" checked={attendingOnly} onChange={(event) => setAttendingOnly(event.target.checked)} className="h-5 w-5 accent-amber-400" /></label>}
        </div>
      </div>}

      {composerOpen && (
        <form onSubmit={submit} className="surface-card mb-5 rounded-[1.6rem] border-accent-500/25 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">New meetup</p><h3 className="mt-1 text-lg font-extrabold text-primary">Host an event</h3></div><button type="button" onClick={() => setComposerOpen(false)} className="icon-button h-9 w-9 rounded-xl" aria-label="Close event form"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 space-y-3">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={100} required placeholder="Event name" className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm" />

            <div>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCoverPhoto} className="hidden" />
              {coverPhoto?.previewUrl ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img src={coverPhoto.previewUrl} alt="Event cover preview" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => { setCoverPhoto(null); setPhotoError(''); }} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl bg-black/65 text-white backdrop-blur" aria-label="Remove event cover"><X className="h-4 w-4" /></button>
                </div>
              ) : null}
              <button type="button" onClick={() => photoInputRef.current?.click()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 text-sm font-extrabold text-cyan-300"><ImagePlus className="h-4 w-4" />{coverPhoto ? 'Change cover photo' : 'Add cover photo'}</button>
              <p className="mt-1.5 text-[11px] text-muted">Optional. Use the event flyer or a photo from the event.</p>
              {photoError && <p className="mt-1.5 text-xs font-bold text-rose-400">{photoError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select value={form.eventType} onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))} className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="meetup">Meetup</option><option value="car_show">Car show</option><option value="cruise_in">Cruise-in</option><option value="cars_and_coffee">Cars & coffee</option></select>
              <select value={form.spotId} onChange={(event) => chooseSpot(event.target.value)} className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">SnapMap spot (optional)</option>{cloudSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.venueName} onChange={(event) => setForm((current) => ({ ...current, venueName: event.target.value }))} maxLength={160} placeholder="Venue name (optional)" className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm" />
              <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={300} placeholder="Address (optional)" className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-muted">Starts<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label><label className="block text-xs font-bold text-muted">Ends <span className="font-normal">(optional)</span><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label></div>
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={3} placeholder="What’s the plan? Add arrival details, what to bring, or the kind of shots you’re after." className="surface-input w-full resize-none rounded-2xl px-3.5 py-3 text-sm" />
            <label className="block text-xs font-bold text-muted">Attendance limit <span className="font-normal">(optional)</span><input type="number" min="2" max="500" value={form.maxAttendees} onChange={(event) => setForm((current) => ({ ...current, maxAttendees: event.target.value }))} placeholder="No limit" className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm" /></label>
            <div className="rounded-2xl bg-white/[0.035] p-3"><p className="text-xs font-bold text-muted">Repeat</p><div className="mt-2 grid grid-cols-3 gap-2">{[['none', 'One time'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([value, label]) => <button key={value} type="button" onClick={() => setRepeat(value)} className={`rounded-xl px-2 py-2.5 text-xs font-extrabold ${repeat === value ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.05] text-secondary'}`}>{label}</button>)}</div>{repeat !== 'none' && <label className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-secondary"><span>Number of events</span><select value={occurrences} onChange={(event) => setOccurrences(Number(event.target.value))} className="surface-input rounded-xl px-3 py-2 text-sm">{Array.from({ length: 11 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>}</div>
          </div>
          <button type="submit" disabled={submitting || !form.title.trim() || !form.startsAt} className="primary-button mt-4 w-full py-3 text-sm disabled:opacity-50">{submitting ? 'Publishing…' : repeat === 'none' ? 'Publish event' : `Publish ${occurrences} events`}</button>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="surface-card h-64 animate-pulse rounded-[1.6rem]" />)}</div>
      ) : error ? (
        <div className="surface-card rounded-[1.6rem] px-6 py-14 text-center"><CalendarDays className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">Events aren’t ready yet</p><p className="mt-1 text-sm text-muted">{error}</p></div>
      ) : events.length === 0 ? (
        <div className="surface-card rounded-[1.6rem] px-6 py-14 text-center"><CalendarDays className="mx-auto h-8 w-8 text-accent-400" /><p className="mt-4 font-extrabold text-primary">No upcoming meetups</p><p className="mt-1 text-sm text-muted">Host the first shoot at one of your favorite spots.</p></div>
      ) : visibleEvents.length === 0 ? (
        <div className="surface-card rounded-[1.6rem] px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">No matching events</p><p className="mt-1 text-sm text-muted">Try widening the date, type, or distance.</p><button type="button" onClick={clearFilters} className="mt-4 text-sm font-extrabold text-accent-400">Clear filters</button></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleEvents.map((event) => {
            const date = eventDate(event.startsAt);
            const spot = allSpots.find((item) => String(item.id) === String(event.spotId)) || event.spot;
            const full = event.maxAttendees && event.attendeeCount >= event.maxAttendees;
            const isHost = currentUser?.id === event.hostId;
            return (
              <article key={event.id} className="surface-card overflow-hidden rounded-[1.6rem]">
                <Link to={`/event/${event.id}`} className="relative block aspect-[16/9] overflow-hidden bg-black/20">
                  <img src={event.coverImageUrl || getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-accent-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#211603]">{date.day}</span>
                  {liveCounts[event.id] > 0 && <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#06291d] shadow-[0_0_20px_rgba(52,211,153,0.5)]"><i className="h-2 w-2 animate-pulse rounded-full bg-[#06291d]" />Live · {liveCounts[event.id]}</span>}
                </Link>
                <div className="p-4">
                  <Link to={`/event/${event.id}`}><h3 className="line-clamp-1 text-base font-extrabold text-primary">{event.title}</h3><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-secondary"><Clock3 className="h-3.5 w-3.5 text-accent-400" />{date.time}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted"><MapPin className="h-3.5 w-3.5 text-accent-400" />{event.venueName || event.spot?.name || 'Location TBD'}</p></Link>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                    {event.listingType === 'listed' ? <span className="truncate text-[11px] font-bold text-secondary">Listed from {event.sourceLabel}</span> : <Link to={event.host?.username ? `/user/${event.host.username}` : '/explore?view=creators'} className="flex min-w-0 items-center gap-2"><span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-accent-500/15">{event.host?.avatar_url && <img src={event.host.avatar_url} alt="" className="h-full w-full object-cover" />}</span><span className="truncate text-[11px] font-bold text-secondary">{event.host?.display_name || 'Creator'}</span></Link>}
                    {isHost ? <span className="shrink-0 rounded-xl bg-accent-500/10 px-3 py-2 text-[11px] font-extrabold text-accent-400">Hosting</span> : currentUser ? <div className="flex shrink-0 gap-1.5"><button type="button" onClick={() => chooseRsvp(event, 'interested')} disabled={rsvpBusy === event.id} className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'interested' ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/[0.055] text-secondary'}`}>Interested</button><button type="button" onClick={() => chooseRsvp(event, 'going')} disabled={rsvpBusy === event.id || (full && event.rsvpStatus !== 'going')} className={`rounded-xl px-2.5 py-2 text-[11px] font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'going' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-accent-500 text-[#211603]'}`}>{rsvpBusy === event.id ? '…' : full && event.rsvpStatus !== 'going' ? 'Full' : 'Going'}</button></div> : <Link to="/signin" className="text-[11px] font-extrabold text-accent-400">Sign in to RSVP</Link>}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Users className="h-3.5 w-3.5" />{event.attendeeCount} going · {event.interestedCount || 0} interested{event.maxAttendees ? ` · ${event.maxAttendees} max` : ''}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
