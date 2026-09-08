from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor not found in {path}')
    path.write_text(text.replace(old, new, 1))

profiles = Path('src/api/profiles.js')
replace_once(
    profiles,
    """function normalizeExternalLink(value, platform = 'website') {
  const raw = String(value || '').trim().slice(0, 300);
  if (!raw) return null;
  let candidate = raw;
  if (!/^https?:\\/\\//i.test(candidate)) {
    const handle = candidate.replace(/^@/, '');
    if (platform === 'instagram' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://instagram.com/${handle}`;
    else if (platform === 'facebook' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://facebook.com/${handle}`;
    else if (platform === 'tiktok' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://tiktok.com/@${handle}`;
    else candidate = `https://${candidate.replace(/^\\/+/, '')}`;
  }
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

function normalizeSocialLinks(links = {}) {
""",
    """const SOCIAL_HOSTS = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};

function platformHandleUrl(platform, handle) {
  const clean = String(handle || '').trim().replace(/^@/, '').replace(/^\\/+|\\/+$/g, '');
  if (!clean || clean.includes('/') || /\\s/.test(clean)) return null;
  if (platform === 'instagram') return `https://instagram.com/${clean}`;
  if (platform === 'facebook') return `https://facebook.com/${clean}`;
  if (platform === 'tiktok') return `https://tiktok.com/@${clean}`;
  return null;
}

export function normalizeExternalLink(value, platform = 'website') {
  const raw = String(value || '').trim().slice(0, 300);
  if (!raw) return null;

  if (platform === 'website') {
    const candidate = /^https?:\\/\\//i.test(raw) ? raw : `https://${raw.replace(/^\\/+/, '')}`;
    try {
      const parsed = new URL(candidate);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
    } catch (_) {
      return null;
    }
  }

  const hosts = SOCIAL_HOSTS[platform] || [];
  let candidate = raw;

  if (!/^https?:\\/\\//i.test(candidate)) {
    const hostLike = candidate.replace(/^www\\./i, '').toLowerCase();
    if (hosts.some((host) => hostLike.startsWith(host.replace(/^www\\./, '') + '/'))) {
      candidate = `https://${candidate}`;
    } else {
      return platformHandleUrl(platform, candidate);
    }
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase();
    if (hosts.includes(hostname)) return parsed.toString();

    // Repair links produced by the old normalizer, e.g. @iso.regret -> https://iso.regret/.
    if ((parsed.pathname === '/' || parsed.pathname === '') && !parsed.search && !parsed.hash) {
      return platformHandleUrl(platform, hostname.replace(/^www\\./, ''));
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function normalizeSocialLinks(links = {}) {
""",
    'profiles social normalizer',
)

