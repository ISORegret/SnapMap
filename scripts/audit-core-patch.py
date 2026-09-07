from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))
    print(f"patched {path}")


def regex_once(path, pattern, replacement, flags=0):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected exactly one regex match in {path}, found {count}: {pattern[:120]!r}")
    p.write_text(next_text)
    print(f"patched {path}")


# ---------------------------------------------------------------------------
# Events: make venue/address part of the initial recurring-event insert, validate
# repeat/count/coordinates before writing, and avoid Date#toISOString throwing on
# malformed edit input.
# ---------------------------------------------------------------------------
regex_once(
    'src/api/events.js',
    r"export async function createEventSeries\(\{ title, description = '', spotId, startsAt, endsAt = null, maxAttendees = null, eventType = 'meetup', repeat = 'none', occurrences = 1 \}\) \{.*?\n\}\n\nexport async function createEvent\(payload\) \{",
    """export async function createEventSeries({
  title,
  description = '',
  spotId = null,
  venueName = '',
  address = '',
  latitude = null,
  longitude = null,
  startsAt,
  endsAt = null,
  maxAttendees = null,
  eventType = 'meetup',
  repeat = 'none',
  occurrences = 1,
}) {
  if (!hasSupabase) return { events: [], event: null, error: 'Events need cloud sync.' };
  const userId = await currentUserId();
  if (!userId) return { events: [], event: null, error: 'Sign in to host an event.' };

  const cleanTitle = String(title || '').trim().slice(0, 100);
  if (!cleanTitle) return { events: [], event: null, error: 'Add an event name.' };

  const validRepeat = ['none', 'weekly', 'monthly'].includes(repeat) ? repeat : 'none';
  const count = validRepeat === 'none' ? 1 : Math.min(12, Math.max(2, Number(occurrences) || 2));
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) {
    return { events: [], event: null, error: 'Choose a valid event time.' };
  }

  const attendeeLimit = maxAttendees === '' || maxAttendees == null ? null : Number(maxAttendees);
  if (attendeeLimit != null && (!Number.isInteger(attendeeLimit) || attendeeLimit < 1 || attendeeLimit > 100000)) {
    return { events: [], event: null, error: 'Attendee limit must be a positive whole number.' };
  }

  const lat = latitude === '' || latitude == null ? null : Number(latitude);
  const lng = longitude === '' || longitude == null ? null : Number(longitude);
  if ((lat == null) !== (lng == null)
    || (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
    || (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
    return { events: [], event: null, error: 'Choose a valid map location.' };
  }

  const duration = end ? end.getTime() - start.getTime() : null;
  const payloads = Array.from({ length: count }, (_, index) => {
    const occurrenceStart = repeatDate(start, index, validRepeat);
    const payload = {
      host_id: userId,
      spot_id: spotId || null,
      title: cleanTitle,
      description: String(description || '').trim().slice(0, 1200),
      venue_name: String(venueName || '').trim().slice(0, 160),
      address: String(address || '').trim().slice(0, 300),
      starts_at: occurrenceStart.toISOString(),
      ends_at: duration == null ? null : new Date(occurrenceStart.getTime() + duration).toISOString(),
      max_attendees: attendeeLimit,
      event_type: ['car_show', 'cruise_in', 'cars_and_coffee', 'meetup'].includes(eventType) ? eventType : 'meetup',
    };
    // Location overrides were added after standalone venue/address support. Omit
    // these keys unless a coordinate pair is actually supplied so older databases
    // that have migration 033 but not 034 can still create ordinary events.
    if (lat != null && lng != null) {
      payload.latitude = lat;
      payload.longitude = lng;
    }
    return payload;
  });

  // EVENT_SELECT_BASE contains the fields guaranteed by the event-listing schema
  // and avoids making creation depend on later cover/status migrations.
  const { data, error } = await supabase.from('events').insert(payloads).select(EVENT_SELECT_BASE);
  if (error || !data?.length) {
    return {
      events: [],
      event: null,
      error: error?.code === '42P01' || error?.code === 'PGRST205'
        ? 'Apply migration 032 before creating events.'
        : (error?.message || 'Could not create event.'),
    };
  }
  const events = data.map((item) => normalizeEvent(item, userId));
  return { events, event: events[0], error: null };
}

export async function createEvent(payload) {""",
    flags=re.S,
)

