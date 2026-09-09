import { supabase, hasSupabase } from './supabase';
import { isCurrentUserAdmin } from './moderation';

const ENTRY_SELECT = `
  id, challenge_id, user_id, post_id, created_at,
  author:profiles!photo_challenge_entries_user_id_fkey(id, username, display_name, avatar_url),
  post:posts!photo_challenge_entries_post_id_fkey(
    id, caption, location_name, created_at,
    images:post_images(public_url, position)
  )
`;

function normalizeChallenge(row) {
  if (!row) return null;
  const now = Date.now();
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  return {
    ...row,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    isUpcoming: now < starts,
    isOpen: now >= starts && now < ends,
    isClosed: now >= ends,
  };
}

function normalizeEntry(row) {
  if (!row) return null;
  const images = [...(row.post?.images || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  return {
    ...row,
    challengeId: row.challenge_id,
    userId: row.user_id,
    postId: row.post_id,
    createdAt: row.created_at,
    post: row.post ? { ...row.post, images, locationName: row.post.location_name, createdAt: row.post.created_at } : null,
  };
}

export async function fetchActivePhotoChallenge() {
  if (!hasSupabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('photo_challenges')
    .select('*')
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('SnapMap: active photo challenge fetch failed', error);
    return null;
  }
  return normalizeChallenge(data);
}

export async function fetchLatestPhotoChallenge() {
  if (!hasSupabase) return null;
  const { data, error } = await supabase
    .from('photo_challenges')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return normalizeChallenge(data);
}

export async function fetchPhotoChallenge(id) {
  if (!hasSupabase || !id) return null;
  const { data, error } = await supabase.from('photo_challenges').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return normalizeChallenge(data);
}

export async function fetchPhotoChallengeEntries(challengeId) {
  if (!hasSupabase || !challengeId) return [];
  const { data, error } = await supabase
    .from('photo_challenge_entries')
    .select(ENTRY_SELECT)
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('SnapMap: photo challenge entries fetch failed', error);
    return [];
  }
  return (data || []).filter((entry) => entry.post?.id).map(normalizeEntry);
}

export async function fetchPhotoChallengeWinnerId(challengeId) {
  if (!hasSupabase || !challengeId) return null;
  const { data, error } = await supabase
    .from('photo_challenge_winners')
    .select('entry_id')
    .eq('challenge_id', challengeId)
    .maybeSingle();
  return error ? null : data?.entry_id || null;
}

export async function submitPhotoChallengeEntry(challengeId, postId) {
  if (!hasSupabase || !challengeId || !postId) return { ok: false, error: 'Choose a photo post first.' };
  const { data, error } = await supabase.rpc('submit_photo_challenge_entry', {
    target_challenge_id: challengeId,
    target_post_id: postId,
  });
  return error ? { ok: false, error: error.message } : { ok: true, entryId: data };
}

export async function fetchPhotoChallengesForAdmin(limit = 8) {
  if (!hasSupabase || !(await isCurrentUserAdmin())) return [];
  const { data, error } = await supabase
    .from('photo_challenges')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 8, 1), 20));
  if (error) return [];
  return (data || []).map(normalizeChallenge);
}

export async function createPhotoChallenge({ title, prompt, startsAt, endsAt }) {
  if (!hasSupabase || !(await isCurrentUserAdmin())) return { challenge: null, error: 'Admin access required.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { challenge: null, error: 'Sign in first.' };
  const { data, error } = await supabase
    .from('photo_challenges')
    .insert({
      title: String(title || '').trim(),
      prompt: String(prompt || '').trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      created_by: user.id,
    })
    .select('*')
    .single();
  return error ? { challenge: null, error: error.message } : { challenge: normalizeChallenge(data), error: null };
}

export async function choosePhotoChallengeWinner(challengeId, entryId) {
  if (!hasSupabase || !challengeId || !entryId) return { ok: false, error: 'Choose an entry.' };
  const { data, error } = await supabase.rpc('choose_photo_challenge_winner', {
    target_challenge_id: challengeId,
    target_entry_id: entryId,
  });
  return error ? { ok: false, error: error.message } : { ok: data === true, error: null };
}
