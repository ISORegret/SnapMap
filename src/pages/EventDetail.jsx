import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Bell, BellOff, CalendarDays, Copy, Flag, LocateFixed, LogOut, MapPin, MessageCircle, Navigation, Pencil, Radio, Share2, ShieldCheck, Trash2, User, Users, X } from 'lucide-react';
import DirectionsLauncher from '../components/DirectionsLauncher';
import EventDiscussion from '../components/EventDiscussion';
import EventEditor from '../components/EventEditor';
import { deleteEvent, fetchEvent, setEventRsvpStatus, subscribeToEvents } from '../api/events';
import { isCurrentUserAdmin } from '../api/moderation';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { appleDirectionsUrl, googleDirectionsUrl } from '../utils/mapNavigation';
import { fetchEventReminder, setEventReminder } from '../api/eventReminders';
import { checkInToEvent, fetchEventCheckIns, leaveEventCheckIn, subscribeToEventCheckIns } from '../api/eventCheckIns';
import { reportEvent } from '../api/eventReports';
import { fetchMyEventClaim, submitEventClaim } from '../api/eventClaims';

function fullDate(value) {
  return new Date(value).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EventDetail({ allSpots = [], currentUser, userPosition = null, requestPosition, showToast } = {}) {
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
  const [checkIns, setCheckIns] = useState([]);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState('wrong_location');
  const [reportNote, setReportNote] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [claim, setClaim] = useState(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimRole, setClaimRole] = useState('organizer');
  const [claimContact, setClaimContact] = useState('');
  const [claimProof, setClaimProof] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);

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
    if (!id) return undefined;
    let active = true;
    const refreshCheckIns = () => fetchEventCheckIns(id).then((items) => { if (active) setCheckIns(items); });
    refreshCheckIns();
    const unsubscribe = subscribeToEventCheckIns(refreshCheckIns, id);
    const interval = window.setInterval(refreshCheckIns, 60000);
    return () => { active = false; unsubscribe(); window.clearInterval(interval); };
  }, [id]);

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

  useEffect(() => {
    if (!currentUser?.id || !event?.id || event.listingType !== 'listed') return setClaim(null);
    let active = true;
    fetchMyEventClaim(event.id).then((value) => { if (active) setClaim(value); });
    return () => { active = false; };
  }, [currentUser?.id, event?.id, event?.listingType]);

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

  const toggleCheckIn = async () => {
    if (!event || !currentUser || checkInBusy) return;
    const checkedIn = checkIns.some((item) => item.userId === currentUser.id);
    setCheckInBusy(true);
    if (checkedIn) {
      const ok = await leaveEventCheckIn(event.id);
      setCheckInBusy(false);
      if (!ok) return showToast?.('Could not remove your check-in.');
      setCheckIns((items) => items.filter((item) => item.userId !== currentUser.id));
      return showToast?.('You left the live check-in.');
    }
    const position = await requestPosition?.() || userPosition;
    const result = await checkInToEvent(event.id, position);
    setCheckInBusy(false);
    if (!result.ok) return showToast?.(result.error);
    setCheckIns(await fetchEventCheckIns(event.id));
    showToast?.('You’re checked in. Have a great shoot.');
  };

  const remove = async () => {
    if (!event || !window.confirm(`Cancel “${event.title}”? Everyone’s RSVP will be removed.`)) return;
    setBusy(true);
    const ok = await deleteEvent(event.id, event.coverImagePath);
    if (!ok) { setBusy(false); return showToast?.('Could not cancel the event.'); }
    showToast?.('Event canceled.');
    navigate('/explore?view=events', { replace: true });
  };

  const submitReport = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!event || reportBusy) return;
    setReportBusy(true);
    const result = await reportEvent(event.id, reportType, reportNote);
    setReportBusy(false);
    if (!result.ok) return showToast?.(result.error);
    setReportSent(true);
    setReportOpen(false);
    setReportNote('');
    showToast?.('Event report sent. Thank you.');
  };

  const submitClaim = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!event || claimBusy) return;
    setClaimBusy(true);
    const result = await submitEventClaim({ eventId: event.id, organizerRole: claimRole, verificationContact: claimContact, proofNote: claimProof });
    setClaimBusy(false);
    if (!result.claim) return showToast?.(result.error);
    setClaim(result.claim);
    setClaimOpen(false);
    showToast?.('Ownership claim sent for review.');
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
  const now = Date.now();
  const checkInOpensAt = new Date(event.startsAt).getTime() - (3 * 60 * 60 * 1000);
  const checkInClosesAt = (event.endsAt ? new Date(event.endsAt).getTime() : new Date(event.startsAt).getTime() + (8 * 60 * 60 * 1000)) + (60 * 60 * 1000);
  const checkInOpen = now >= checkInOpensAt && now <= checkInClosesAt;
  const checkedIn = Boolean(currentUser && checkIns.some((item) => item.userId === currentUser.id));

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
            <img src={event.coverImageUrl || getSpotPrimaryImage(spot)} alt="" className="h-full w-full object-cover" />
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
              {currentUser && <Link to="/messages" state={{ share: { type: 'event', id: event.id, title: event.title, subtitle: `${event.venueName || spot?.name || 'Event'} · ${fullDate(event.startsAt)}`, imageUrl: event.coverImageUrl || getSpotPrimaryImage(spot) || '' } }} className="flex items-center gap-2 rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] px-3 py-2.5 text-xs font-bold text-accent-400"><MessageCircle className="h-4 w-4" />Send to friend</Link>}
            </div>
          </div>
        </section>

        {canManage && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] py-3 text-sm font-extrabold text-cyan-300"><Pencil className="h-4 w-4" />Edit event or map pin</button>}
        {canManage && editing && <EventEditor event={event} spot={spot} onCancel={() => setEditing(false)} onSaved={(updated) => { setEvent(updated); setEditing(false); }} showToast={showToast} />}

        {event.listingType === 'listed' && currentUser && !isAdmin && <section className="mt-4">
          {claim?.status === 'pending' ? <div className="surface-card flex items-start gap-3 rounded-[1.5rem] border-cyan-400/20 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-extrabold text-primary">Ownership claim pending</p><p className="mt-1 text-xs leading-relaxed text-muted">We’ll review your organizer details. If approved, this event will move into your profile and become editable.</p></div></div> : !claimOpen ? <button type="button" onClick={() => setClaimOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] py-3 text-sm font-extrabold text-cyan-300"><BadgeCheck className="h-4 w-4" />Are you the organizer? Claim this event</button> : <form onSubmit={submitClaim} className="surface-card rounded-[1.65rem] border-cyan-400/20 p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="eyebrow text-cyan-300">Organizer verification</p><h2 className="mt-1 text-lg font-extrabold text-primary">Claim this event</h2></div><button type="button" onClick={() => setClaimOpen(false)} className="icon-button" aria-label="Close claim form"><X className="h-4 w-4" /></button></div>
            <label className="mt-4 block text-sm font-bold text-secondary">Your role<select value={claimRole} onChange={(event) => setClaimRole(event.target.value)} className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm"><option value="organizer">Event organizer</option><option value="venue">Venue owner or manager</option><option value="staff">Event staff</option></select></label>
            <label className="mt-3 block text-sm font-bold text-secondary">Verification contact<input value={claimContact} onChange={(event) => setClaimContact(event.target.value)} maxLength={300} placeholder="Official email, website, or social account" className="surface-input mt-2 w-full rounded-2xl px-3.5 py-3 text-sm" /></label>
            <label className="mt-3 block text-sm font-bold text-secondary">How can we verify you?<textarea value={claimProof} onChange={(event) => setClaimProof(event.target.value)} maxLength={1500} rows={4} placeholder="Explain your connection to the event and anything we should check." className="surface-input mt-2 w-full resize-none rounded-2xl p-3.5 text-sm" /></label>
            <p className="mt-3 text-xs leading-relaxed text-muted">Your verification details are only visible to SnapMap moderators.</p>
            <button type="submit" disabled={claimBusy} className="primary-button mt-4 w-full py-3 text-sm disabled:opacity-50">{claimBusy ? 'Submitting…' : 'Submit ownership claim'}</button>
          </form>}
        </section>}

        {currentUser && (event.rsvpStatus || isHost) && <section className="surface-card mt-4 flex items-center gap-3 rounded-[1.5rem] p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${reminder ? 'bg-accent-500/15 text-accent-400' : 'bg-white/[0.05] text-muted'}`}>{reminder ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-primary">Event reminders</p><p className="mt-0.5 text-xs text-muted">{reminder ? `On · 1 day and ${reminder.hoursBefore || 3} hours before` : 'Off for this event'}</p></div><button type="button" onClick={toggleReminder} disabled={reminderBusy} className={`rounded-xl px-3 py-2 text-xs font-extrabold disabled:opacity-50 ${reminder ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.06] text-secondary'}`}>{reminderBusy ? '…' : reminder ? 'On' : 'Turn on'}</button></section>}

        <section className={`surface-card mt-4 rounded-[1.75rem] p-5 ${checkIns.length ? 'border-emerald-400/25 shadow-[0_0_32px_rgba(52,211,153,0.08)]' : ''}`}>
          <div className="flex items-start gap-3">
            <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${checkIns.length ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/[0.05] text-muted'}`}><Radio className="h-5 w-5" />{checkIns.length > 0 && <i className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 ring-4 ring-emerald-400/15" />}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-extrabold text-primary">Live attendance</h2>{checkIns.length > 0 && <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">Live · {checkIns.length} here</span>}</div><p className="mt-1 text-xs leading-relaxed text-muted">{checkIns.length ? `${checkIns.length === 1 ? 'One creator is' : `${checkIns.length} creators are`} currently checked in.` : checkInOpen ? 'Be the first creator to check in.' : now < checkInOpensAt ? `Check-in opens ${new Date(checkInOpensAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : 'Live check-in has ended.'}</p></div>
          </div>
          {checkIns.length > 0 && <div className="mt-4 flex -space-x-2">{checkIns.slice(0, 10).map((item) => <Link key={item.userId} to={item.profile?.username ? `/user/${item.profile.username}` : '#'} title={item.profile?.display_name || item.profile?.username || 'Creator'} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-[var(--bg-card-solid)] bg-emerald-400/15 text-emerald-300">{item.profile?.avatar_url ? <img src={item.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}</Link>)}</div>}
          <div className="mt-4">
            {currentUser ? <button type="button" onClick={toggleCheckIn} disabled={checkInBusy || (!checkedIn && !checkInOpen)} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold disabled:opacity-40 ${checkedIn ? 'border border-white/10 bg-white/[0.045] text-secondary' : 'bg-emerald-400 text-[#06291d]'}`}>{checkedIn ? <LogOut className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}{checkInBusy ? 'Updating…' : checkedIn ? 'Leave check-in' : checkInOpen ? 'I’m here' : 'Check-in unavailable'}</button> : <Link to="/signin" className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-400 text-sm font-extrabold text-[#06291d]">Sign in to check in</Link>}
            <p className="mt-2 text-center text-[11px] text-muted">Your location is only used to confirm you’re within 2 miles. It is never saved.</p>
          </div>
        </section>

        <section className="surface-card mt-4 rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Guest list</p><h2 className="mt-1 text-lg font-extrabold text-primary">{event.attendeeCount} going · {event.interestedCount || 0} interested</h2></div>{event.maxAttendees && <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-muted">{event.attendeeCount}/{event.maxAttendees}</span>}</div>
          {goingRsvps.length ? <div className="mt-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">Going</p><div className="flex flex-wrap gap-2">{goingRsvps.slice(0, 20).map((rsvp) => <Link key={rsvp.user_id} to={rsvp.profile?.username ? `/user/${rsvp.profile.username}` : '#'} className="flex items-center gap-2 rounded-full bg-emerald-400/[0.07] py-1.5 pl-1.5 pr-3 text-xs font-bold text-secondary"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-accent-500/15">{rsvp.profile?.avatar_url ? <img src={rsvp.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-accent-400" />}</span>{rsvp.profile?.display_name || rsvp.profile?.username || 'Creator'}</Link>)}</div></div> : <p className="mt-3 text-sm text-muted">No confirmed attendees yet.</p>}
          {interestedRsvps.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">Interested</p><div className="flex flex-wrap gap-2">{interestedRsvps.slice(0, 20).map((rsvp) => <Link key={rsvp.user_id} to={rsvp.profile?.username ? `/user/${rsvp.profile.username}` : '#'} className="flex items-center gap-2 rounded-full bg-cyan-400/[0.07] py-1.5 pl-1.5 pr-3 text-xs font-bold text-secondary"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-cyan-400/15">{rsvp.profile?.avatar_url ? <img src={rsvp.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-cyan-300" />}</span>{rsvp.profile?.display_name || rsvp.profile?.username || 'Creator'}</Link>)}</div></div>}
        </section>

        <EventDiscussion eventId={event.id} currentUser={currentUser} canManage={canManage} showToast={showToast} />

        {!canManage && currentUser && <section className="mt-4">
          {reportSent ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-center text-sm font-bold text-emerald-400">Thanks—this event was reported for review.</p> : !reportOpen ? <button type="button" onClick={() => setReportOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-muted hover:bg-white/[0.035] hover:text-secondary"><Flag className="h-4 w-4" />Report incorrect event information</button> : <form onSubmit={submitReport} className="surface-card rounded-[1.65rem] p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Help keep events accurate</p><h2 className="mt-1 text-lg font-extrabold text-primary">What needs correcting?</h2></div><button type="button" onClick={() => setReportOpen(false)} className="icon-button" aria-label="Close report form"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 grid grid-cols-2 gap-2">{[
              ['wrong_location', 'Wrong address or pin'],
              ['wrong_date_time', 'Wrong date or time'],
              ['canceled', 'Event canceled'],
              ['duplicate', 'Duplicate listing'],
              ['wrong_details', 'Other incorrect details'],
            ].map(([value, label]) => <button key={value} type="button" onClick={() => setReportType(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-extrabold ${reportType === value ? 'border-accent-500/40 bg-accent-500/10 text-accent-400' : 'border-[var(--border-subtle)] text-secondary'}`}>{label}</button>)}</div>
            <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} maxLength={1000} rows={3} placeholder="Add the correct address, time, or any helpful details…" className="surface-input mt-3 w-full resize-none rounded-2xl p-3.5 text-sm" />
            <button type="submit" disabled={reportBusy} className="primary-button mt-3 w-full py-3 text-sm disabled:opacity-50">{reportBusy ? 'Sending…' : 'Send report'}</button>
          </form>}
        </section>}

        {canManage && <button type="button" onClick={remove} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-rose-400 hover:bg-rose-400/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />{event.listingType === 'listed' ? 'Delete listing' : 'Cancel event'}</button>}
      </main>

      {!isHost && <div className="fixed bottom-[6.7rem] left-3 right-3 z-[1040] mx-auto max-w-lg rounded-[1.45rem] border border-white/10 bg-[var(--bg-nav)] p-2 shadow-2xl backdrop-blur-2xl">
        {currentUser ? <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => chooseRsvp('interested')} disabled={busy} className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'interested' ? 'bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/25' : 'bg-white/[0.055] text-secondary'}`}>{busy ? 'Saving…' : event.rsvpStatus === 'interested' ? 'Interested ✓' : 'Interested'}</button><button type="button" onClick={() => chooseRsvp('going')} disabled={busy || (full && event.rsvpStatus !== 'going')} className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-extrabold disabled:opacity-50 ${event.rsvpStatus === 'going' ? 'bg-emerald-400/15 text-emerald-400 ring-1 ring-emerald-400/20' : 'bg-accent-500 text-[#211603]'}`}><Users className="h-4 w-4" />{busy ? 'Saving…' : full && event.rsvpStatus !== 'going' ? 'Event full' : event.rsvpStatus === 'going' ? 'Going ✓' : 'Going'}</button></div> : <Link to="/signin" className="primary-button min-h-12 w-full text-sm">Sign in to RSVP</Link>}
      </div>}
    </div>
  );
}
