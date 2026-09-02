import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, MapPin, Plus, Users, X } from 'lucide-react';
import { createEvent, fetchUpcomingEvents, setEventRsvp, subscribeToEvents } from '../api/events';
import { getSpotPrimaryImage } from '../utils/spotImages';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function eventDate(value) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

export default function EventHub({ allSpots = [], currentUser, showToast }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState('');
  const [form, setForm] = useState({ title: '', description: '', spotId: '', startsAt: '', maxAttendees: '' });
  const cloudSpots = useMemo(() => allSpots.filter((spot) => UUID_PATTERN.test(String(spot.id || ''))), [allSpots]);

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

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.spotId || !form.startsAt) return;
    if (new Date(form.startsAt).getTime() <= Date.now()) {
      showToast?.('Choose a future date and time.');
      return;
    }
    setSubmitting(true);
    const result = await createEvent(form);
    setSubmitting(false);
    if (result.error) {
      showToast?.(result.error);
      return;
    }
    setEvents((current) => [...current, result.event].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
    setForm({ title: '', description: '', spotId: '', startsAt: '', maxAttendees: '' });
    setComposerOpen(false);
    showToast?.('Event published.');
  };

  const toggleRsvp = async (event) => {
    if (!currentUser) return;
    setRsvpBusy(event.id);
    const result = await setEventRsvp(event.id, !event.attending);
    setRsvpBusy('');
    if (!result.ok) return showToast?.(result.error);
    setEvents((current) => current.map((item) => item.id === event.id
      ? { ...item, attending: !item.attending, attendeeCount: Math.max(0, item.attendeeCount + (item.attending ? -1 : 1)) }
      : item));
  };

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="eyebrow">Meet at the frame</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Upcoming events</h2><p className="mt-1 text-xs text-muted">Photo walks, shoots, and creator meetups at SnapMap spots.</p></div>
        {currentUser ? (
          <button type="button" onClick={() => setComposerOpen((open) => !open)} className="primary-button shrink-0 px-3.5 py-2.5 text-xs"><Plus className="h-4 w-4" />Host</button>
        ) : <Link to="/signin" className="text-xs font-extrabold text-accent-400">Sign in to host</Link>}
      </div>

      {composerOpen && (
        <form onSubmit={submit} className="surface-card mb-5 rounded-[1.6rem] border-accent-500/25 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">New meetup</p><h3 className="mt-1 text-lg font-extrabold text-primary">Host an event</h3></div><button type="button" onClick={() => setComposerOpen(false)} className="icon-button h-9 w-9 rounded-xl" aria-label="Close event form"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 space-y-3">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={100} required placeholder="Event name" className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm" />
            <select value={form.spotId} onChange={(event) => setForm((current) => ({ ...current, spotId: event.target.value }))} required className="surface-input w-full rounded-2xl px-3.5 py-3 text-sm font-semibold"><option value="">Choose a SnapMap spot</option>{cloudSpots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select>
            <label className="block text-xs font-bold text-muted">Date and time<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm text-primary" /></label>
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={3} placeholder="What’s the plan? Add arrival details, what to bring, or the kind of shots you’re after." className="surface-input w-full resize-none rounded-2xl px-3.5 py-3 text-sm" />
            <label className="block text-xs font-bold text-muted">Attendance limit <span className="font-normal">(optional)</span><input type="number" min="2" max="500" value={form.maxAttendees} onChange={(event) => setForm((current) => ({ ...current, maxAttendees: event.target.value }))} placeholder="No limit" className="surface-input mt-1.5 w-full rounded-2xl px-3.5 py-3 text-sm" /></label>
          </div>
          <button type="submit" disabled={submitting || !form.title.trim() || !form.spotId || !form.startsAt} className="primary-button mt-4 w-full py-3 text-sm disabled:opacity-50">{submitting ? 'Publishing…' : 'Publish event'}</button>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="surface-card h-64 animate-pulse rounded-[1.6rem]" />)}</div>
      ) : error ? (
        <div className="surface-card rounded-[1.6rem] px-6 py-14 text-center"><CalendarDays className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-extrabold text-primary">Events aren’t ready yet</p><p className="mt-1 text-sm text-muted">{error}</p></div>
      ) : events.length === 0 ? (
        <div className="surface-card rounded-[1.6rem] px-6 py-14 text-center"><CalendarDays className="mx-auto h-8 w-8 text-accent-400" /><p className="mt-4 font-extrabold text-primary">No upcoming meetups</p><p className="mt-1 text-sm text-muted">Host the first shoot at one of your favorite spots.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => {
            const date = eventDate(event.startsAt);
            const spot = allSpots.find((item) => String(item.id) === String(event.spotId)) || event.spot;
            const full = event.maxAttendees && event.attendeeCount >= event.maxAttendees;
            const isHost = currentUser?.id === event.hostId;
            return (
              <article key={event.id} className="surface-card overflow-hidden rounded-[1.6rem]">
                <Link to={`/event/${event.id}`} className="relative block aspect-[16/9] overflow-hidden bg-black/20">
                  <img src={getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-accent-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#211603]">{date.day}</span>
                </Link>
                <div className="p-4">
                  <Link to={`/event/${event.id}`}><h3 className="line-clamp-1 text-base font-extrabold text-primary">{event.title}</h3><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-secondary"><Clock3 className="h-3.5 w-3.5 text-accent-400" />{date.time}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted"><MapPin className="h-3.5 w-3.5 text-accent-400" />{event.spot?.name || 'SnapMap spot'}</p></Link>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                    <Link to={event.host?.username ? `/user/${event.host.username}` : '/explore?view=creators'} className="flex min-w-0 items-center gap-2"><span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-accent-500/15">{event.host?.avatar_url && <img src={event.host.avatar_url} alt="" className="h-full w-full object-cover" />}</span><span className="truncate text-[11px] font-bold text-secondary">{event.host?.display_name || event.host?.username || 'Creator'}</span></Link>
                    {isHost ? <span className="shrink-0 rounded-xl bg-accent-500/10 px-3 py-2 text-[11px] font-extrabold text-accent-400">Hosting</span> : currentUser ? <button type="button" onClick={() => toggleRsvp(event)} disabled={rsvpBusy === event.id || (full && !event.attending)} className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-extrabold disabled:opacity-50 ${event.attending ? 'bg-emerald-400/15 text-emerald-400' : 'bg-accent-500 text-[#211603]'}`}>{rsvpBusy === event.id ? 'Saving…' : event.attending ? 'Going ✓' : full ? 'Full' : 'RSVP'}</button> : <Link to="/signin" className="text-[11px] font-extrabold text-accent-400">Sign in to RSVP</Link>}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Users className="h-3.5 w-3.5" />{event.attendeeCount} going{event.maxAttendees ? ` · ${event.maxAttendees} max` : ''}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
