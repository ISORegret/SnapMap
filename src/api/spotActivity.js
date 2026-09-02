import { hasSupabase, supabase } from './supabase';

export const SPOT_CONDITIONS = [
  { id: 'clear', label: 'Clear', tone: 'emerald' },
  { id: 'busy', label: 'Busy', tone: 'amber' },
  { id: 'restricted', label: 'Restricted', tone: 'orange' },
  { id: 'closed', label: 'Closed', tone: 'rose' },
  { id: 'unsafe', label: 'Unsafe', tone: 'rose' },
];

const ACTIVITY_SELECT = `
  id, spot_id, user_id, activity_type, condition, note, created_at, expires_at,
  author:profiles!spot_activity_updates_user_id_fkey(id, username, display_name, avatar_url)
`;

function normalize(row) {
  return {
    ...row,
    spotId: row.spot_id,
    userId: row.user_id,
    activityType: row.activity_type,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function fetchSpotActivity(spotId) {
  if (!hasSupabase || !spotId) return [];
  const { data, error } = await supabase
    .from('spot_activity_updates')
    .select(ACTIVITY_SELECT)
    .eq('spot_id', spotId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('SnapMap: spot activity fetch failed', error);
    return [];
  }
  return (data || []).map(normalize);
}

export async function fetchActiveSpotActivity() {
  if (!hasSupabase) return {};
  const { data, error } = await supabase
    .from('spot_activity_updates')
    .select('spot_id, activity_type, condition, created_at, expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.warn('SnapMap: active map activity fetch failed', error);
    return {};
  }
  return (data || []).reduce((grouped, row) => {
    const current = grouped[row.spot_id] || { count: 0, checkIns: 0, condition: null, latestAt: null };
    current.count += 1;
    if (row.activity_type === 'check_in') current.checkIns += 1;
    if (!current.condition && row.activity_type === 'condition') current.condition = row.condition;
    if (!current.latestAt) current.latestAt = row.created_at;
    grouped[row.spot_id] = current;
    return grouped;
  }, {});
}

async function upsertActivity(spotId, activityType, condition = null, note = '') {
  if (!hasSupabase || !spotId) return { activity: null, error: 'Activity is unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { activity: null, error: 'Sign in to share live activity.' };
  const { data, error } = await supabase
    .from('spot_activity_updates')
    .upsert({
      spot_id: spotId,
      user_id: user.id,
      activity_type: activityType,
      condition,
      note: String(note || '').trim().slice(0, 240),
    }, { onConflict: 'spot_id,user_id,activity_type' })
    .select(ACTIVITY_SELECT)
    .single();
  return error
    ? { activity: null, error: error.message || 'Could not share activity.' }
    : { activity: normalize(data), error: null };
}

export function checkInNow(spotId) {
  return upsertActivity(spotId, 'check_in');
}

export function shareSpotCondition(spotId, condition, note = '') {
  if (!SPOT_CONDITIONS.some((item) => item.id === condition)) {
    return Promise.resolve({ activity: null, error: 'Choose a valid condition.' });
  }
  return upsertActivity(spotId, 'condition', condition, note);
}

export function subscribeToSpotActivity(spotId, onChange) {
  if (!hasSupabase || !spotId) return () => {};
  const channel = supabase
    .channel(`live-spot-${spotId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'spot_activity_updates',
      filter: `spot_id=eq.${spotId}`,
    }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToMapActivity(onChange) {
  if (!hasSupabase) return () => {};
  const channel = supabase
    .channel('live-map-activity')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_activity_updates' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
