import { supabase, hasSupabase } from './supabase';
import { removeFriend } from './follows';

export async function getBlockedUserIds() {
  if (!hasSupabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id);
  if (error) return [];
  return (data || []).map((row) => row.blocked_id);
}

export async function isUserBlocked(userId) {
  if (!hasSupabase || !userId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle();
  return Boolean(data);
}

export async function blockUser(userId) {
  if (!hasSupabase || !userId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === userId) return false;
  await removeFriend(userId);
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: userId });
  if (error?.code === '23505') return true;
  if (error) console.warn('SnapMap: block user failed', error);
  return !error;
}

export async function unblockUser(userId) {
  if (!hasSupabase || !userId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
  return !error;
}

export async function reportComment(commentId, reason = 'inappropriate') {
  if (!hasSupabase || !commentId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('comment_reports').insert({ reporter_id: user.id, comment_id: commentId, reason });
  if (error?.code === '23505') return true;
  if (error) console.warn('SnapMap: report comment failed', error);
  return !error;
}
