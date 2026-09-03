import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, CalendarDays, Copy, MapPin, Navigation, Pencil, Share2, Trash2, User, Users } from 'lucide-react';
import DirectionsLauncher from '../components/DirectionsLauncher';
import EventDiscussion from '../components/EventDiscussion';
import EventEditor from '../components/EventEditor';
import { deleteEvent, fetchEvent, setEventRsvpStatus, subscribeToEvents } from '../api/events';
import { isCurrentUserAdmin } from '../api/moderation';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { appleDirectionsUrl, googleDirectionsUrl } from '../utils/mapNavigation';
import { fetchEventReminder, setEventReminder } from '../api/eventReminders';

function fullDate(value) {
  return new Date(value).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EventDetail({ allSpots = [], currentUser, showToast } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchEvent(id);
    setEvent(result.event);
    setError(result.error || '');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    return subscribeToEvents(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!currentUser?.id) return setIsAdmin(false);
    isCurrentUserAdmin().then(setIsAdmin);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !event?.id || (!event.rsvpStatus && event.hostId !== currentUser.id)) {
      setReminder(null);
      return;
    }
    let cancelled = false;
    fetchEventReminder(event.id).then((value) => { if (!cancelled) setReminder(value); });
    return () => { cancelled = true; };
  }, [currentUser?.id, event?.id, event?.rsvpStatus, event?.hostId]);

  const spot = useMemo(() => {
    if (!event) return null;
    return allSpots.find((item) => String(item.id) === String(event.spotId)) || event.spot;
  }, [allSpots, event]);

  const chooseRsvp = async (selectedStatus) => {
    if (!currentUser || !event || busy) return;
    const previousStatus = event.rsvpStatus;
    const nextStatus = event.rsvpStatus === selectedStatus ? null : selectedStatus;
    setBusy(true);
    const result = await setEventRsvpStatus(event.id, nextStatus);
    setBusy(false);
    if (!result.ok) return showToast?.(result.error);
    if (nextStatus && !previousStatus) {
      setReminder({ eventId: event.id, dayBefore: true, hoursBefore: 3 });
      setEventReminder(event.id, true, 3);
    } else {
      setReminder(null);
    }
    setEvent((current) => {
      const previous = current.rsvpStatus;
      return {
        ...current,
        rsvpStatus: nextStatus,
        attending: nextStatus === 'going',
        interested: nextStatus === 'interested',
        attendeeCount: Math.max(0, current.attendeeCount - (previous === 'going' ? 1 : 0) + (nextStatus === 'going' ? 1 : 0)),
        interestedCount: Math.max(0, (current.interestedCount || 0) - (previous === 'interested' ? 1 : 0) + (nextStatus === 'interested' ? 1 : 0)),
      };
    });
  };

  const toggleReminder = async () => {
    if (!event || reminderBusy) return;
    const nextEnabled = !reminder;
    setReminderBusy(true);
    const result = await setEventReminder(event.id, nextEnabled, reminder?.hoursBefore || 3);
    setReminderBusy(false);
    if (!result.ok) return showToast?.(result.error);
    setReminder(nextEnabled ? { eventId: event.id, dayBefore: true, hoursBefore: 3 } : null);
    showToast?.(nextEnabled ? 'Event reminder turned on.' : 'Event reminder turned off.');
  };

  const remove = async () => {
    if (!event || !window.confirm(`Cancel “${event.title}”? Everyone’s RSVP will be removed.`)) return;
    setBusy(true);
    const ok = await deleteEvent(event.id);
    if (!ok) { setBusy(false); return showToast?.('Could not cancel the event.'); }
    showToast?.('Event canceled.');
    navigate('/explore?view=events', { replace: true });
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname || ''}#/event/${event.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: `${event.title} at ${event.venueName || spot?.name || 'the event location'}`, url }); return; } catch (shareError) { if (shareError?.name === 'AbortError') return; }
    }
    await navigator.clipboard.writeText(url);
    showToast?.('Event link copied.');
  };

  if (loading) return <div className="page-shell px-4 py-16"><div className="surface-card mx-auto h-96 max-w-3xl animate-pulse rounded-[1.75rem]" /></div>;
  if (!event || error) return <div className="page-shell px-4 py-16 text-center"><CalendarDays className="mx-auto h-9 w-9 text-muted" /><p className="mt-4 font-extrabold text-primary">Event unavailable</p><p className="mt-1 text-sm text-muted">{error || 'This event may have been canceled.'}</p><Link to="/explore?view=events" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Back to events</Link></div>;

  const full = event.maxAttendees && event.attendeeCount >= event.maxAttendees;
  const isHost = currentUser?.id === event.hostId;
  const canManage = isHost || isAdmin;
  const goingRsvps = (event.rsvps || []).filter((rsvp) => rsvp.status === 'going');
  const interestedRsvps = (event.rsvps || []).filter((rsvp) => rsvp.status === 'interested');
  const latitude = Number(event.latitude ?? spot?.latitude);
  const longitude = Number(event.longitude ?? spot?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasAddress = Boolean(event.address);
  const googleAddressUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`;
  const appleAddressUrl = `https://maps.apple.com/?daddr=${encodeURIComponent(event.address)}`;

  return (
    <div className="page-shell pb-36 animate-fade-in">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(-1)} className="icon-button" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
          <p className="eyebrow">Event details</p>
          <button type="button" onClick={share} className="icon-button" aria-label="Share event"><Share2 className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-6">
        <section className="surface-card overflow-hidden rounded-[1.75rem]">
          <div className="relative aspect-[16/10] overflow-hidden bg-black/20">
            <img src={getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-black/20" />
            <div className="absolute inset-x-0 bottom-0 p-5"><p className="eyebrow text-accent-300">{event.listingType === 'listed' ? event.eventType.replaceAll('_', ' ') : 'Hosted meetup'}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{event.title}</h1></div>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl bg-white/[0.045] p-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" /><div><p className="text-xs font-extrabold text-primary">{fullDate(event.startsAt)}</p>{event.endsAt && <p className="mt-1 text-[11px] text-muted">Ends {fullDate(event.endsAt)}</p>}</div></div>
              {event.spotId ? <Link to={`/spot/${event.spotId}`} className="flex gap-3 rounded-2xl bg-white/[0.045] p-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-primary">{event.venueName || spot?.name || 'SnapMap spot'}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted">{event.address || spot?.address || 'Pinned location'}</p></div></Link> : <div className="flex gap-3 rounded-2xl bg-white/[0.045] p-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-primary">{event.venueName || 'Event location'}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted">{event.address}</p></div></div>}
            </div>

            {event.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-secondary">{event.description}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              {event.listingType === 'listed' ? <span className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><CalendarDays className="h-4 w-4 text-accent-400" />Listed from {event.sourceLabel}</span> : <Link to={event.host?.username ? `/user/${event.host.username}` : '/explore?view=creators'} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">{event.host?.avatar_url ? <img src={event.host.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5" />}</span>{event.host?.display_name || event.host?.username || 'Creator'}</Link>}
              {hasCoordinates && <Link to={`/?event=${event.id}&lat=${latitude}&lng=${longitude}`} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><MapPin className="h-4 w-4 text-accent-400" />View on map</Link>}
              {hasCoordinates && <DirectionsLauncher googleUrl={googleDirectionsUrl(latitude, longitude)} appleUrl={appleDirectionsUrl(latitude, longitude)} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><Navigation className="h-4 w-4 text-accent-400" />Directions</DirectionsLauncher>}
              {!hasCoordinates && hasAddress && <DirectionsLauncher googleUrl={googleAddressUrl} appleUrl={appleAddressUrl} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><Navigation className="h-4 w-4 text-accent-400" />Directions</DirectionsLauncher>}
              {currentUser && <Link to={`/explore?view=events&duplicate=${event.id}`} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary"><Copy className="h-4 w-4 text-accent-400" />Duplicate event</Link>}
            </div>
          </div>
        </section>

        {canManage && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] py-3 text-sm font-extrabold text-cyan-300"><Pencil className="h-4 w-4" />Edit event or map pin</button>}
        {canManage && editing && <EventEditor event={event} spot={spot} onCancel={() => setEditing(false)} onSaved={(updated) => { setEvent(updated); setEditing(false); }} showToast={showToast} />}

        {currentUser && (event.rsvpStatus || isHost) && <section className="surface-card mt-4 flex items-center gap-3 rounded-[1.5rem] p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${reminder ? 'bg-accent-500/15 text-accent-400' : 'bg-white/[0.05] text-muted'}`}>{reminder ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-primary">Event reminders</p><p className="mt-0.5 text-xs text-muted">{reminder ? `On · 1 day and ${reminder.hoursBefore || 3} hours before` : 'Off for this event'}</p></div><button type="button" onClick={toggleReminder} disabled={reminderBusy} className={`rounded-xl px-3 py-2 text-xs font-extrabold disabled:opacity-50 ${reminder ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.06] text-secondary'}`}>{reminderBusy ? '…' : reminder ? 'On' : 'Turn on'}</button></section>}

        <section className="surface-card mt-4 rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Guest list</p><h2 className="mt-1 text-lg font-extrabold text-primary">{event.attendeeCount} going · {event.interestedCount || 0} interested</h2></div>{event.maxAttendees && <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-muted">{event.attendeeCount}/{event.maxAttendees}</span>}</div>
          {goingRsvps.length ? <div className="mt-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">Going</p><div className="flex flex-wrap gap-2">{goingRsvps.slice(0, 20).map((rsvp) => <Link key={rsvp.user_id} to={rsvp.profile?.username ? `/user/${rsvp.profile.username}` : '#'} className="flex items-center gap-2 rounded-full bg-emerald-400/[0.07] py-1.5 pl-1.5 pr-3 text-xs font-bold text-secondary"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-accent-500/15">{rsvp.profile?.avatar_url ? <img src={rsvp.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-accent-400" />}</span>{rsvp.profile?.display_name || rsvp.profile?.username || 'Creator'}</Link>)}</div></div> : <p className="mt-3 text-sm text-muted">No confirmed attendees yet.</p>}
          {interestedRsvps.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">Interested</p><div className="flex flex-wrap gap-2">{interestedRsvps.slice(0, 20).map((rsvp) => <Link key={rsvp.user_id} to={rsvp.profile?.username ? `/user/${rsvp.profile.username}` : '#'} className="flex items-center gap-2 rounded-full bg-cyan-400/[0.07] py-1.5 pl-1.5 pr-3 text-xs font-bold text-secondary"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-cyan-400/15">{rsvp.profile?.avatar_url ? <img src={rsvp.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-cyan-300" />}</span>{rsvp.profile?.display_name || rsvp.profile?.username || 'Creator'}</Link>)}</div></div>}
        </section>

        <EventDiscussion eventId={event.id} currentUser={currentUser} canManage={canManage} showToast={showToast} />

        {canManage && <button type="button" onClick={remove} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-rose-400 hover:bg-rose-400/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />{event.listingType === 'listed' ? 'Delete listing' : 'Cancel event'}</button>}
      </main>

      {!isHost && <div className="fixed bottom-[6.7rem] left-3 right-3 z-[1040] mx-auto max-w-lg rounded-[1.45rem] border border-white/10 bg-[var(--bg-nav)] p-2 shadow-2xl backdrop-blur-2xl">
        {currentUser ? <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => chooseRsvp('interested')} disabled={busy} className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'interested' ? 'bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/25' : 'bg-white/[0.055] text-secondary'}`}>{busy ? 'Saving…' : event.rsvpStatus === 'interested' ? 'Interested ✓' : 'Interested'}</button><button type="button" onClick={() => chooseRsvp('going')} disabled={busy || (full && event.rsvpStatus !== 'going')} className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'going' ? 'bg-emerald-400/15 text-emerald-400 ring-1 ring-emerald-400/20' : 'bg-accent-500 text-[#211603]'}`}><Users className="h-4 w-4" />{busy ? 'Saving…' : full && event.rsvpStatus !== 'going' ? 'Event full' : event.rsvpStatus === 'going' ? 'Going ✓' : 'Going'}</button></div> : <Link to="/signin" className="primary-button min-h-12 w-full text-sm">Sign in to RSVP</Link>}
      </div>}
    </div>
  );
}
