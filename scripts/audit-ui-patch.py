from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))
    print(f"patched {path}")


def add_navigation_import(path):
    p = Path(path)
    text = p.read_text()
    if "../utils/navigation" in text:
        return
    matches = list(re.finditer(r"^import .*? from 'react-router-dom';$", text, re.M))
    if len(matches) != 1:
        raise SystemExit(f"Could not find unique react-router import in {path}")
    match = matches[0]
    text = text[:match.end()] + "\nimport { navigateBackOr } from '../utils/navigation';" + text[match.end():]
    p.write_text(text)
    print(f"added navigation import to {path}")


fallbacks = {
    'src/pages/Admin.jsx': '/',
    'src/pages/SpotDetail.jsx': '/',
    'src/pages/Privacy.jsx': '/',
    'src/pages/About.jsx': '/',
    'src/pages/EventDetail.jsx': '/explore?view=events',
    'src/pages/Settings.jsx': '/profile',
    'src/pages/Notifications.jsx': '/profile',
    'src/pages/RoutePlanner.jsx': '/',
}

for path, fallback in fallbacks.items():
    add_navigation_import(path)
    p = Path(path)
    text = p.read_text()
    old = "onClick={() => navigate(-1)}"
    count = text.count(old)
    if count < 1:
        raise SystemExit(f"Expected raw back handler in {path}")
    p.write_text(text.replace(old, f"onClick={{() => navigateBackOr(navigate, '{fallback}')}}"))
    print(f"replaced {count} raw back handler(s) in {path}")

# Map has a named back callback used by the Android hardware-back event.
add_navigation_import('src/pages/Map.jsx')
replace_once(
    'src/pages/Map.jsx',
    """  const goBack = useCallback(() => {\n    if (typeof window !== 'undefined' && window.history.length > 1) {\n      navigate(-1);\n    } else {\n      navigate('/', { replace: true });\n    }\n  }, [navigate]);\n""",
    """  const goBack = useCallback(() => {\n    navigateBackOr(navigate, '/');\n  }, [navigate]);\n""",
)

# Preserve username only as an internal route/account key. Public attribution uses
# display names and a neutral fallback.
replace_once(
    'src/App.jsx',
    "createdByDisplayName: (profile.display_name || profile.displayName || '').trim() || profile.username,",
    "createdByDisplayName: (profile.display_name || profile.displayName || '').trim() || 'SnapMap user',",
)
replace_once(
    'src/App.jsx',
    """      const payload = currentUserProfile?.username\n        ? { ...updates, lastEditedBy: currentUserProfile.username }\n        : updates;\n""",
    """      const editorDisplayName = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim();\n      const payload = currentUserProfile\n        ? { ...updates, lastEditedBy: editorDisplayName || 'SnapMap user' }\n        : updates;\n""",
)

profile_path = Path('src/pages/Profile.jsx')
profile = profile_path.read_text()
replacements = [
    (
        '<p className="text-sm text-slate-500">@{profile.username}</p>',
        '<p className="text-sm text-slate-500">SnapMap creator</p>',
    ),
    (
        '<div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{creator.display_name || creator.username}</p><p className="truncate text-xs text-slate-500">@{creator.username}</p></div>',
        '<div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{creator.display_name || \'SnapMap user\'}</p><p className="truncate text-xs text-slate-500">SnapMap creator</p></div>',
    ),
    (
        '<p className="mt-2 truncate text-xs font-extrabold text-primary">{creator.display_name || creator.username}</p>\n                    <p className="truncate text-[10px] text-slate-500">@{creator.username}</p>',
        '<p className="mt-2 truncate text-xs font-extrabold text-primary">{creator.display_name || \'SnapMap user\'}</p>\n                    <p className="truncate text-[10px] text-slate-500">SnapMap creator</p>',
    ),
    (
        "<p className=\"mt-3 text-xs text-slate-500\">Pending requests: {connections.outgoing.map((creator) => `@${creator.username}`).join(', ')}</p>",
        "<p className=\"mt-3 text-xs text-slate-500\">Pending requests: {connections.outgoing.map((creator) => creator.display_name || 'SnapMap user').join(', ')}</p>",
    ),
]
for old, new in replacements:
    count = profile.count(old)
    if count != 1:
        raise SystemExit(f"Expected one Profile identity match, found {count}: {old[:100]!r}")
    profile = profile.replace(old, new, 1)
profile_path.write_text(profile)
print('patched src/pages/Profile.jsx identity labels')

print('navigation and identity patch complete')
