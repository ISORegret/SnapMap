import { hasSupabase, supabase } from './supabase';

function normalizeCheckIn(row) {
  return {
    ...row,
    eventId: row.event_id,
    userId: row.user_id,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
  };
}

export async function fetchEventCheckIns(eventId) {
  if (!hasSupabase || !eventId) return [];
  const { data, error } = await supabase.from('event_check_ins')
    .select('event_id, user_id, checked_in_at, expires_at, profile:profiles!event_check_ins_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('event_id', eventId)
    .gt('expires_at', new Date().toISOString())
    .order('checked_in_at', { ascending: false });
  if (error) {
    if (!['42P01', 'PGRST205'].includes(error.code)) console.warn('SnapMap: event check-ins failed', error);
    return [];
  }
  return (data || []).map(normalizeCheckIn);
}

export async function fetchActiveEventCheckInCounts(eventIds = []) {
  if (!hasSupabase || eventIds.length === 0) return {};
  const { data, error } = await supabase.from('event_check_ins')
    .select('event_id')
    .in('event_id', eventIds)
    .gt('expires_at', new Date().toISOString());
  if (error) {
    if (!['42P01', 'PGRST205'].includes(error.code)) console.warn('SnapMap: live event counts failed', error);
    return {};
  }
  return (data || []).reduce((counts, row) => {
    counts[row.event_id] = (counts[row.event_id] || 0) + 1;
    return counts;
  }, {});
}

export async function checkInToEvent(eventId, position) {
  if (!hasSupabase || !eventId) return { ok: false, error: 'Event unavailable.' };
  if (!position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lng))) {
    return { ok: false, error: 'Allow location access to check in.' };
  }
  const { data, error } = await supabase.rpc('check_in_to_event', {
    target_event_id: eventId,
    current_latitude: Number(position.lat),
    current_longitude: Number(position.lng),
  });
  if (error) {
    const needsMigration = ['42883', 'PGRST202'].includes(error.code);
    return { ok: false, error: needsMigration ? 'Run migration 039 to enable event check-ins.' : (error.message || 'Could not check in.') };
  }
  return data?.ok ? { ok: true, expiresAt: data.expires_at, error: null } : { ok: false, error: data?.error || 'Could not check in.' };
}

export async function leaveEventCheckIn(eventId) {
  if (!hasSupabase || !eventId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('event_check_ins').delete().eq('event_id', eventId).eq('user_id', user.id);
  return !error;
}

export function subscribeToEventCheckIns(onChange, eventId = null) {
  if (!hasSupabase) return () => {};
  const filter = eventId ? { event: '*', schema: 'public', table: 'event_check_ins', filter: `event_id=eq.${eventId}` } : { event: '*', schema: 'public', table: 'event_check_ins' };
  const channel = supabase.channel(`event-check-ins-${eventId || 'all'}`)
    .on('postgres_changes', filter, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
