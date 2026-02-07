/**
 * Version comparison and update check.
 * Version format: major.minor.patch (e.g. 1.0.18, 1.2.0).
 * After 1.0.20 the next is 1.2.0, then 1.2.1, 1.2.2, …
 */

export function compareVersions(a, b) {
  const parse = (v) => (v || '0').split('.').map((n) => parseInt(String(n), 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

function getVersionCheckBase() {
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
 * Fetches version.json from the website and returns true if a newer version is available.
 * @param {string} currentVersion - e.g. '1.0.18'
 * @returns {Promise<boolean>}
 */
export async function checkUpdateAvailable(currentVersion) {
  if (!currentVersion) return false;
  const base = getVersionCheckBase();
  if (!base) return false;
  try {
    const url = `${base}/version.json`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    const latest = data?.version;
    if (!latest) return false;
    return compareVersions(currentVersion, latest) < 0;
  } catch {
    return false;
  }
}
