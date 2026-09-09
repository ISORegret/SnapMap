import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { navigateBackOr } from '../utils/navigation';
import { fetchMySubmissions } from '../api/submissions';
import { submissionStatus } from '../utils/submissions';

export default function MySubmissions({ currentUser }) {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    if (currentUser) fetchMySubmissions(currentUser.id).then((data) => { if (active) setResult({ ...data, userId: currentUser.id }); });
    return () => { active = false; };
  }, [currentUser?.id, refresh]);
  const visible = result?.userId === currentUser?.id ? result : null;

  return <div className="page-shell pb-28">
    <header className="page-header">
      <button type="button" onClick={() => navigateBackOr(navigate, '/settings')} className="icon-button mb-4 gap-2 px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" />Back</button>
      <h1 className="text-2xl font-extrabold text-primary">My reports & claims</h1>
      <p className="mt-2 text-sm text-muted">Track your submissions and their review status.</p>
    </header>
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      {!currentUser ? <div className="surface-card rounded-3xl p-6"><p className="text-secondary">Sign in to see your submissions.</p><Link to="/signin" state={{ from: '/submissions' }} className="primary-button mt-4 px-4 py-2">Sign in</Link></div> : <>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">Up to 100 recent submissions per category.</p><button type="button" disabled={!visible} onClick={() => setRefresh((value) => value + 1)} className="text-sm font-bold text-accent-400 disabled:opacity-40">Refresh</button></div>
        {!visible ? <p role="status" className="text-sm text-muted">Loading submissions…</p> : <>
          {visible.failedKinds.length > 0 && <p role="alert" className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-400">Could not load: {visible.failedKinds.join(', ')}. Refresh to try again.</p>}
          {visible.items.length === 0 && visible.failedKinds.length === 0 && <div className="surface-card rounded-3xl p-6"><h2 className="font-bold text-primary">No submissions yet</h2><p className="mt-2 text-sm text-muted">Reports and event ownership claims you submit will appear here.</p></div>}
          {visible.items.map((item) => {
            const status = submissionStatus(item);
            return <article key={item.id} className="surface-card rounded-3xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-primary">{item.kind}</h2><span className="rounded-full bg-accent-500/10 px-3 py-1 text-xs font-bold text-accent-400">{status.label}</span></div>
              <p className="mt-2 text-sm text-secondary">{String(item.reason || '').replace(/_/g, ' ')}</p>
              <p className="mt-2 text-sm text-muted">{status.description}</p>
              <p className="mt-3 text-xs text-muted">Submitted {new Date(item.createdAt).toLocaleDateString()} · Reference {item.reference}</p>
              {item.href && <Link to={item.href} className="mt-3 inline-block text-sm font-bold text-accent-400">View {item.href.startsWith('/event/') ? 'event' : 'spot'}</Link>}
            </article>;
          })}
        </>}
      </>}
    </main>
  </div>;
}
