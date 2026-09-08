from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'Missing anchor for {label} in {path}')
    path.write_text(text.replace(old, new, 1))


# App: mount the privacy-safe tracker once at the application shell.
app = Path('src/App.jsx')
replace_once(
    app,
    "import ToastHost from './components/ToastHost';\n",
    "import ToastHost from './components/ToastHost';\nimport DiagnosticsTracker from './components/DiagnosticsTracker';\n",
    'App diagnostics import',
)
replace_once(
    app,
    "      <RouteScrollReset />\n      <InstallPrompt enabled={tutorialDone} />",
    "      <RouteScrollReset />\n      <DiagnosticsTracker currentUser={currentUser} />\n      <InstallPrompt enabled={tutorialDone} />",
    'App diagnostics mount',
)

# Settings: explicit, signed-in, per-device opt-in.
settings = Path('src/pages/Settings.jsx')
replace_once(settings, "  ArrowLeft,\n  Bell,", "  Activity,\n  ArrowLeft,\n  Bell,", 'Settings activity icon')
replace_once(
    settings,
    "import { browserNotificationPermission, requestBrowserNotifications } from '../api/eventReminders';\n",
    "import { browserNotificationPermission, requestBrowserNotifications } from '../api/eventReminders';\nimport { isDiagnosticsEnabled, setDiagnosticsEnabled } from '../api/diagnostics';\n",
    'Settings diagnostics import',
)
replace_once(
    settings,
    "  const [notificationPermission, setNotificationPermission] = useState(() => browserNotificationPermission());\n",
    "  const [notificationPermission, setNotificationPermission] = useState(() => browserNotificationPermission());\n  const [diagnosticsEnabled, setDiagnosticsEnabledState] = useState(() => isDiagnosticsEnabled());\n",
    'Settings diagnostics state',
)
replace_once(
    settings,
    "  const clearTemporaryData = () => {\n",
    "  const toggleDiagnostics = () => {\n    const next = !diagnosticsEnabled;\n    setDiagnosticsEnabled(next);\n    setDiagnosticsEnabledState(next);\n    showToast?.(next ? 'Optional diagnostics enabled on this device.' : 'Optional diagnostics disabled.');\n  };\n\n  const clearTemporaryData = () => {\n",
    'Settings diagnostics toggle',
)
replace_once(
    settings,
    "            <button type=\"button\" onClick={clearTemporaryData} className=\"block w-full text-left\">\n",
    "            {currentUser && <SettingRow icon={Activity} title=\"Optional diagnostics\" subtitle=\"Share fixed app-health and core-action categories. Never messages, searches, photo content, or location coordinates.\">\n              <button type=\"button\" onClick={toggleDiagnostics} className={`rounded-xl px-3 py-2 text-xs font-extrabold ${diagnosticsEnabled ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/[0.06] text-slate-500'}`} aria-pressed={diagnosticsEnabled}>\n                {diagnosticsEnabled ? 'On' : 'Off'}\n              </button>\n            </SettingRow>}\n            <button type=\"button\" onClick={clearTemporaryData} className=\"block w-full text-left\">\n",
    'Settings diagnostics row',
)

# Spot detail: instrument the intended map -> detail -> save/directions funnel only.
spot = Path('src/pages/SpotDetail.jsx')
replace_once(
    spot,
    "import { appleDirectionsUrl, googleDirectionsUrl } from '../utils/mapNavigation';\n",
    "import { appleDirectionsUrl, googleDirectionsUrl } from '../utils/mapNavigation';\nimport { recordDiagnostic } from '../api/diagnostics';\n",
    'Spot diagnostics import',
)
replace_once(
    spot,
    "  useEffect(() => {\n    if (currentUser?.id) getBlockedUserIds().then(setBlockedUserIds);\n    else setBlockedUserIds([]);\n  }, [currentUser?.id]);\n",
    "  useEffect(() => {\n    if (currentUser?.id) getBlockedUserIds().then(setBlockedUserIds);\n    else setBlockedUserIds([]);\n  }, [currentUser?.id]);\n\n  useEffect(() => {\n    if (spot?.id && currentUser?.id) recordDiagnostic('spot_view', { page: 'spot' });\n  }, [spot?.id, currentUser?.id]);\n",
    'Spot view diagnostic',
)
replace_once(
    spot,
    "          onClick={() => toggleFavorite(spot.id)}\n",
    "          onClick={() => {\n            const saving = !isFavorite(spot.id);\n            toggleFavorite(spot.id);\n            if (saving) recordDiagnostic('save_spot', { page: 'spot' });\n          }}\n",
    'Spot save diagnostic',
)
for href in ('googleMapsUrl', 'appleMapsUrl', 'wazeUrl'):
    replace_once(
        spot,
        f"              href={{{href}}}\n              target=\"_blank\"",
        f"              href={{{href}}}\n              onClick={{() => recordDiagnostic('directions', {{ page: 'spot' }})}}\n              target=\"_blank\"",
        f'Spot {href} directions diagnostic',
    )

