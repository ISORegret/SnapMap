import { supabase, hasSupabase } from './supabase';

export async function getProfileByUsername(username) {
  if (!hasSupabase || !username || !String(username).trim()) return null;
  const u = String(username).trim().toLowerCase();
  const { data, error } = await supabase.from('profiles').select('*').eq('username', u).maybeSingle();
  if (error) {
    console.warn('SnapMap: get profile failed', error);
    return null;
  }
  return data;
}

export async function getProfileById(id) {
  if (!hasSupabase || !id) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('SnapMap: get profile by id failed', error);
    return null;
  }
  return data;
}

export async function searchProfiles(search = '', limit = 100) {
  if (!hasSupabase) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(safeLimit);
  const term = String(search || '').trim().replace(/[,%()]/g, '').slice(0, 50);
  if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%,bio.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) {
    console.warn('SnapMap: creator search failed', error);
    return [];
  }
  return data || [];
}

function sanitizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'user';
}

function usernameCandidates(username, id) {
  const base = sanitizeUsername(username);
  const idToken = String(id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const suffixes = [
    '',
    idToken.slice(-6),
    idToken.slice(-10),
    idToken.slice(0, 12),
  ].filter((value, index, list) => index === 0 || (value && list.indexOf(value) === index));

  return suffixes.map((suffix) => {
    if (!suffix) return base;
    const tail = `_${suffix}`;
    return `${base.slice(0, Math.max(1, 32 - tail.length))}${tail}`;
  });
}

/**
 * Ensure an auth user has exactly one profile without treating a username collision
 * as a successful insert. The auth-user id is authoritative; username is only an
 * internal route/login identifier and can safely receive a deterministic suffix.
 */
export async function createProfile({ id, username, displayName = '' }) {
  if (!hasSupabase || !id || !username) return { ok: false, profile: null, error: 'Missing id or username' };

  const existing = await getProfileById(id);
  if (existing) return { ok: true, profile: existing, error: null };

  const preferredDisplayName = String(displayName || '').trim().slice(0, 100);
  const candidates = usernameCandidates(username, id);

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id,
        username: candidate,
        display_name: preferredDisplayName || candidate,
      })
      .select('*')
      .single();

    if (!error && data) return { ok: true, profile: data, error: null };

    if (error?.code === '23505') {
      // A simultaneous provisioning request may have inserted this user's row.
      const racedProfile = await getProfileById(id);
      if (racedProfile) return { ok: true, profile: racedProfile, error: null };
      // Otherwise the candidate username belongs to somebody else; try a
      // deterministic id-suffixed candidate rather than claiming success.
      continue;
    }

    console.warn('SnapMap: create profile failed', error);
    return { ok: false, profile: null, error: error?.message || 'Could not create profile' };
  }

  return { ok: false, profile: null, error: 'Could not allocate a unique account identifier' };
}

export async function updateProfile(updates) {
  if (!hasSupabase || !supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const payload = {};
  if (updates.displayName != null) payload.display_name = String(updates.displayName).trim().slice(0, 100);
  if (updates.bio != null) payload.bio = String(updates.bio).slice(0, 500);
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl === '' ? null : updates.avatarUrl;
  if (Object.keys(payload).length === 0) return true;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
  if (error) {
    console.warn('SnapMap: update profile failed', error);
    return false;
  }
  return true;
}

/**
 * Upload avatar image to Supabase Storage, return public URL or null.
 * Path: avatars/{userId}/avatar (overwrites on each upload).
 */
export async function uploadAvatar(file) {
  if (!hasSupabase || !supabase || !file?.type?.startsWith('image/')) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const ext = file.name?.match(/\.(jpe?g|png|gif|webp)$/i)?.[1] || 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) {
    console.warn('SnapMap: avatar upload failed', error);
    return null;
  }
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}
