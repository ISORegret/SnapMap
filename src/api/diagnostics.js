import { hasSupabase, supabase } from './supabase';

const OPT_IN_KEY = 'snapmap_diagnostics_opt_in_v1';
const SESSION_COUNTS_KEY = 'snapmap_diagnostics_counts_v1';
const MAX_EVENTS_PER_PAGE = 20;
const DEDUPE_MS = 2000;
export const DIAGNOSTICS_SETTING_EVENT = 'snapmap:diagnostics-setting';

const ALLOWED_EVENTS = new Set(['map_view', 'spot_view', 'save_spot', 'directions', 'app_error']);
const ALLOWED_PAGES = new Set(['map', 'explore', 'add', 'saved', 'spot', 'user', 'profile', 'event', 'settings', 'signin', 'messages', 'notifications', 'route', 'admin', 'about', 'privacy', 'change-password', 'other']);
const ALLOWED_ERROR_TYPES = new Set(['', 'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'ChunkLoadError']);
let lastRecord = { key: '', at: 0 };

function storageAvailable(name) {
  try {
    const storage = window?.[name];
    if (!storage) return null;
    return storage;
  } catch {
    return null;
  }
}

export function isDiagnosticsEnabled() {
  const storage = typeof window !== 'undefined' ? storageAvailable('localStorage') : null;
  return storage?.getItem(OPT_IN_KEY) === '1';
}

export function setDiagnosticsEnabled(enabled) {
  const storage = typeof window !== 'undefined' ? storageAvailable('localStorage') : null;
  if (storage) {
    if (enabled) storage.setItem(OPT_IN_KEY, '1');
    else storage.removeItem(OPT_IN_KEY);
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DIAGNOSTICS_SETTING_EVENT, { detail: { enabled: Boolean(enabled) } }));
}

export function classifyDiagnosticPage(pathname = '') {
  const path = String(pathname || '').split('?')[0];
  if (path === '/' || path === '/map') return 'map';
  if (path.startsWith('/explore')) return 'explore';
  if (path.startsWith('/add')) return 'add';
  if (path.startsWith('/saved')) return 'saved';
  if (path.startsWith('/spot/')) return 'spot';
  if (path.startsWith('/user/')) return 'user';
  if (path === '/profile') return 'profile';
  if (path.startsWith('/event/')) return 'event';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/signin')) return 'signin';
  if (path.startsWith('/messages')) return 'messages';
  if (path.startsWith('/notifications')) return 'notifications';
  if (path.startsWith('/route')) return 'route';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/about')) return 'about';
  if (path.startsWith('/privacy')) return 'privacy';
  if (path.startsWith('/change-password')) return 'change-password';
  return 'other';
}

export function classifyDiagnosticError(error) {
  const name = String(error?.name || 'Error');
  const message = String(error?.message || error || '');
  if (/chunkloaderror|failed to fetch dynamically imported module|importing a module script failed/i.test(`${name} ${message}`)) return 'ChunkLoadError';
  return ALLOWED_ERROR_TYPES.has(name) ? name : 'Error';
}

export function sanitizeDiagnosticSource(filename, line, column) {
  if (!filename) return '';
  try {
    const parsed = new URL(String(filename), typeof window !== 'undefined' ? window.location.href : 'https://snapmap.local/');
    const basename = parsed.pathname.split('/').pop() || '';
    if (!/^[A-Za-z0-9_-]{1,90}\.js$/.test(basename)) return '';
    const lineNumber = Number.isInteger(Number(line)) && Number(line) >= 0 ? Number(line) : 0;
    const columnNumber = Number.isInteger(Number(column)) && Number(column) >= 0 ? Number(column) : 0;
    return `${basename}:${lineNumber}:${columnNumber}`;
  } catch {
    return '';
  }
}

function appVersion() {
  const value = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : 'unknown';
  return /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value) ? value : 'unknown';
}

function consumePageBudget(page) {
  const storage = typeof window !== 'undefined' ? storageAvailable('sessionStorage') : null;
  if (!storage) return true;
  let counts = {};
  try { counts = JSON.parse(storage.getItem(SESSION_COUNTS_KEY) || '{}') || {}; } catch { counts = {}; }
  const count = Number(counts[page] || 0);
  if (count >= MAX_EVENTS_PER_PAGE) return false;
  counts[page] = count + 1;
  try { storage.setItem(SESSION_COUNTS_KEY, JSON.stringify(counts)); } catch { /* best effort */ }
  return true;
}

export async function recordDiagnostic(event, { page = 'other', errorType = '', source = '' } = {}) {
  if (!hasSupabase || !supabase || !isDiagnosticsEnabled() || !ALLOWED_EVENTS.has(event)) return false;
  const safePage = ALLOWED_PAGES.has(page) ? page : 'other';
  const safeErrorType = event === 'app_error' && ALLOWED_ERROR_TYPES.has(errorType) ? errorType : '';
  const safeSource = event === 'app_error' && /^[A-Za-z0-9_-]{1,90}\.js:\d{1,8}:\d{1,8}$/.test(source) ? source : '';
  const key = `${event}|${safePage}|${safeErrorType}|${safeSource}`;
  const now = Date.now();
  if (lastRecord.key === key && now - lastRecord.at < DEDUPE_MS) return false;
  if (!consumePageBudget(safePage)) return false;
  lastRecord = { key, at: now };

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user?.id || user.is_anonymous) return false;

  const { error } = await supabase.from('snapmap_diagnostics').insert({
    event,
    page: safePage,
    app_version: appVersion(),
    error_type: safeErrorType,
    source: safeSource,
  });
  if (error) {
    console.warn('SnapMap: diagnostics insert failed', error.code || error.message);
    return false;
  }
  return true;
}

export async function fetchDiagnostics(limit = 250) {
  if (!hasSupabase || !supabase) return { rows: [], error: 'Diagnostics unavailable' };
  const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 500);
  const { data, error } = await supabase
    .from('snapmap_diagnostics')
    .select('event,page,app_version,error_type,source,created_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) return { rows: [], error: error.message || 'Could not load diagnostics' };
  return { rows: data || [], error: '' };
}