regex_once(
    'src/api/events.js',
    r"export async function updateEvent\(eventId, updates\) \{.*?\n\}\n\nexport async function replaceEventCoverImage",
    """export async function updateEvent(eventId, updates) {
  if (!hasSupabase || !eventId) return { event: null, error: 'Event unavailable.' };
  const latitude = updates.latitude === '' || updates.latitude == null ? null : Number(updates.latitude);
  const longitude = updates.longitude === '' || updates.longitude == null ? null : Number(updates.longitude);
  if ((latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return { event: null, error: 'Choose a valid map location.' };
  }
  if ((latitude == null) !== (longitude == null)) return { event: null, error: 'Set both latitude and longitude.' };

  const start = new Date(updates.startsAt);
  const end = updates.endsAt ? new Date(updates.endsAt) : null;
  if (!String(updates.title || '').trim() || Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) {
    return { event: null, error: 'Add an event name and valid event time.' };
  }

  const attendeeLimit = updates.maxAttendees === '' || updates.maxAttendees == null ? null : Number(updates.maxAttendees);
  if (attendeeLimit != null && (!Number.isInteger(attendeeLimit) || attendeeLimit < 1 || attendeeLimit > 100000)) {
    return { event: null, error: 'Attendee limit must be a positive whole number.' };
  }

  const payload = {
    title: String(updates.title || '').trim().slice(0, 100),
    description: String(updates.description || '').trim().slice(0, 1200),
    venue_name: String(updates.venueName || '').trim().slice(0, 160),
    address: String(updates.address || '').trim().slice(0, 300),
    event_type: ['car_show', 'cruise_in', 'cars_and_coffee', 'meetup'].includes(updates.eventType) ? updates.eventType : 'meetup',
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : null,
    max_attendees: attendeeLimit,
    latitude,
    longitude,
    updated_at: new Date().toISOString(),
  };
  const userId = await currentUserId();
  let { data, error } = await supabase.from('events').update(payload).eq('id', eventId).select(EVENT_SELECT_WITH_COVER).single();
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    ({ data, error } = await supabase.from('events').update(payload).eq('id', eventId).select(EVENT_SELECT).single());
  }
  if (error || !data) {
    const needsMigration = ['42703', 'PGRST204'].includes(error?.code);
    return { event: null, error: needsMigration ? 'Apply migration 034 before editing event pins.' : (error?.message || 'Could not update event.') };
  }
  return { event: normalizeEvent(data, userId), error: null };
}

export async function replaceEventCoverImage""",
    flags=re.S,
)

