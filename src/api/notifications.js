import { supabase, hasSupabase } from './supabase';

export async function fetchNotifications(limit = 50) {
  if (!hasSupabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, spot_id, comment_id, post_id, post_comment_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url), spot:spots(id, name)')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 100));
  if (error) {
    console.warn('SnapMap: fetch notifications failed', error);
    return [];
  }
  return (data || []).map((item) => ({
    ...item,
    spotId: item.spot_id,
    commentId: item.comment_id,
    postId: item.post_id,
    postCommentId: item.post_comment_id,
    readAt: item.read_at,
    createdAt: item.created_at,
  }));
}

export async function getUnreadNotificationCount() {
  if (!hasSupabase) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  return error ? 0 : count || 0;
}

export async function markAllNotificationsRead() {
  if (!hasSupabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  return !error;
}

export function subscribeToNotifications(userId, onChange) {
  if (!hasSupabase || !userId) return () => {};
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