# Admin: add a compact app-health panel without exposing user IDs or user content.
admin = Path('src/pages/Admin.jsx')
replace_once(
    admin,
    "import { ArrowLeft, BadgeCheck, Ban, CheckCircle2, ExternalLink, Flag, ShieldCheck, Trash2, XCircle } from 'lucide-react';",
    "import { Activity, ArrowLeft, BadgeCheck, Ban, CheckCircle2, ExternalLink, Flag, ShieldCheck, Trash2, XCircle } from 'lucide-react';",
    'Admin activity icon',
)
replace_once(
    admin,
    "import { dismissReport, fetchEventClaims, fetchModerationQueue, isCurrentUserAdmin, removeReportedContent, reviewEventClaim, suspendUser } from '../api/moderation';\n",
    "import { dismissReport, fetchEventClaims, fetchModerationQueue, isCurrentUserAdmin, removeReportedContent, reviewEventClaim, suspendUser } from '../api/moderation';\nimport { fetchDiagnostics } from '../api/diagnostics';\n",
    'Admin diagnostics import',
)
replace_once(
    admin,
    "  const [busyId, setBusyId] = useState('');\n",
    "  const [busyId, setBusyId] = useState('');\n  const [diagnostics, setDiagnostics] = useState([]);\n  const [diagnosticsError, setDiagnosticsError] = useState('');\n",
    'Admin diagnostics state',
)
replace_once(
    admin,
    "      const [reports, pendingClaims] = await Promise.all([fetchModerationQueue(), fetchEventClaims()]);\n      setItems(reports);\n      setClaims(pendingClaims);\n",
    "      const [reports, pendingClaims, health] = await Promise.all([fetchModerationQueue(), fetchEventClaims(), fetchDiagnostics(300)]);\n      setItems(reports);\n      setClaims(pendingClaims);\n      setDiagnostics(health.rows);\n      setDiagnosticsError(health.error);\n",
    'Admin diagnostics fetch',
)
replace_once(
    admin,
    "      setItems([]);\n      setClaims([]);\n",
    "      setItems([]);\n      setClaims([]);\n      setDiagnostics([]);\n      setDiagnosticsError('');\n",
    'Admin diagnostics clear',
)
replace_once(
    admin,
    "  const counts = useMemo(() => ({ all: items.length + claims.length, claim: claims.length, post: items.filter((item) => item.kind === 'post').length, comment: items.filter((item) => item.kind === 'comment').length, spot: items.filter((item) => item.kind === 'spot').length, message: items.filter((item) => item.kind === 'message').length, event: items.filter((item) => item.kind === 'event').length }), [items, claims]);\n",
    "  const counts = useMemo(() => ({ all: items.length + claims.length, claim: claims.length, post: items.filter((item) => item.kind === 'post').length, comment: items.filter((item) => item.kind === 'comment').length, spot: items.filter((item) => item.kind === 'spot').length, message: items.filter((item) => item.kind === 'message').length, event: items.filter((item) => item.kind === 'event').length }), [items, claims]);\n  const diagnosticsSummary = useMemo(() => {\n    const cutoff = Date.now() - (24 * 60 * 60 * 1000);\n    const recent = diagnostics.filter((row) => new Date(row.created_at).getTime() >= cutoff);\n    const count = (event) => recent.filter((row) => row.event === event).length;\n    return {\n      errors: count('app_error'),\n      mapViews: count('map_view'),\n      spotViews: count('spot_view'),\n      saves: count('save_spot'),\n      directions: count('directions'),\n      recentErrors: diagnostics.filter((row) => row.event === 'app_error').slice(0, 6),\n    };\n  }, [diagnostics]);\n",
    'Admin diagnostics summary',
)
replace_once(
    admin,
    "<h1 className=\"mt-1 text-3xl font-extrabold tracking-tight text-primary\">Moderation</h1><p className=\"mt-2 text-sm text-muted\">Review community reports and take action.</p>",
    "<h1 className=\"mt-1 text-3xl font-extrabold tracking-tight text-primary\">Admin</h1><p className=\"mt-2 text-sm text-muted\">Community safety and privacy-safe app health.</p>",
    'Admin heading',
)
replace_once(
    admin,
    "    <main className=\"mx-auto w-full max-w-4xl px-4 py-5 md:px-6\">\n      <div className=\"mb-5 grid grid-cols-4 gap-1",
    "    <main className=\"mx-auto w-full max-w-4xl px-4 py-5 md:px-6\">\n      <section className=\"surface-card mb-5 rounded-[1.6rem] p-4\">\n        <div className=\"flex items-start justify-between gap-3\"><div><p className=\"eyebrow\">App health</p><h2 className=\"mt-1 text-lg font-extrabold text-primary\">Opt-in diagnostics</h2><p className=\"mt-1 text-xs leading-5 text-muted\">Last 24 hours. Fixed categories only; no messages, searches, photos, or coordinates are collected.</p></div><span className=\"grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300\"><Activity className=\"h-5 w-5\" /></span></div>\n        {diagnosticsError ? <p className=\"mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-300\">Diagnostics unavailable: {diagnosticsError}</p> : <>\n          <div className=\"mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5\">\n            {[['Errors', diagnosticsSummary.errors], ['Map', diagnosticsSummary.mapViews], ['Spot views', diagnosticsSummary.spotViews], ['Saves', diagnosticsSummary.saves], ['Directions', diagnosticsSummary.directions]].map(([label, value]) => <div key={label} className=\"rounded-2xl bg-white/[0.035] p-3 text-center\"><p className=\"text-xl font-black text-primary\">{value}</p><p className=\"mt-1 text-[10px] font-bold uppercase tracking-wider text-muted\">{label}</p></div>)}\n          </div>\n          {diagnosticsSummary.recentErrors.length > 0 ? <div className=\"mt-4 space-y-2\"><p className=\"text-[10px] font-black uppercase tracking-wider text-muted\">Recent errors</p>{diagnosticsSummary.recentErrors.map((row, index) => <div key={`${row.created_at}-${index}`} className=\"flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-black/10 px-3 py-2 text-xs\"><span className=\"font-extrabold text-rose-400\">{row.error_type || 'Error'}</span><span className=\"font-semibold text-secondary\">{row.page}</span><span className=\"text-muted\">v{row.app_version}</span>{row.source && <span className=\"break-all text-muted\">{row.source}</span>}<span className=\"ml-auto text-[10px] text-muted\">{new Date(row.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>)}</div> : <p className=\"mt-4 text-xs text-muted\">No opt-in app errors recorded yet.</p>}\n        </>}\n      </section>\n      <div className=\"mb-5 grid grid-cols-4 gap-1",
    'Admin diagnostics panel',
)

# Product audit: mark the monitoring backlog item complete and document the privacy boundary.
audit = Path('docs/PRODUCT_AUDIT_2026-09-08.md')
text = audit.read_text()
text = text.replace(
    '### P0 — reliability and clarity\n\n1. Add error monitoring and a small analytics funnel for map → detail → save/directions.\n',
    '### P0 — reliability and clarity\n\n- Completed: optional signed-in diagnostics for map → spot detail → save/directions plus categorized app errors. Collection is per-device opt-in, throttled, RLS-protected, admin-readable only, and excludes messages, searches, photos, notes, and coordinates.\n',
    1,
)
audit.write_text(text)

print('Diagnostics finish patch applied.')
