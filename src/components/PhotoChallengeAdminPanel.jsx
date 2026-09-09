import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Plus, Trophy } from 'lucide-react';
import {
  choosePhotoChallengeWinner,
  createPhotoChallenge,
  fetchPhotoChallengeEntries,
  fetchPhotoChallengeWinnerId,
  fetchPhotoChallengesForAdmin,
} from '../api/photoChallenges';

function localInputValue(date) {
  const d = new Date(date);
  const pad = (value) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PhotoChallengeAdminPanel({ showToast } = {}) {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const nextEnd = new Date(nextMonday.getTime() + 7 * 86400000);

  const [challenges, setChallenges] = useState([]);
  const [reviewId, setReviewId] = useState('');
  const [entries, setEntries] = useState([]);
  const [winnerId, setWinnerId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [startsAt, setStartsAt] = useState(localInputValue(nextMonday));
  const [endsAt, setEndsAt] = useState(localInputValue(nextEnd));

  const refresh = async () => setChallenges(await fetchPhotoChallengesForAdmin());
  useEffect(() => { refresh(); }, []);

  const reviewChallenge = useMemo(() => challenges.find((challenge) => challenge.id === reviewId) || null, [challenges, reviewId]);

  useEffect(() => {
    if (!reviewId) {
      setEntries([]);
      setWinnerId(null);
      return;
    }
    Promise.all([fetchPhotoChallengeEntries(reviewId), fetchPhotoChallengeWinnerId(reviewId)]).then(([nextEntries, nextWinner]) => {
      setEntries(nextEntries);
      setWinnerId(nextWinner);
    });
  }, [reviewId]);

  const create = async (event) => {
    event.preventDefault();
    if (!title.trim() || !prompt.trim()) return;
    setBusy(true);
    const result = await createPhotoChallenge({ title, prompt, startsAt, endsAt });
    setBusy(false);
    if (!result.challenge) return showToast?.(result.error || 'Could not create challenge.');
    setTitle('');
    setPrompt('');
    setFormOpen(false);
    await refresh();
    showToast?.('Photo challenge created.');
  };

  const chooseWinner = async (entryId) => {
    if (!reviewChallenge?.isClosed) return showToast?.('Wait until entries close to choose a winner.');
    if (!window.confirm('Feature this entry as the challenge winner?')) return;
    setBusy(true);
    const result = await choosePhotoChallengeWinner(reviewChallenge.id, entryId);
    setBusy(false);
    if (!result.ok) return showToast?.(result.error || 'Could not choose winner.');
    setWinnerId(entryId);
    showToast?.('Challenge winner featured.');
  };

  return <section className="surface-card mb-5 rounded-[1.6rem] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Community feature</p><h2 className="mt-1 text-lg font-extrabold text-primary">Weekly photo challenges</h2><p className="mt-1 text-xs leading-5 text-muted">Create the theme here. Pick one featured winner after entries close.</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-500/10 text-accent-400"><Camera className="h-5 w-5" /></span></div>

    <button type="button" onClick={() => setFormOpen((open) => !open)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] py-2.5 text-xs font-extrabold text-accent-400"><Plus className="h-4 w-4" />Create next challenge</button>
    {formOpen && <form onSubmit={create} className="mt-3 space-y-3 rounded-2xl bg-white/[0.025] p-3">
      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Theme title — e.g. Warm Light" className="surface-input w-full rounded-xl px-3 py-2.5 text-sm" />
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} rows={3} placeholder="Short prompt. Keep it usable in any season." className="surface-input w-full resize-none rounded-xl px-3 py-2.5 text-sm" />
      <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-black uppercase tracking-wider text-muted">Opens<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="surface-input mt-1 w-full rounded-xl px-2.5 py-2 text-xs normal-case tracking-normal" /></label><label className="text-[10px] font-black uppercase tracking-wider text-muted">Closes<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="surface-input mt-1 w-full rounded-xl px-2.5 py-2 text-xs normal-case tracking-normal" /></label></div>
      <button type="submit" disabled={busy || !title.trim() || !prompt.trim()} className="primary-button w-full py-2.5 text-xs disabled:opacity-40">{busy ? 'Creating…' : 'Create challenge'}</button>
    </form>}

    {challenges.length > 0 && <div className="mt-4 space-y-2">{challenges.map((challenge) => <button key={challenge.id} type="button" onClick={() => setReviewId((current) => current === challenge.id ? '' : challenge.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${reviewId === challenge.id ? 'border-accent-500/35 bg-accent-500/[0.06]' : 'border-[var(--border-subtle)]'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${challenge.isClosed ? 'bg-white/[0.05] text-muted' : 'bg-emerald-400/10 text-emerald-400'}`}>{challenge.isClosed ? <Trophy className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-primary">{challenge.title}</span><span className="mt-0.5 block text-[10px] text-muted">{challenge.isClosed ? 'Closed' : challenge.isOpen ? 'Open now' : 'Upcoming'} · {new Date(challenge.endsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></span></button>)}</div>}

    {reviewChallenge && <div className="mt-4 border-t border-white/[0.06] pt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold text-primary">{reviewChallenge.title} entries</p><p className="mt-0.5 text-[10px] text-muted">{reviewChallenge.isClosed ? 'Tap an entry to feature it.' : 'Winner selection unlocks after close.'}</p></div><span className="text-xs font-bold text-muted">{entries.length}</span></div>
      {entries.length === 0 ? <p className="mt-3 rounded-xl bg-white/[0.025] px-3 py-4 text-center text-xs text-muted">No entries yet.</p> : <div className="mt-3 grid grid-cols-3 gap-2">{entries.map((entry) => <button key={entry.id} type="button" disabled={busy || !reviewChallenge.isClosed} onClick={() => chooseWinner(entry.id)} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-black disabled:cursor-default ${winnerId === entry.id ? 'border-accent-500' : 'border-transparent'}`}><img src={entry.post?.images?.[0]?.public_url} alt="" className="h-full w-full object-cover" />{winnerId === entry.id && <span className="absolute inset-0 grid place-items-center bg-black/25"><CheckCircle2 className="h-7 w-7 text-accent-400" /></span>}</button>)}</div>}
    </div>}
  </section>;
}
