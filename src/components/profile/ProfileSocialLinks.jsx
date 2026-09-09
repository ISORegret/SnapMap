import React from 'react';
import { Globe2 } from 'lucide-react';
import { normalizeSocialLinks } from '../../api/profiles';

export const SOCIAL_LINK_LABELS = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

function InstagramLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

function FacebookLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.5v3h2.8v8h3.4Z" /></svg>;
}

function TikTokLogo({ className = 'h-5 w-5' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d="M15.7 3c.4 2.2 1.7 3.6 3.8 4v3.1a8.1 8.1 0 0 1-3.8-1.2v6.2a5.9 5.9 0 1 1-5.1-5.8v3.2a2.8 2.8 0 1 0 1.9 2.6V3h3.2Z" /></svg>;
}

export const SOCIAL_LINK_ICONS = { website: Globe2, instagram: InstagramLogo, facebook: FacebookLogo, tiktok: TikTokLogo };

export default function ProfileSocialLinks({ links, className = '' }) {
  const items = Object.entries(normalizeSocialLinks(links));
  if (!items.length) return null;
  return <div className={`flex flex-wrap gap-2 ${className}`}>{items.map(([key, href]) => {
    const Icon = SOCIAL_LINK_ICONS[key] || Globe2;
    return <a key={key} href={href} target="_blank" rel="noreferrer noopener" aria-label={SOCIAL_LINK_LABELS[key]} title={SOCIAL_LINK_LABELS[key]} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-secondary transition hover:-translate-y-0.5 hover:border-accent-500/35 hover:bg-accent-500/[0.08] hover:text-accent-400"><Icon className="h-5 w-5" /></a>;
  })}</div>;
}
