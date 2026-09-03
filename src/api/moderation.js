import { supabase, hasSupabase } from './supabase';

export async function isCurrentUserAdmin() {
  if (!hasSupabase) return false;
  const { data, error } = await supabase.rpc('is_app_admin');
  return !error && data === true;
}

export async function fetchModerationQueue() {
  if (!hasSupabase || !(await isCurrentUserAdmin())) return [];
  const [postsResult, commentsResult, spotsResult, messagesResult] = await Promise.all([
    supabase.from('post_reports').select(`
      id, reason, status, created_at,
      reporter:profiles!post_reports_reporter_id_fkey(id, username, display_name, avatar_url),
      post:posts!post_reports_post_id_fkey(id, caption, location_name, user_id, created_at,
        author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url),
        images:post_images(public_url, storage_path, position))
    `).eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('comment_reports').select(`
      id, reason, status, created_at,
      reporter:profiles!comment_reports_reporter_id_fkey(id, username, display_name, avatar_url),
      comment:spot_notes!comment_reports_comment_id_fkey(id, body, spot_id, user_id, created_at,
        author:profiles!spot_notes_user_id_fkey(id, username, display_name, avatar_url),
        spot:spots(id, name))
    `).eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('spot_reports').select(`
      id, report_type, note, status, created_at,
      reporter:profiles!spot_reports_reporter_id_fkey(id, username, display_name, avatar_url),
      spot:spots(id, name, description, address, image_uri, owner_id, created_by, created_by_display_name)
    `).eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('private_message_reports').select(`
      id, reason, status, created_at,
      reporter:profiles!private_message_reports_reporter_id_fkey(id, username, display_name, avatar_url),
      message:private_messages!private_message_reports_message_id_fkey(id, body, sender_id, recipient_id, share_type, share_title, created_at,
        author:profiles!private_messages_sender_id_fkey(id, username, display_name, avatar_url))
    `).eq('status', 'open').order('created_at', { ascending: false }),
  ]);
  const failed = [postsResult, commentsResult, spotsResult, messagesResult].find((result) => result.error);
  if (failed) {
    console.warn('SnapMap: moderation queue failed', failed.error);
    return [];
  }
  return [
    ...(postsResult.data || []).map((item) => ({ ...item, kind: 'post', target: item.post, targetUserId: item.post?.user_id })),
    ...(commentsResult.data || []).map((item) => ({ ...item, kind: 'comment', target: item.comment, targetUserId: item.comment?.user_id })),
    ...(spotsResult.data || []).map((item) => ({ ...item, kind: 'spot', reason: item.report_type, target: item.spot, targetUserId: item.spot?.owner_id })),
    ...(messagesResult.data || []).map((item) => ({ ...item, kind: 'message', target: item.message, targetUserId: item.message?.sender_id })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

const REPORT_TABLES = { post: 'post_reports', comment: 'comment_reports', spot: 'spot_reports', message: 'private_message_reports' };

export async function dismissReport(item) {
  const table = REPORT_TABLES[item?.kind];
  if (!hasSupabase || !table || !item?.id) return false;
  const { error } = await supabase.from(table).update({ status: 'dismissed' }).eq('id', item.id);
  return !error;
}

export async function removeReportedContent(item) {
  if (!hasSupabase || !item?.target?.id) return false;
  let error = null;
  if (item.kind === 'post') {
    const paths = (item.target.images || []).map((image) => image.storage_path).filter(Boolean);
    ({ error } = await supabase.from('posts').delete().eq('id', item.target.id));
    if (!error && paths.length) await supabase.storage.from('post-images').remove(paths);
  } else if (item.kind === 'comment') {
    ({ error } = await supabase.from('spot_notes').delete().eq('id', item.target.id));
  } else if (item.kind === 'spot') {
    ({ error } = await supabase.from('spots').delete().eq('id', item.target.id));
  } else if (item.kind === 'message') {
    ({ error } = await supabase.from('private_messages').delete().eq('id', item.target.id));
  }
  if (error) console.warn('SnapMap: moderation removal failed', error);
  return !error;
}

export async function suspendUser(userId, days = 7, reason = 'Community guidelines violation') {
  if (!hasSupabase || !userId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const until = days == null ? null : new Date(Date.now() + Math.max(1, days) * 86400000).toISOString();
  const { error } = await supabase.from('account_suspensions').upsert({
    user_id: userId,
    reason: String(reason).trim().slice(0, 500) || 'Community guidelines violation',
    suspended_until: until,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('SnapMap: suspension failed', error);
  return !error;
}