# ---------------------------------------------------------------------------
# App auth/profile lifecycle: Supabase already owns web callback detection. Keep
# only the native custom-scheme handoff, route recovery sessions deliberately,
# await real profile provisioning, and prevent duplicate visible-interval timers.
# ---------------------------------------------------------------------------
replace_once(
    'src/App.jsx',
    """    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {\n      setCurrentUser(session?.user ?? null);\n    });\n""",
    """    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {\n      setCurrentUser(session?.user ?? null);\n      if (event === 'PASSWORD_RECOVERY') navigate('/signin?recovery=1', { replace: true });\n    });\n""",
)
replace_once(
    'src/App.jsx',
    """  }, []);\n\n  // When user lands from magic link: tokens can be in hash (#access_token=...) or query (?access_token=...)\n  useEffect(() => {\n    if (!hasSupabase || !supabase || typeof window === 'undefined') return;\n    const hash = window.location.hash.slice(1);\n    const qInHash = hash.indexOf('?');\n    const searchFromHash = qInHash >= 0 ? hash.slice(qInHash + 1) : hash;\n    const fromHash = new URLSearchParams(searchFromHash);\n    const fromQuery = new URLSearchParams(window.location.search || '');\n    const access_token = fromHash.get('access_token') || fromQuery.get('access_token');\n    const refresh_token = fromHash.get('refresh_token') || fromQuery.get('refresh_token');\n    if (!access_token) return;\n    supabase.auth\n      .setSession({ access_token, refresh_token: refresh_token || '' })\n      .then(() => {\n        window.history.replaceState(null, '', window.location.pathname + '#/');\n        navigate('/', { replace: true });\n      })\n      .catch(() => {});\n  }, [hasSupabase, navigate]);\n\n""",
    """  }, [navigate]);\n\n  // Web auth callbacks are handled once by supabase-js (detectSessionInUrl). The\n  // native custom scheme still needs to hand its tokens into the web client.\n""",
)
replace_once(
    'src/App.jsx',
    """      const access_token = params.get('access_token');\n      const refresh_token = params.get('refresh_token');\n      if (!access_token) return;\n      supabase.auth\n        .setSession({ access_token, refresh_token: refresh_token || '' })\n        .then(() => navigate('/', { replace: true }))\n        .catch(() => {});\n""",
    """      const access_token = params.get('access_token');\n      const refresh_token = params.get('refresh_token');\n      const type = params.get('type');\n      if (!access_token) return;\n      supabase.auth\n        .setSession({ access_token, refresh_token: refresh_token || '' })\n        .then(() => navigate(type === 'recovery' ? '/signin?recovery=1' : '/', { replace: true }))\n        .catch((error) => console.warn('SnapMap: native auth callback failed', error));\n""",
)
replace_once(
    'src/App.jsx',
    """  useEffect(() => {\n    if (!currentUser?.id || !hasSupabase) return;\n    let cancelled = false;\n    getProfileById(currentUser.id).then((p) => {\n      if (cancelled) return;\n      if (!p) {\n        const u = (currentUser.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'user';\n        createProfile({ id: currentUser.id, username: u, displayName: u });\n        setCurrentUserProfile({ id: currentUser.id, username: u, display_name: u, avatar_url: null, bio: '' });\n      } else {\n        setCurrentUserProfile(p);\n      }\n    });\n    return () => { cancelled = true; };\n  }, [currentUser?.id, currentUser?.email]);\n""",
    """  useEffect(() => {\n    if (!currentUser?.id || !hasSupabase) return;\n    let cancelled = false;\n    (async () => {\n      const existing = await getProfileById(currentUser.id);\n      if (cancelled) return;\n      if (existing) {\n        setCurrentUserProfile(existing);\n        return;\n      }\n      const preferredUsername = (currentUser.email || '').split('@')[0]\n        .toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'user';\n      const result = await createProfile({\n        id: currentUser.id,\n        username: preferredUsername,\n        displayName: preferredUsername,\n      });\n      if (cancelled) return;\n      if (result.ok && result.profile) setCurrentUserProfile(result.profile);\n      else {\n        setCurrentUserProfile(null);\n        console.warn('SnapMap: profile provisioning failed', result.error);\n      }\n    })();\n    return () => { cancelled = true; };\n  }, [currentUser?.id, currentUser?.email]);\n""",
)
replace_once(
    'src/App.jsx',
    """    const schedule = () => {\n      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;\n      intervalId = setInterval(() => {\n""",
    """    const schedule = () => {\n      if (typeof document === 'undefined' || document.visibilityState !== 'visible' || intervalId) return;\n      intervalId = setInterval(() => {\n""",
)

