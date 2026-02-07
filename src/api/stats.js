import { supabase, hasSupabase } from './supabase';

/**
 * @returns {Promise<number|null>} Download count or null if unavailable.
 */
export async function getDownloadCount() {
  if (!hasSupabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_stats')
      .select('value')
      .eq('key', 'downloads')
      .single();
    if (error || data == null) return null;
    const n = data.value;
    return typeof n === 'number' && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
