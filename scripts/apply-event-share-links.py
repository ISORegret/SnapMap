from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor not found in {path}')
    path.write_text(text.replace(old, new, 1))

# Messages: make back actions retrace history instead of pushing Profile/Messages routes.
messages = Path('src/pages/Messages.jsx')
replace_once(
    messages,
    "import { fetchConversation, fetchInbox, markConversationRead, reportPrivateMessage, sendMessage, subscribeToMessages } from '../api/messages';",
    "import { fetchConversation, fetchInbox, markConversationRead, reportPrivateMessage, sendMessage, subscribeToMessages } from '../api/messages';\nimport { navigateBackOr } from '../utils/navigation';",
    'messages navigation import',
)
replace_once(
    messages,
    "function Inbox({ currentUser, share }) {\n  const [conversations, setConversations] = useState([]);",
    "function Inbox({ currentUser, share }) {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const [conversations, setConversations] = useState([]);",
    'inbox hooks',
)
replace_once(
    messages,
    "  const messageState = share ? { share } : undefined;",
    "  const returnTo = location.state?.from || '/profile';\n  const messageState = share || location.state?.from ? { ...(share ? { share } : {}), ...(location.state?.from ? { from: location.state.from } : {}) } : undefined;",
    'message state',
)
replace_once(
    messages,
    "<header className=\"page-header sticky top-0 z-20\"><div className=\"mx-auto flex max-w-2xl items-center gap-3\"><Link to=\"/profile\" className=\"icon-button\" aria-label=\"Back to profile\"><ArrowLeft className=\"h-5 w-5\" /></Link><div><p className=\"eyebrow\">Friends only</p><h1 className=\"text-xl font-black text-primary\">Messages</h1></div></div></header>",
    "<header className=\"page-header sticky top-0 z-20\"><div className=\"mx-auto flex max-w-2xl items-center gap-3\"><button type=\"button\" onClick={() => navigateBackOr(navigate, returnTo)} className=\"icon-button\" aria-label=\"Go back\"><ArrowLeft className=\"h-5 w-5\" /></button><div><p className=\"eyebrow\">Friends only</p><h1 className=\"text-xl font-black text-primary\">Messages</h1></div></div></header>",
    'inbox back button',
)
replace_once(
    messages,
    "function Conversation({ currentUser, username, initialShare, onRead, showToast }) {\n  const navigate = useNavigate();",
    "function Conversation({ currentUser, username, initialShare, onRead, showToast }) {\n  const navigate = useNavigate();\n  const location = useLocation();",
    'conversation location hook',
)
replace_once(
    messages,
    "<header className=\"page-header sticky top-0 z-30\"><div className=\"mx-auto flex max-w-2xl items-center gap-3\"><Link to=\"/messages\" className=\"icon-button\" aria-label=\"Back to messages\"><ArrowLeft className=\"h-5 w-5\" /></Link><Avatar profile={profile} className=\"h-10 w-10\" /><Link to={profile ? `/user/${profile.username}` : '#'} className=\"min-w-0 flex-1\"><p className=\"truncate text-sm font-black text-primary\">{profile?.display_name || 'SnapMap user' || 'Loading…'}</p></Link>{profile && <button type=\"button\" onClick={block} className=\"icon-button text-rose-400\" aria-label=\"Block creator\"><Ban className=\"h-4 w-4\" /></button>}</div></header>",
    "<header className=\"page-header sticky top-0 z-30\"><div className=\"mx-auto flex max-w-2xl items-center gap-3\"><button type=\"button\" onClick={() => navigateBackOr(navigate, '/messages')} className=\"icon-button\" aria-label=\"Go back\"><ArrowLeft className=\"h-5 w-5\" /></button><Avatar profile={profile} className=\"h-10 w-10\" /><Link to={profile ? `/user/${profile.username}` : '#'} state={profile ? { from: `${location.pathname}${location.search || ''}` } : undefined} className=\"min-w-0 flex-1\"><p className=\"truncate text-sm font-black text-primary\">{profile?.display_name || 'SnapMap user' || 'Loading…'}</p></Link>{profile && <button type=\"button\" onClick={block} className=\"icon-button text-rose-400\" aria-label=\"Block creator\"><Ban className=\"h-4 w-4\" /></button>}</div></header>",
    'conversation header navigation',
)

