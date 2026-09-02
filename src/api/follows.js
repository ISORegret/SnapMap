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

export async function getFriendState(currentUserId, profileId) {
  if (!hasSupabase || !currentUserId || !profileId || currentUserId === profileId) return 'self';
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .or(`and(follower_id.eq.${currentUserId},following_id.eq.${profileId}),and(follower_id.eq.${profileId},following_id.eq.${currentUserId})`);
  if (error) {
    console.warn('SnapMap: get friend state failed', error);
    return 'none';
  }
  const outgoing = (data || []).some((row) => row.follower_id === currentUserId);
  const incoming = (data || []).some((row) => row.follower_id === profileId);
  if (outgoing && incoming) return 'friends';
  if (outgoing) return 'outgoing';
  if (incoming) return 'incoming';
  return 'none';
}

export const sendFriendRequest = follow;

export async function acceptFriendRequest(requesterId) {
  return follow(requesterId);
}

export async function declineFriendRequest(requesterId) {
  if (!hasSupabase || !requesterId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', requesterId)
    .eq('following_id', user.id);
  if (error) console.warn('SnapMap: decline friend request failed', error);
  return !error;
}

export async function removeFriend(profileId) {
  if (!hasSupabase || !profileId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('follows')
    .delete()
    .or(`and(follower_id.eq.${user.id},following_id.eq.${profileId}),and(follower_id.eq.${profileId},following_id.eq.${user.id})`);
  if (error) console.warn('SnapMap: remove friend failed', error);
  return !error;
}

export async function getFriendConnections(profileId) {
  if (!hasSupabase || !profileId) return { friends: [], incoming: [], outgoing: [] };
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, following_id, created_at')
    .or(`follower_id.eq.${profileId},following_id.eq.${profileId}`);
  if (error) {
    console.warn('SnapMap: get friend connections failed', error);
    return { friends: [], incoming: [], outgoing: [] };
  }
  const outgoingRows = (data || []).filter((row) => row.follower_id === profileId);
  const incomingRows = (data || []).filter((row) => row.following_id === profileId);
  const outgoingIds = new Set(outgoingRows.map((row) => row.following_id));
  const incomingIds = new Set(incomingRows.map((row) => row.follower_id));
  const friendIds = [...outgoingIds].filter((id) => incomingIds.has(id));
  const incomingPendingIds = [...incomingIds].filter((id) => !outgoingIds.has(id));
  const outgoingPendingIds = [...outgoingIds].filter((id) => !incomingIds.has(id));
  const allIds = [...new Set([...friendIds, ...incomingPendingIds, ...outgoingPendingIds])];
  if (!allIds.length) return { friends: [], incoming: [], outgoing: [] };
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', allIds);
  if (profilesError) return { friends: [], incoming: [], outgoing: [] };
  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return {
    friends: friendIds.map((id) => byId.get(id)).filter(Boolean),
    incoming: incomingPendingIds.map((id) => byId.get(id)).filter(Boolean),
    outgoing: outgoingPendingIds.map((id) => byId.get(id)).filter(Boolean),
  };
}
