import { hasSupabase, supabase } from './supabase';

const MESSAGE_SELECT = `
  id, sender_id, recipient_id, body, share_type, share_id, share_title, share_subtitle, share_image_url, created_at, read_at,
  sender:profiles!private_messages_sender_id_fkey(id, username, display_name, avatar_url),
  recipient:profiles!private_messages_recipient_id_fkey(id, username, display_name, avatar_url)
`;

function normalizeMessage(row) {
  return {
    ...row,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    shareType: row.share_type,
    shareId: row.share_id,
    shareTitle: row.share_title,
    shareSubtitle: row.share_subtitle,
    shareImageUrl: row.share_image_url,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

async function signedInUser() {
  if (!hasSupabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

export async function getUnreadMessageCount() {
  const user = await signedInUser();
  if (!user) return 0;
  const { count, error } = await supabase.from('private_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null);
  if (error) return 0;
  return count || 0;
}

export async function fetchInbox(limit = 300) {
  const user = await signedInUser();
  if (!user) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 500);
  const { data, error } = await supabase.from('private_messages')
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) {
    console.warn('SnapMap: inbox fetch failed', error);
    return [];
  }

  // Rows arrive newest-first. Build conversation summaries in one pass rather than
  // filtering the entire inbox again for every row (which became quadratic as the
  // inbox grew).
  const conversations = new Map();
  for (const row of data || []) {
    const message = normalizeMessage(row);
    const mine = message.senderId === user.id;
    const other = mine ? row.recipient : row.sender;
    if (!other?.id) continue;

    let conversation = conversations.get(other.id);
    if (!conversation) {
      conversation = { profile: other, latest: message, unreadCount: 0 };
      conversations.set(other.id, conversation);
    }
    if (!mine && !message.readAt) conversation.unreadCount += 1;
  }

  return [...conversations.values()].sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt));
}

export async function fetchConversation(otherUserId, limit = 150) {
  const user = await signedInUser();
  if (!user || !otherUserId) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 150, 1), 300);
  const { data, error } = await supabase.from('private_messages')
    .select(MESSAGE_SELECT)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    // Limit the newest messages, then reverse them for chronological rendering.
    // The previous ascending+limit query permanently hid the newest messages once
    // a conversation exceeded the limit.
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) {
    console.warn('SnapMap: conversation fetch failed', error);
    return [];
  }
  return (data || []).map(normalizeMessage).reverse();
}

export async function sendMessage({ recipientId, body = '', share = null }) {
  const user = await signedInUser();
  if (!user || !recipientId) return { message: null, error: 'Sign in to send messages.' };
  const text = String(body || '').trim().slice(0, 1500);
  const validShare = share && ['spot', 'event', 'post'].includes(share.type) && share.id;
  if (!text && !validShare) return { message: null, error: 'Write a message or attach something to share.' };
  const payload = {
    sender_id: user.id,
    recipient_id: recipientId,
    body: text,
    share_type: validShare ? share.type : null,
    share_id: validShare ? share.id : null,
    share_title: validShare ? String(share.title || '').slice(0, 160) : '',
    share_subtitle: validShare ? String(share.subtitle || '').slice(0, 240) : '',
    share_image_url: validShare ? String(share.imageUrl || '').slice(0, 1000) : '',
  };
  const { data, error } = await supabase.from('private_messages').insert(payload).select(MESSAGE_SELECT).single();
  if (error) return { message: null, error: error.code === '42501' ? 'You can only message accepted friends.' : (error.message || 'Could not send message.') };
  return { message: normalizeMessage(data), error: null };
}

export async function markConversationRead(otherUserId) {
  if (!hasSupabase || !otherUserId) return 0;
  const { data } = await supabase.rpc('mark_conversation_read', { other_user_id: otherUserId });
  return Number(data) || 0;
}

export async function reportPrivateMessage(messageId, reason = 'inappropriate') {
  const user = await signedInUser();
  if (!user || !messageId) return false;
  const { error } = await supabase.from('private_message_reports').insert({ message_id: messageId, reporter_id: user.id, reason });
  return !error || error.code === '23505';
}

export function subscribeToMessages(onChange) {
  if (!hasSupabase) return () => {};
  const channel = supabase.channel(`private-messages-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'private_messages' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