# Event: explicit native Share event action and origin-aware send-to-friend state.
event_detail = Path('src/pages/EventDetail.jsx')
replace_once(
    event_detail,
    "              {currentUser && <Link to=\"/messages\" state={{ share: { type: 'event', id: event.id, title: event.title, subtitle: `${event.venueName || spot?.name || 'Event'} · ${fullDate(event.startsAt)}`, imageUrl: event.coverImageUrl || getSpotPrimaryImage(spot) || '' } }} className=\"flex items-center gap-2 rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] px-3 py-2.5 text-xs font-bold text-accent-400\"><MessageCircle className=\"h-4 w-4\" />Send to friend</Link>}",
    "              <button type=\"button\" onClick={share} className=\"flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5 text-xs font-bold text-secondary\"><Share2 className=\"h-4 w-4 text-accent-400\" />Share event</button>\n              {currentUser && <Link to=\"/messages\" state={{ from: `/event/${event.id}`, share: { type: 'event', id: event.id, title: event.title, subtitle: `${event.venueName || spot?.name || 'Event'} · ${fullDate(event.startsAt)}`, imageUrl: event.coverImageUrl || getSpotPrimaryImage(spot) || '' } }} className=\"flex items-center gap-2 rounded-2xl border border-accent-500/20 bg-accent-500/[0.06] px-3 py-2.5 text-xs font-bold text-accent-400\"><MessageCircle className=\"h-4 w-4\" />Send to a friend</Link>}",
    'event share actions',
)

# Profile API: persist optional social links safely.
profiles_api = Path('src/api/profiles.js')
replace_once(
    profiles_api,
    ".select('id, username, display_name, avatar_url, bio, created_at, updated_at')",
    ".select('id, username, display_name, avatar_url, bio, social_links, created_at, updated_at')",
    'profile search projection',
)
replace_once(
    profiles_api,
    "export async function updateProfile(updates) {",
    "function normalizeExternalLink(value, platform = 'website') {\n  const raw = String(value || '').trim().slice(0, 300);\n  if (!raw) return null;\n  let candidate = raw;\n  if (!/^https?:\\/\\//i.test(candidate)) {\n    const handle = candidate.replace(/^@/, '');\n    if (platform === 'instagram' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://instagram.com/${handle}`;\n    else if (platform === 'facebook' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://facebook.com/${handle}`;\n    else if (platform === 'tiktok' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://tiktok.com/@${handle}`;\n    else candidate = `https://${candidate.replace(/^\\/+/, '')}`;\n  }\n  try {\n    const parsed = new URL(candidate);\n    if (!['http:', 'https:'].includes(parsed.protocol)) return null;\n    return parsed.toString();\n  } catch (_) {\n    return null;\n  }\n}\n\nfunction normalizeSocialLinks(links = {}) {\n  return ['website', 'instagram', 'facebook', 'tiktok'].reduce((result, key) => {\n    const normalized = normalizeExternalLink(links?.[key], key);\n    if (normalized) result[key] = normalized;\n    return result;\n  }, {});\n}\n\nexport async function updateProfile(updates) {",
    'profile social normalization',
)
replace_once(
    profiles_api,
    "  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl === '' ? null : updates.avatarUrl;\n  if (Object.keys(payload).length === 0) return true;",
    "  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl === '' ? null : updates.avatarUrl;\n  if (updates.socialLinks !== undefined) payload.social_links = normalizeSocialLinks(updates.socialLinks);\n  if (Object.keys(payload).length === 0) return true;",
    'profile social update payload',
)

