import { supabase, hasSupabase } from './supabase';

export async function isFollowing(followerId, followingId) {
  if (!hasSupabase || !followerId || !followingId) return false;
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  if (error) {
    console.warn('SnapMap: isFollowing failed', error);
    return false;
  }
  return !!data;
}

export async function follow(followingId) {
  if (!hasSupabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !followingId || user.id === followingId) return false;
  const { error } = await supabase.from('follows').insert({
    follower_id: user.id,
    following_id: followingId,
  });
  if (error) {
    console.warn('SnapMap: follow failed', error);
    return false;
  }
  return true;
}

export async function unfollow(followingId) {
  if (!hasSupabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !followingId) return false;
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId);
  if (error) {
    console.warn('SnapMap: unfollow failed', error);
    return false;
  }
  return true;
}

export async function getFollowerCount(profileId) {
  if (!hasSupabase || !profileId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profileId);
  if (error) return 0;
  return count ?? 0;
}

export async function getFollowingCount(profileId) {
  if (!hasSupabase || !profileId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profileId);
  if (error) return 0;
  return count ?? 0;
}
