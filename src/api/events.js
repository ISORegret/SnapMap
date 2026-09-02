import { hasSupabase, supabase } from './supabase';

const EVENT_SELECT_BASE = `
  id, host_id, spot_id, title, description, starts_at, ends_at, max_attendees, created_at, updated_at,
  event_type, venue_name, address, listing_type, source_label,
  host:profiles!events_host_id_fkey(id, username, display_name, avatar_url),
  spot:spots!events_spot_id_fkey(id, name, address, latitude, longitude, images),
  rsvps:event_rsvps(user_id, created_at, profile:profiles!event_rsvps_user_id_fkey(id, username, display_name, avatar_url))
`;

const EVENT_SELECT = EVENT_SELECT_BASE.replace(
  'event_type, venue_name, address, listing_type, source_label,',
  'event_type, venue_name, address, latitude, longitude, listing_type, source_label,'
);

function normalizeEvent(event, currentUserId = null) {
  return {
    ...event,
    hostId: event.host_id,
    spotId: event.spot_id,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    maxAttendees: event.max_attendees,
    eventType: event.event_type || 'meetup',
    venueName: event.venue_name || event.spot?.name || '',
    address: event.address || event.spot?.address || '',
    latitude: event.latitude == null ? null : Number(event.latitude),
    longitude: event.longitude == null ? null : Number(event.longitude),
    listingType: event.listing_type || 'hosted',
    sourceLabel: event.source_label || 'SnapMap community',
    createdAt: event.created_at,
    attendeeCount: event.rsvps?.length || 0,
    attending: Boolean(currentUserId && event.rsvps?.some((rsvp) => rsvp.user_id === currentUserId)),
  };
}

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function fetchUpcomingEvents(limit = 50) {
  if (!hasSupabase) return { events: [], error: 'Events need cloud sync.' };
  const userId = await currentUserId();
  let { data, error } = await supabase.from('events').select(EVENT_SELECT)
    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 100));
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    ({ data, error } = await supabase.from('events').select(EVENT_SELECT_BASE)
      .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 100)));
  }
  if (error) {
    console.warn('SnapMap: events fetch failed', error);
    return { events: [], error: error.code === '42P01' || error.code === 'PGRST205' ? 'Events are waiting for migration 032.' : 'Could not load events.' };
  }
  return { events: (data || []).map((event) => normalizeEvent(event, userId)), error: null };
}

export async function fetchEvent(eventId) {
  if (!hasSupabase || !eventId) return { event: null, error: 'Event not found.' };
  const userId = await currentUserId();
  let { data, error } = await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).maybeSingle();
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    ({ data, error } = await supabase.from('events').select(EVENT_SELECT_BASE).eq('id', eventId).maybeSingle());
  }
  if (error || !data) return { event: null, error: error?.code === '42P01' || error?.code === 'PGRST205' ? 'Events are waiting for migration 032.' : 'Event not found.' };
  return { event: normalizeEvent(data, userId), error: null };
}

export async function createEvent({ title, description = '', spotId, startsAt, endsAt = null, maxAttendees = null }) {
  if (!hasSupabase) return { event: null, error: 'Events need cloud sync.' };
  const userId = await currentUserId();
  if (!userId) return { event: null, error: 'Sign in to host an event.' };
  const payload = {
    host_id: userId,
    spot_id: spotId,
    title: String(title || '').trim().slice(0, 100),
    description: String(description || '').trim().slice(0, 1200),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    max_attendees: maxAttendees ? Number(maxAttendees) : null,
  };
  const { data, error } = await supabase.from('events').insert(payload).select(EVENT_SELECT).single();
  if (error || !data) return { event: null, error: error?.code === '42P01' || error?.code === 'PGRST205' ? 'Apply migration 032 before creating events.' : (error?.message || 'Could not create event.') };
  return { event: normalizeEvent(data, userId), error: null };
}

export async function updateEvent(eventId, updates) {
  if (!hasSupabase || !eventId) return { event: null, error: 'Event unavailable.' };
  const latitude = updates.latitude === '' || updates.latitude == null ? null : Number(updates.latitude);
  const longitude = updates.longitude === '' || updates.longitude == null ? null : Number(updates.longitude);
  if ((latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return { event: null, error: 'Choose a valid map location.' };
  }
  if ((latitude == null) !== (longitude == null)) return { event: null, error: 'Set both latitude and longitude.' };
  const payload = {
    title: String(updates.title || '').trim().slice(0, 100),
    description: String(updates.description || '').trim().slice(0, 1200),
    venue_name: String(updates.venueName || '').trim().slice(0, 160),
    address: String(updates.address || '').trim().slice(0, 300),
    event_type: ['car_show', 'cruise_in', 'cars_and_coffee', 'meetup'].includes(updates.eventType) ? updates.eventType : 'meetup',
    starts_at: new Date(updates.startsAt).toISOString(),
    ends_at: updates.endsAt ? new Date(updates.endsAt).toISOString() : null,
    max_attendees: updates.maxAttendees ? Number(updates.maxAttendees) : null,
    latitude,
    longitude,
    updated_at: new Date().toISOString(),
  };
  if (!payload.title || Number.isNaN(new Date(payload.starts_at).getTime())) return { event: null, error: 'Add an event name and valid start time.' };
  const userId = await currentUserId();
  const { data, error } = await supabase.from('events').update(payload).eq('id', eventId).select(EVENT_SELECT).single();
  if (error || !data) {
    const needsMigration = ['42703', 'PGRST204'].includes(error?.code);
    return { event: null, error: needsMigration ? 'Apply migration 034 before editing event pins.' : (error?.message || 'Could not update event.') };
  }
  return { event: normalizeEvent(data, userId), error: null };
}

export async function setEventRsvp(eventId, attending) {
  if (!hasSupabase || !eventId) return { ok: false, error: 'Event unavailable.' };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Sign in to RSVP.' };
  const request = attending
    ? supabase.from('event_rsvps').insert({ event_id: eventId, user_id: userId })
    : supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId);
  const { error } = await request;
  return error ? { ok: false, error: error.message || 'Could not update RSVP.' } : { ok: true, error: null };
}

export async function deleteEvent(eventId) {
  if (!hasSupabase || !eventId) return false;
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return !error;
}

export function subscribeToEvents(onChange) {
  if (!hasSupabase) return () => {};
  const channel = supabase.channel('snapmap-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
