import { supabase, hasSupabase } from './supabase';

export async function getSpotRating(spotId) {
  if (!hasSupabase || !spotId) return { average: 0, count: 0 };
  const { data, error } = await supabase
    .from('spot_ratings')
    .select('rating')
    .eq('spot_id', spotId);
  if (error) {
    console.warn('SnapMap: get spot rating failed', error);
    return { average: 0, count: 0 };
  }
  const ratings = (data || []).map((r) => r.rating);
  const count = ratings.length;
  if (count === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / count) * 10) / 10; // one decimal
  return { average, count };
}

/** Batch fetch rating average + count for many spots. Returns { [spotId]: { average, count } }. */
export async function getSpotRatingsForSpotIds(spotIds) {
  if (!hasSupabase || !spotIds?.length) return {};
  const ids = [...new Set(spotIds)].filter((id) => id && typeof id === 'string' && !id.startsWith('user-'));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('spot_ratings')
    .select('spot_id, rating')
    .in('spot_id', ids);
  if (error) {
    console.warn('SnapMap: get spot ratings batch failed', error);
    return {};
  }
  const bySpot = {};
  for (const row of data || []) {
    const sid = row.spot_id;
    if (!bySpot[sid]) bySpot[sid] = [];
    bySpot[sid].push(row.rating);
  }
  const result = {};
  for (const [sid, ratings] of Object.entries(bySpot)) {
    const count = ratings.length;
    const sum = ratings.reduce((a, b) => a + b, 0);
    const average = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
    result[sid] = { average, count };
  }
  return result;
}

export async function getUserRating(spotId, deviceId) {
  if (!hasSupabase || !spotId || !deviceId) return null;
  const { data, error } = await supabase
    .from('spot_ratings')
    .select('rating')
    .eq('spot_id', spotId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) {
    console.warn('SnapMap: get user rating failed', error);
    return null;
  }
  return data?.rating ?? null;
}

export async function setSpotRating(spotId, deviceId, rating) {
  if (!hasSupabase || !spotId || !deviceId || rating < 1 || rating > 5) return false;
  const { error } = await supabase
    .from('spot_ratings')
    .upsert({ spot_id: spotId, device_id: deviceId, rating }, { onConflict: 'spot_id,device_id' });
  if (error) {
    console.warn('SnapMap: set rating failed', error);
    return false;
  }
  return true;
}
