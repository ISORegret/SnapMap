import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, X } from 'lucide-react';
import { fetchActivePhotoChallenge } from '../api/photoChallenges';

export default function PhotoChallengeMapShortcut() {
  const [challenge, setChallenge] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchActivePhotoChallenge().then((next) => {
      if (!active || !next) return;
      setChallenge(next);
      try {
        setDismissed(localStorage.getItem(`snapmap_challenge_dismissed_${next.id}`) === '1');
      } catch {
        setDismissed(false);
      }
    });
    return () => { active = false; };
  }, []);

  if (!challenge || dismissed) return null;

  const dismiss = (event) => {
    event.preventDefault();
    event.stopPropagation();
    try { localStorage.setItem(`snapmap_challenge_dismissed_${challenge.id}`, '1'); } catch {}
    setDismissed(true);
  };

  return <Link to={`/challenge/${challenge.id}`} className="surface-card absolute bottom-[8.35rem] right-3 z-[1003] flex max-w-[15.5rem] items-center gap-2.5 rounded-full border-accent-500/25 bg-[var(--bg-nav)] py-2 pl-2 pr-1.5 shadow-2xl backdrop-blur-xl">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-500 text-[#211603]"><Camera className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[0.14em] text-accent-400">Weekly challenge</span><span className="block truncate text-xs font-extrabold text-primary">{challenge.title}</span></span>
    <button type="button" onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.06]" aria-label="Hide this challenge shortcut"><X className="h-3.5 w-3.5" /></button>
  </Link>;
}