# ---------------------------------------------------------------------------
# Sign-in/recovery: remove the second web token exchanger and let the central
# Supabase callback route recovery mode. Web redirect targets should not contain
# a router fragment before Supabase appends its auth fragment.
# ---------------------------------------------------------------------------
regex_once(
    'src/pages/SignIn.jsx',
    r"\nfunction getAuthParamsFromUrl\(\) \{.*?\n\}\n\nexport default function SignIn",
    "\nexport default function SignIn",
    flags=re.S,
)
replace_once(
    'src/pages/SignIn.jsx',
    """export default function SignIn({ onSuccess, currentUser }) {\n  const [mode, setMode] = useState('password'); // 'password' | 'link'\n""",
    """export default function SignIn({ onSuccess, currentUser }) {\n  const [searchParams] = useSearchParams();\n  const [mode, setMode] = useState('password'); // 'password' | 'link'\n""",
)
replace_once(
    'src/pages/SignIn.jsx',
    """  const [showSetNewPassword, setShowSetNewPassword] = useState(false);\n""",
    """  const [showSetNewPassword, setShowSetNewPassword] = useState(() => searchParams.get('recovery') === '1');\n""",
)
replace_once(
    'src/pages/SignIn.jsx',
    """  const [error, setError] = useState('');\n  const [exchanging, setExchanging] = useState(true);\n  const navigate = useNavigate();\n\n  // When user lands from magic link or password reset, exchange tokens for session\n  useEffect(() => {\n    if (!hasSupabase || !supabase) return;\n    const { access_token, refresh_token, type } = getAuthParamsFromUrl();\n    if (!access_token) {\n      setExchanging(false);\n      return;\n    }\n    supabase.auth\n      .setSession({ access_token, refresh_token: refresh_token || '' })\n      .then(() => {\n        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + '#/');\n        if (type === 'recovery') {\n          setShowSetNewPassword(true);\n        } else {\n          navigate('/', { replace: true });\n        }\n      })\n      .catch(() => setExchanging(false))\n      .finally(() => setExchanging(false));\n  }, [hasSupabase, navigate]);\n""",
    """  const [error, setError] = useState('');\n  const navigate = useNavigate();\n\n  useEffect(() => {\n    if (searchParams.get('recovery') === '1') {\n      setShowSetNewPassword(true);\n      setForgotPassword(false);\n      setSentReset(false);\n      setError('');\n    }\n  }, [searchParams]);\n""",
)
replace_once(
    'src/pages/SignIn.jsx',
    """  if (exchanging) {\n    return (\n      <div className=\"flex min-h-[50vh] flex-col items-center justify-center px-4\">\n        <p className=\"text-slate-400\">Signing you in…</p>\n      </div>\n    );\n  }\n\n""",
    "",
)
# All three web auth-email actions used the same fragment-bearing redirect.
p = Path('src/pages/SignIn.jsx')
text = p.read_text()
old_redirect = "window.location.origin + (window.location.pathname || '') + '#/'"
count = text.count(old_redirect)
if count != 3:
    raise SystemExit(f"Expected 3 auth redirect expressions in SignIn.jsx, found {count}")
p.write_text(text.replace(old_redirect, "window.location.origin + (window.location.pathname || '')"))
print('patched src/pages/SignIn.jsx redirects')
# useSearchParams is now required alongside the existing hooks.
replace_once(
    'src/pages/SignIn.jsx',
    "import { Link, useNavigate } from 'react-router-dom';",
    "import { Link, useNavigate, useSearchParams } from 'react-router-dom';",
)

# ---------------------------------------------------------------------------
# Profiles: clear stale state when routing between creators and keep usernames
# internal. Portfolio mode had reintroduced a visible @username.
# ---------------------------------------------------------------------------
replace_once(
    'src/pages/Profile.jsx',
    """  const avatarInputRef = React.useRef(null);\n\n  const userSpots = useMemo(() => {\n""",
    """  const avatarInputRef = React.useRef(null);\n  const profileDisplayName = String(profile?.display_name || '').trim() || 'SnapMap user';\n\n  const userSpots = useMemo(() => {\n""",
)
replace_once(
    'src/pages/Profile.jsx',
    """    let cancelled = false;\n    getProfileByUsername(username).then((p) => {\n""",
    """    setLoading(true);\n    setProfile(null);\n    setEditing(false);\n    setEditError('');\n    setProfilePosts([]);\n    setProfileEvents([]);\n    setConnections({ friends: [], incoming: [], outgoing: [] });\n    setFriendState('none');\n    setBlocked(false);\n    let cancelled = false;\n    getProfileByUsername(username).then((p) => {\n""",
)
p = Path('src/pages/Profile.jsx')
text = p.read_text()
# Replace user-facing fallbacks without touching routes or internal matching.
text = text.replace('profile.display_name || profile.username', 'profileDisplayName')
text = text.replace("setEditDisplayName(profileDisplayName || '');", "setEditDisplayName(profile.display_name || '');")
text = text.replace("displayName: editDisplayName.trim() || profile.username,", "displayName: editDisplayName.trim() || 'SnapMap user',")
text = text.replace("display_name: editDisplayName.trim() || profile.username,", "display_name: editDisplayName.trim() || 'SnapMap user',")
text = text.replace('<p className="mt-1 text-sm font-semibold text-white/60">@{profile.username}</p>', '<p className="mt-1 text-sm font-semibold text-white/60">Creator on SnapMap</p>')
p.write_text(text)
print('patched src/pages/Profile.jsx display-name policy')

# Account contained an unused circular Profile import.
replace_once('src/pages/Account.jsx', "import Profile from './Profile';\n", '')

print('core audit patch complete')