profile = Path('src/pages/Profile.jsx')
replace_once(
    profile,
    "import { ArrowLeft, MapPin, User, Pencil, X, Settings, UserPlus, UserCheck, Clock3, Users, Bell, Ban, CalendarDays, Camera, MessageCircle, Share2, Sparkles } from 'lucide-react';",
    "import { ArrowLeft, MapPin, User, Pencil, X, Settings, UserPlus, UserCheck, Clock3, Users, Bell, Ban, CalendarDays, Camera, MessageCircle, Share2, Sparkles, Globe2 } from 'lucide-react';",
    'profile icon import',
)
replace_once(
    profile,
    "import { getProfileByUsername, updateProfile, uploadAvatar } from '../api/profiles';",
    "import { getProfileByUsername, normalizeSocialLinks, updateProfile, uploadAvatar } from '../api/profiles';",
    'profile api import',
)
start = profile.read_text()
old_helpers = """const SOCIAL_LINK_LABELS = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

function normalizeSocialLink(value, platform) {
  const raw = String(value || '').trim().slice(0, 300);
  if (!raw) return '';
  let candidate = raw;
  if (!/^https?:\\/\\//i.test(candidate)) {
    const handle = candidate.replace(/^@/, '');
    if (platform === 'instagram' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://instagram.com/${handle}`;
    else if (platform === 'facebook' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://facebook.com/${handle}`;
    else if (platform === 'tiktok' && !candidate.includes('.') && !candidate.includes('/')) candidate = `https://tiktok.com/@${handle}`;
    else candidate = `https://${candidate.replace(/^\\/+/, '')}`;
  }
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch (_) {
    return '';
  }
}

function normalizeSocialLinks(links = {}) {
  return Object.keys(SOCIAL_LINK_LABELS).reduce((result, key) => {
    const value = normalizeSocialLink(links?.[key], key);
    if (value) result[key] = value;
    return result;
  }, {});
}

function SocialLinks({ links, className = '' }) {
  const items = Object.entries(normalizeSocialLinks(links));
  if (!items.length) return null;
  return <div className={`flex flex-wrap gap-2 ${className}`}>{items.map(([key, href]) => <a key={key} href={href} target=\"_blank\" rel=\"noreferrer noopener\" className=\"rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-extrabold text-accent-400 transition hover:border-accent-500/30 hover:bg-accent-500/[0.07]\">{SOCIAL_LINK_LABELS[key]}</a>)}</div>;
}
"""
new_helpers = """const SOCIAL_LINK_LABELS = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

function InstagramLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" className={className} fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\" /><circle cx=\"12\" cy=\"12\" r=\"4\" /><circle cx=\"17.5\" cy=\"6.5\" r=\"1\" fill=\"currentColor\" stroke=\"none\" /></svg>;
}

function FacebookLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" className={className} fill=\"currentColor\"><path d=\"M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.5v3h2.8v8h3.4Z\" /></svg>;
}

function TikTokLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" className={className} fill=\"currentColor\"><path d=\"M15.7 3c.4 2.2 1.7 3.6 3.8 4v3.1a8.1 8.1 0 0 1-3.8-1.2v6.2a5.9 5.9 0 1 1-5.1-5.8v3.2a2.8 2.8 0 1 0 1.9 2.6V3h3.2Z\" /></svg>;
}

const SOCIAL_LINK_ICONS = { website: Globe2, instagram: InstagramLogo, facebook: FacebookLogo, tiktok: TikTokLogo };

function SocialLinks({ links, className = '' }) {
  const items = Object.entries(normalizeSocialLinks(links));
  if (!items.length) return null;
  return <div className={`flex flex-wrap gap-2 ${className}`}>{items.map(([key, href]) => {
    const Icon = SOCIAL_LINK_ICONS[key] || Globe2;
    return <a key={key} href={href} target=\"_blank\" rel=\"noreferrer noopener\" aria-label={SOCIAL_LINK_LABELS[key]} title={SOCIAL_LINK_LABELS[key]} className=\"grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-secondary transition hover:-translate-y-0.5 hover:border-accent-500/35 hover:bg-accent-500/[0.08] hover:text-accent-400\"><Icon className=\"h-5 w-5\" /></a>;
  })}</div>;
}
"""
if old_helpers not in start:
    raise SystemExit('profile social helper anchor not found')
profile.write_text(start.replace(old_helpers, new_helpers, 1))

replace_once(
    profile,
    """              <div>
                <p className=\"text-xs font-medium text-slate-500\">Links</p>
                <p className=\"mt-1 text-xs text-slate-600\">Optional. Add only the links you want shown publicly.</p>
                <div className=\"mt-2 grid gap-2 sm:grid-cols-2\">
                  {Object.keys(SOCIAL_LINK_LABELS).map((key) => <label key={key} className=\"block\"><span className=\"text-[11px] font-medium text-slate-500\">{SOCIAL_LINK_LABELS[key]}</span><input type=\"text\" value={editSocialLinks[key] || ''} onChange={(e) => setEditSocialLinks((current) => ({ ...current, [key]: e.target.value }))} placeholder={key === 'website' ? 'your-site.com' : `@handle or ${key}.com/...`} maxLength={300} className=\"mt-1 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500\" /></label>)}
                </div>
              </div>
""",
    """              <div>
                <div className=\"flex items-end justify-between gap-3\"><div><p className=\"text-xs font-semibold text-slate-400\">Links</p><p className=\"mt-0.5 text-[11px] text-slate-600\">Only filled links appear publicly.</p></div><SocialLinks links={editSocialLinks} /></div>
                <div className=\"mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/10\">
                  {Object.keys(SOCIAL_LINK_LABELS).map((key, index) => {
                    const Icon = SOCIAL_LINK_ICONS[key] || Globe2;
                    const placeholder = key === 'website' ? 'your-site.com' : '@handle or full URL';
                    return <label key={key} className={`flex items-center gap-3 px-3 py-3 ${index ? 'border-t border-white/[0.06]' : ''}`}>
                      <span className=\"grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.045] text-slate-400\"><Icon className=\"h-4.5 w-4.5\" /></span>
                      <div className=\"min-w-0 flex-1\"><span className=\"text-[10px] font-bold uppercase tracking-wider text-slate-500\">{SOCIAL_LINK_LABELS[key]}</span><input type=\"text\" value={editSocialLinks[key] || ''} onChange={(e) => setEditSocialLinks((current) => ({ ...current, [key]: e.target.value }))} placeholder={placeholder} maxLength={300} autoCapitalize=\"none\" autoCorrect=\"off\" spellCheck={false} className=\"mt-0.5 w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder-slate-600 focus:ring-0\" /></div>
                    </label>;
                  })}
                </div>
              </div>
""",
    'profile links editor',
)
print('Social link normalization and profile layout patch applied.')
