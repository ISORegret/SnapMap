import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronRight, Clock3, Trophy } from 'lucide-react';
import { fetchActivePhotoChallenge, fetchLatestPhotoChallenge, fetchPhotoChallengeEntries, fetchPhotoChallengeWinnerId } from '../api/photoChallenges';

export default function PhotoChallengeHighlight() {
  const [challenge, setChallenge] = useState(null);
  const [entryCount, setEntryCount] = useState(0);
  const [winnerId, setWinnerId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await fetchActivePhotoChallenge() || await fetchLatestPhotoChallenge();
      if (!active || !next) return;
      setChallenge(next);
      const [entries, winner] = await Promise.all([
        fetchPhotoChallengeEntries(next.id),
        fetchPhotoChallengeWinnerId(next.id),
      ]);
      if (!active) return;
      setEntryCount(entries.length);
      setWinnerId(winner);
    })();
    return () => { active = false; };
  }, []);

  if (!challenge) return null;
  const closedWithWinner = challenge.isClosed && winnerId;
  const deadline = new Date(challenge.endsAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' });

  return <Link to={`/challenge/${challenge.id}`} className="surface-card group block overflow-hidden rounded-[1.65rem] border-accent-500/20 bg-gradient-to-br from-accent-500/[0.10] via-[var(--bg-card-solid)] to-cyan-400/[0.05] p-4 transition hover:border-accent-500/35">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-500 text-[#211603]">{closedWithWinner ? <Trophy className="h-5 w-5" /> : <Camera className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="eyebrow">Weekly challenge</p>{challenge.isOpen && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">Open</span>}</div><h2 className="mt-1 truncate text-lg font-extrabold text-primary">{challenge.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{challenge.prompt}</p></div>
      <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-400" />
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted"><span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1.5"><Clock3 className="h-3 w-3" />{challenge.isOpen ? `Closes ${deadline}` : closedWithWinner ? 'Winner featured' : 'Winner pending'}</span><span className="rounded-full bg-white/[0.04] px-2.5 py-1.5">{entryCount} entr{entryCount === 1 ? 'y' : 'ies'}</span></div>
  </Link>;
}
