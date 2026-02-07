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

export async function createProfile({ id, username, displayName = '' }) {
  if (!hasSupabase || !id || !username) return { ok: false, error: 'Missing id or username' };
  const u = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'user';
  const { error } = await supabase.from('profiles').insert({
    id,
    username: u,
    display_name: displayName || u,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: true };
    }
    console.warn('SnapMap: create profile failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateProfile(updates) {
  if (!hasSupabase || !supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const payload = {};
  if (updates.displayName != null) payload.display_name = updates.displayName;
  if (updates.bio != null) payload.bio = updates.bio.slice(0, 500);
  if (updates.avatarUrl != null) payload.avatar_url = updates.avatarUrl;
  if (Object.keys(payload).length === 0) return true;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
  if (error) {
    console.warn('SnapMap: update profile failed', error);
    return false;
  }
  return true;
}
