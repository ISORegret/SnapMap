import { supabase, hasSupabase } from './supabase';

export async function getActivityFeed(userIds, limit = 50) {
  if (!hasSupabase || !userIds?.length) return [];
  const { data, error } = await supabase
    .from('activity')
    .select('id, user_id, type, spot_id, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('SnapMap: get activity failed', error);
    return [];
  }
  return data || [];
}

export async function getActivityForUser(userId, limit = 30) {
  if (!hasSupabase || !userId) return [];
  const { data, error } = await supabase
    .from('activity')
    .select('id, user_id, type, spot_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('SnapMap: get activity for user failed', error);
    return [];
  }
  return data || [];
}

export async function insertActivity({ type, spotId }) {
  if (!hasSupabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  if (!['added_spot', 'saved_spot', 'added_photo'].includes(type)) return false;
  const { error } = await supabase.from('activity').insert({
    user_id: user.id,
    type,
    spot_id: spotId || null,
  });
  if (error) {
    console.warn('SnapMap: insert activity failed', error);
    return false;
  }
  return true;
}