# Profile UI: edit and display selected social/website links.
profile = Path('src/pages/Profile.jsx')
replace_once(
    profile,
    "function normalizeHandle(s) {\n  return String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_');\n}\n",
    "function normalizeHandle(s) {\n  return String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_');\n}\n\nconst SOCIAL_LINK_LABELS = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };\n\nfunction normalizeSocialLink(value, platform) {\n  const raw = String(value || '').trim().slice(0, 300);\n  if (!raw) return '';\n  let candidate = raw;\n  if (!/^https?:\\/\\//i.test(candidate)) {\n    const handle = candidate.replace(/^@/, '');\n    if (platform === 'instagram' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://instagram.com/${handle}`;\n    else if (platform === 'facebook' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://facebook.com/${handle}`;\n    else if (platform === 'tiktok' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://tiktok.com/@${handle}`;\n    else candidate = `https://${candidate.replace(/^\\/+/, '')}`;\n  }\n  try {\n    const parsed = new URL(candidate);\n    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';\n  } catch (_) {\n    return '';\n  }\n}\n\nfunction normalizeSocialLinks(links = {}) {\n  return Object.keys(SOCIAL_LINK_LABELS).reduce((result, key) => {\n    const value = normalizeSocialLink(links?.[key], key);\n    if (value) result[key] = value;\n    return result;\n  }, {});\n}\n\nfunction SocialLinks({ links, className = '' }) {\n  const items = Object.entries(normalizeSocialLinks(links));\n  if (!items.length) return null;\n  return <div className={`flex flex-wrap gap-2 ${className}`}>{items.map(([key, href]) => <a key={key} href={href} target=\"_blank\" rel=\"noreferrer noopener\" className=\"rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-extrabold text-accent-400 transition hover:border-accent-500/30 hover:bg-accent-500/[0.07]\">{SOCIAL_LINK_LABELS[key]}</a>)}</div>;\n}\n",
    'profile social helpers',
)
replace_once(
    profile,
    "  const [editAvatarUrl, setEditAvatarUrl] = useState('');\n  const [avatarUploading, setAvatarUploading] = useState(false);",
    "  const [editAvatarUrl, setEditAvatarUrl] = useState('');\n  const [editSocialLinks, setEditSocialLinks] = useState({ website: '', instagram: '', facebook: '', tiktok: '' });\n  const [avatarUploading, setAvatarUploading] = useState(false);",
    'profile social state',
)
replace_once(
    profile,
    "    setEditAvatarUrl(profile.avatar_url || '');\n    setEditError('');",
    "    setEditAvatarUrl(profile.avatar_url || '');\n    setEditSocialLinks({ website: '', instagram: '', facebook: '', tiktok: '', ...(profile.social_links || {}) });\n    setEditError('');",
    'profile edit social initialization',
)
replace_once(
    profile,
    "    const payload = {\n      displayName: editDisplayName.trim() || 'SnapMap user',\n      bio: editBio.trim().slice(0, 500),\n    };",
    "    const normalizedSocialLinks = normalizeSocialLinks(editSocialLinks);\n    const payload = {\n      displayName: editDisplayName.trim() || 'SnapMap user',\n      bio: editBio.trim().slice(0, 500),\n      socialLinks: normalizedSocialLinks,\n    };",
    'profile save payload',
)
replace_once(
    profile,
    "        bio: editBio.trim().slice(0, 500),\n        avatar_url: editAvatarUrl.trim() || profile.avatar_url,",
    "        bio: editBio.trim().slice(0, 500),\n        avatar_url: editAvatarUrl.trim() || profile.avatar_url,\n        social_links: normalizedSocialLinks,",
    'profile local social state',
)
replace_once(
    profile,
    "            {profile.bio && <p className=\"max-w-2xl text-base leading-7 text-secondary\">{profile.bio}</p>}\n            {specialties.length > 0",
    "            {profile.bio && <p className=\"max-w-2xl text-base leading-7 text-secondary\">{profile.bio}</p>}\n            <SocialLinks links={profile.social_links} className=\"mt-4\" />\n            {specialties.length > 0",
    'portfolio social links',
)
replace_once(
    profile,
    "            {profile.bio && (\n              <p className=\"mt-2 text-sm text-slate-400\">{profile.bio}</p>\n            )}\n            <div className=\"mt-3 flex items-center gap-4 text-sm text-slate-500\">",
    "            {profile.bio && (\n              <p className=\"mt-2 text-sm text-slate-400\">{profile.bio}</p>\n            )}\n            <SocialLinks links={profile.social_links} className=\"mt-3\" />\n            <div className=\"mt-3 flex items-center gap-4 text-sm text-slate-500\">",
    'community profile social links',
)
replace_once(
    profile,
    "              <div>\n                <label htmlFor=\"profile-bio\" className=\"block text-xs font-medium text-slate-500\">Bio</label>\n                <textarea\n                  id=\"profile-bio\"\n                  value={editBio}\n                  onChange={(e) => setEditBio(e.target.value)}\n                  placeholder=\"Short bio (optional)\"\n                  rows={3}\n                  maxLength={500}\n                  className=\"mt-1 w-full resize-none rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500\"\n                />\n              </div>\n            </div>",
    "              <div>\n                <label htmlFor=\"profile-bio\" className=\"block text-xs font-medium text-slate-500\">Bio</label>\n                <textarea\n                  id=\"profile-bio\"\n                  value={editBio}\n                  onChange={(e) => setEditBio(e.target.value)}\n                  placeholder=\"Short bio (optional)\"\n                  rows={3}\n                  maxLength={500}\n                  className=\"mt-1 w-full resize-none rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500\"\n                />\n              </div>\n              <div>\n                <p className=\"text-xs font-medium text-slate-500\">Links</p>\n                <p className=\"mt-1 text-xs text-slate-600\">Optional. Add only the links you want shown publicly.</p>\n                <div className=\"mt-2 grid gap-2 sm:grid-cols-2\">\n                  {Object.keys(SOCIAL_LINK_LABELS).map((key) => <label key={key} className=\"block\"><span className=\"text-[11px] font-medium text-slate-500\">{SOCIAL_LINK_LABELS[key]}</span><input type=\"text\" value={editSocialLinks[key] || ''} onChange={(e) => setEditSocialLinks((current) => ({ ...current, [key]: e.target.value }))} placeholder={key === 'website' ? 'your-site.com' : `@handle or ${key}.com/...`} maxLength={300} className=\"mt-1 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500\" /></label>)}\n                </div>\n              </div>\n            </div>",
    'profile link editor',
)

print('Event sharing, navigation, and creator links patch applied.')
