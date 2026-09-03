import { hasSupabase, supabase } from './supabase';

const COMMENT_SELECT = `
  id, event_id, user_id, body, is_organizer_update, created_at, updated_at,
  author:profiles!event_comments_user_id_fkey(id, username, display_name, avatar_url)
`;

function normalizeComment(comment) {
  return {
    ...comment,
    eventId: comment.event_id,
    userId: comment.user_id,
    isOrganizerUpdate: Boolean(comment.is_organizer_update),
    createdAt: comment.created_at,
  };
}

function migrationMessage(error) {
  return ['42P01', 'PGRST205'].includes(error?.code)
    ? 'Event discussions will be ready after migration 035.'
    : (error?.message || 'Could not load the discussion.');
}

export async function fetchEventComments(eventId) {
  if (!hasSupabase || !eventId) return { comments: [], error: '' };
  const { data, error } = await supabase.from('event_comments').select(COMMENT_SELECT)
    .eq('event_id', eventId).order('created_at', { ascending: true });
  return error
    ? { comments: [], error: migrationMessage(error) }
    : { comments: (data || []).map(normalizeComment), error: '' };
}

export async function addEventComment(eventId, body, isOrganizerUpdate = false) {
  if (!hasSupabase || !eventId || !String(body || '').trim()) return { comment: null, error: 'Write a message first.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { comment: null, error: 'Sign in to join the discussion.' };
  const { data, error } = await supabase.from('event_comments').insert({
    event_id: eventId,
    user_id: user.id,
    body: String(body).trim().slice(0, 1000),
    is_organizer_update: Boolean(isOrganizerUpdate),
  }).select(COMMENT_SELECT).single();
  return error
    ? { comment: null, error: migrationMessage(error) }
    : { comment: normalizeComment(data), error: '' };
}

export async function deleteEventComment(commentId) {
  if (!hasSupabase || !commentId) return false;
  const { error } = await supabase.from('event_comments').delete().eq('id', commentId);
  return !error;
}

export function subscribeToEventComments(eventId, onChange) {
  if (!hasSupabase || !eventId) return () => {};
  const channel = supabase.channel(`event-comments-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_comments', filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
