import { getDownloadCount as getDownloadCountFromSupabase } from '../api/stats';
import { hasSupabase } from '../api/supabase';

function getStatsBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    return String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = import.meta.env?.BASE_URL || '/';
    return window.location.origin + (base.startsWith('/') ? base : `/${base}`);
  }
  return '';
}

/**
 * Fetches download count: from Supabase when configured, else from stats.json.
 * @returns {Promise<number|null>} Download count or null if unavailable.
 */
export async function fetchDownloadCount() {
  if (hasSupabase) {
    const n = await getDownloadCountFromSupabase();
    if (n != null) return n;
  }
  const base = getStatsBase();
  if (!base) return null;
  try {
    const url = `${base}/stats.json`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const n = data?.downloads;
    return typeof n === 'number' && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
