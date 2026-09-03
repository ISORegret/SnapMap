import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Ban, CheckCircle2, ExternalLink, Flag, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { dismissReport, fetchEventClaims, fetchModerationQueue, isCurrentUserAdmin, removeReportedContent, reviewEventClaim, suspendUser } from '../api/moderation';

const KIND_LABELS = { post: 'Photo post', comment: 'Location comment', spot: 'Location', message: 'Private message', event: 'Event' };

function cleanReason(value) {
  return String(value || 'inappropriate').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ReportCard({ item, busy, onDismiss, onRemove, onSuspend }) {
  const target = item.target || {};
  const author = target.author || (item.kind === 'event' ? target.host : null);
  const authorName = author?.display_name || author?.username || target.created_by_display_name || target.created_by || 'Unknown creator';
  const title = item.kind === 'post' ? target.location_name : item.kind === 'comment' ? target.spot?.name || 'Location discussion' : item.kind === 'message' ? `Message from ${authorName}` : item.kind === 'event' ? target.title : target.name;
  const body = item.kind === 'post' ? target.caption : item.kind === 'comment' || item.kind === 'message' ? target.body : target.description;
  const image = item.kind === 'post'
    ? [...(target.images || [])].sort((a, b) => a.position - b.position)[0]?.public_url
    : item.kind === 'spot' ? target.image_uri : item.kind === 'event' ? target.cover_image_url : null;

  return <article className="surface-card overflow-hidden rounded-[1.55rem]">
    {image && <div className="aspect-[16/8] overflow-hidden bg-black"><img src={image} alt="" className="h-full w-full object-cover" /></div>}
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400"><Flag className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-400">{KIND_LABELS[item.kind]}</span><span className="text-[11px] text-muted">{new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
          <h2 className="mt-2 truncate text-base font-extrabold text-primary">{title || 'Reported content'}</h2>
          <p className="mt-0.5 text-xs font-semibold text-secondary">By {authorName}</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-3">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Reason</p>
        <p className="mt-1 text-sm font-bold text-primary">{cleanReason(item.reason)}</p>
        {item.note && <p className="mt-1 text-xs leading-relaxed text-secondary">{item.note}</p>}
      </div>
      {body && <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-secondary">{body}</p>}
      {item.kind === 'event' && <div className="mt-3 rounded-2xl bg-white/[0.035] p-3 text-xs text-secondary"><p className="font-bold text-primary">{target.venue_name || 'Venue not listed'}</p><p className="mt-1">{target.address || 'Address not listed'}</p>{target.starts_at && <p className="mt-1 text-muted">{new Date(target.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}</div>}
      <p className="mt-3 text-[11px] text-muted">Reported by {item.reporter?.display_name || item.reporter?.username || 'an earlier app user'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {item.kind === 'event' && <Link to={`/event/${target.id}`} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] px-3 py-2.5 text-xs font-extrabold text-accent-400 sm:col-span-3"><ExternalLink className="h-4 w-4" />Open and correct event</Link>}
        <button type="button" disabled={busy} onClick={() => onDismiss(item)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5 text-xs font-extrabold text-secondary disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Dismiss</button>
        {item.targetUserId && <button type="button" disabled={busy} onClick={() => onSuspend(item)} className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs font-extrabold text-amber-400 disabled:opacity-40"><Ban className="h-4 w-4" />Suspend 7d</button>}
        <button type="button" disabled={busy} onClick={() => onRemove(item)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-extrabold text-white disabled:opacity-40 sm:col-span-1"><Trash2 className="h-4 w-4" />Remove</button>
      </div>
    </div>
  </article>;
}

function ClaimCard({ claim, busy, onReview }) {
  const event = claim.event || {};
  const claimant = claim.claimant || {};
  return <article className="surface-card overflow-hidden rounded-[1.55rem] border-cyan-400/20">
    {event.cover_image_url && <div className="aspect-[16/7] overflow-hidden bg-black"><img src={event.cover_image_url} alt="" className="h-full w-full object-cover" /></div>}
    <div className="p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><BadgeCheck className="h-5 w-5" /></span><div className="min-w-0"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">Ownership claim</span><h2 className="mt-2 truncate text-base font-extrabold text-primary">{event.title || 'Imported event'}</h2><p className="mt-0.5 text-xs font-semibold text-secondary">{claimant.display_name || claimant.username || 'Creator'} · {cleanReason(claim.organizer_role)}</p></div></div>
      <div className="mt-4 space-y-3 rounded-2xl bg-white/[0.035] p-3 text-sm"><div><p className="text-[10px] font-black uppercase tracking-wider text-muted">Verification contact</p><p className="mt-1 break-words font-semibold text-primary">{claim.verification_contact}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-muted">Proof</p><p className="mt-1 whitespace-pre-wrap leading-relaxed text-secondary">{claim.proof_note}</p></div></div>
      <Link to={`/event/${event.id}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] py-2.5 text-xs font-extrabold text-secondary"><ExternalLink className="h-4 w-4" />Review event</Link>
      <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => onReview(claim, false)} className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 py-2.5 text-xs font-extrabold text-rose-400 disabled:opacity-40"><XCircle className="h-4 w-4" />Reject</button><button type="button" disabled={busy} onClick={() => onReview(claim, true)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 py-2.5 text-xs font-extrabold text-[#052e24] disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Approve owner</button></div>
    </div>
  </article>;
}

export default function Admin({ currentUser, showToast }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(null);
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState('');

  const refresh = async () => {
    setLoading(true);
    const admin = await isCurrentUserAdmin();
    setAllowed(admin);
    if (admin) {
      const [reports, pendingClaims] = await Promise.all([fetchModerationQueue(), fetchEventClaims()]);
      setItems(reports);
      setClaims(pendingClaims);
    } else {
      setItems([]);
      setClaims([]);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [currentUser?.id]);

  const visibleItems = useMemo(() => filter === 'all' ? items : filter === 'claim' ? [] : items.filter((item) => item.kind === filter), [items, filter]);
  const counts = useMemo(() => ({ all: items.length + claims.length, claim: claims.length, post: items.filter((item) => item.kind === 'post').length, comment: items.filter((item) => item.kind === 'comment').length, spot: items.filter((item) => item.kind === 'spot').length, message: items.filter((item) => item.kind === 'message').length, event: items.filter((item) => item.kind === 'event').length }), [items, claims]);

  const complete = async (item, action) => {
    setBusyId(item.id);
    const ok = await action();
    setBusyId('');
    if (ok) setItems((current) => current.filter((report) => report.id !== item.id));
    else showToast?.('That moderation action could not be completed.');
    return ok;
  };

  const handleRemove = (item) => {
    if (!window.confirm(`Remove this ${KIND_LABELS[item.kind].toLowerCase()}? This cannot be undone.`)) return;
    complete(item, () => removeReportedContent(item)).then((ok) => ok && showToast?.('Content removed.'));
  };

  const handleSuspend = (item) => {
    if (!window.confirm('Suspend this creator from posting, commenting, liking, and sending friend requests for 7 days?')) return;
    setBusyId(item.id);
    suspendUser(item.targetUserId, 7, `Reported ${KIND_LABELS[item.kind].toLowerCase()}`).then((ok) => {
      setBusyId('');
      showToast?.(ok ? 'Creator suspended for 7 days.' : 'Could not suspend this creator.');
    });
  };

  const handleClaimReview = (claim, approve) => {
    if (!window.confirm(approve ? 'Approve this claim and give the creator full control of the event?' : 'Reject this ownership claim?')) return;
    setBusyId(claim.id);
    reviewEventClaim(claim.id, approve).then((ok) => {
      setBusyId('');
      if (ok) {
        setClaims((current) => current.filter((item) => item.id !== claim.id));
        showToast?.(approve ? 'Event ownership transferred.' : 'Claim rejected.');
      } else showToast?.('The ownership claim could not be updated.');
    });
  };

  if (loading || allowed == null) return <div className="page-shell flex min-h-[55vh] items-center justify-center"><ShieldCheck className="h-8 w-8 animate-pulse text-accent-400" /></div>;

  if (!currentUser || !allowed) return <div className="page-shell px-4 py-16 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-muted" /><h1 className="mt-4 text-xl font-extrabold text-primary">Admin access required</h1><p className="mx-auto mt-2 max-w-sm text-sm text-muted">This area is restricted to SnapMap moderators.</p><button type="button" onClick={() => navigate(-1)} className="primary-button mt-5 px-5 py-2.5 text-sm">Go back</button></div>;

  return <div className="page-shell pb-28 animate-fade-in">
    <header className="page-header sticky top-0 z-20">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate(-1)} className="icon-button mb-4 gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold"><ArrowLeft className="h-5 w-5" />Back</button>
        <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Private controls</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-primary">Moderation</h1><p className="mt-2 text-sm text-muted">Review community reports and take action.</p></div><div className="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-400"><ShieldCheck className="h-5 w-5" /></div></div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6">
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-[1.2rem] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1 sm:grid-cols-7">
        {[['all', 'All'], ['claim', 'Claims'], ['event', 'Events'], ['post', 'Posts'], ['comment', 'Comments'], ['spot', 'Spots'], ['message', 'Messages']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-2xl px-1 py-2.5 text-[10px] font-extrabold transition sm:px-2 sm:text-[11px] ${filter === value ? 'bg-accent-500 text-[#211603]' : 'text-secondary'}`}>{label}<span className="ml-1 opacity-70">{counts[value]}</span></button>)}
      </div>
      {(filter === 'all' || filter === 'claim') && claims.length > 0 && <section className="mb-6"><div className="mb-3 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-extrabold uppercase tracking-wider text-secondary">Ownership claims</h2></div><div className="grid gap-4 md:grid-cols-2">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} busy={busyId === claim.id} onReview={handleClaimReview} />)}</div></section>}
      {visibleItems.length === 0 && !((filter === 'all' || filter === 'claim') && claims.length > 0) ? <div className="surface-card rounded-[1.65rem] px-6 py-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" /><h2 className="mt-4 font-extrabold text-primary">Queue clear</h2><p className="mt-1 text-sm text-muted">Nothing waiting in this section.</p></div>
      : visibleItems.length > 0 && <div className="grid gap-4 md:grid-cols-2">{visibleItems.map((item) => <ReportCard key={`${item.kind}-${item.id}`} item={item} busy={busyId === item.id} onDismiss={(report) => complete(report, () => dismissReport(report))} onRemove={handleRemove} onSuspend={handleSuspend} />)}</div>}
    </main>
  </div>;
}
