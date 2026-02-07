import { supabase, hasSupabase } from './supabase';

export async function getCheckInCount(spotId) {
  if (!hasSupabase || !spotId) return 0;
  const { count, error } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spotId);
  if (error) {
    console.warn('SnapMap: get check-in count failed', error);
    return 0;
  }
  return count ?? 0;
}

export async function hasCheckedIn(spotId, deviceId) {
  if (!hasSupabase || !spotId || !deviceId) return false;
  const { data, error } = await supabase
    .from('check_ins')
    .select('id')
    .eq('spot_id', spotId)
    .eq('device_id', deviceId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('SnapMap: has checked in failed', error);
    return false;
  }
  return !!data;
}

export async function addCheckIn(spotId, deviceId) {
  if (!hasSupabase || !spotId || !deviceId) return { ok: false };
  const { error } = await supabase.from('check_ins').insert({ spot_id: spotId, device_id: deviceId });
  if (error) {
    if (error.code === '23505') return { ok: false, already: true }; // unique violation
    console.warn('SnapMap: add check-in failed', error);
    return { ok: false };
  }
  return { ok: true };
}
