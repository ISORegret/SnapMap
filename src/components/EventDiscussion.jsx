import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, MessageCircle, Send, Trash2, User } from 'lucide-react';
import { addEventComment, deleteEventComment, fetchEventComments, subscribeToEventComments } from '../api/eventComments';

function relativeTime(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Comment({ item, currentUser, canManage, busy, onDelete }) {
  const name = item.author?.display_name || item.author?.username || 'Creator';
  const canDelete = currentUser?.id === item.userId || canManage;
  return <article className={`group rounded-2xl p-3.5 ${item.isOrganizerUpdate ? 'border border-cyan-400/20 bg-cyan-400/[0.07]' : 'bg-white/[0.035]'}`}>
    <div className="flex items-start gap-3">
      <Link to={item.author?.username ? `/user/${item.author.username}` : '#'} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">{item.author?.avatar_url ? <img src={item.author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}</Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="truncate text-sm font-extrabold text-primary">{name}</p>{item.isOrganizerUpdate && <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-300"><Megaphone className="h-3 w-3" />Update</span>}<span className="ml-auto shrink-0 text-[11px] text-muted">{relativeTime(item.createdAt)}</span></div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-secondary">{item.body}</p>
      </div>
      {canDelete && <button type="button" disabled={busy} onClick={() => onDelete(item)} className="self-center rounded-lg p-1.5 text-muted transition hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-40" aria-label="Delete message"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  </article>;
}

export default function EventDiscussion({ eventId, currentUser, canManage, showToast }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [organizerUpdate, setOrganizerUpdate] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchEventComments(eventId);
    setComments(result.comments);
    setError(result.error);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refresh();
    return subscribeToEventComments(eventId, refresh);
  }, [eventId, refresh]);

  const sorted = useMemo(() => [
    ...comments.filter((item) => item.isOrganizerUpdate).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    ...comments.filter((item) => !item.isOrganizerUpdate),
  ], [comments]);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const result = await addEventComment(eventId, body, canManage && organizerUpdate);
    setBusy(false);
    if (result.error) return showToast?.(result.error);
    setComments((current) => [...current, result.comment]);
    setBody('');
    setOrganizerUpdate(false);
  };

  const remove = async (item) => {
    if (!window.confirm(item.isOrganizerUpdate ? 'Delete this organizer update?' : 'Delete this message?')) return;
    setBusy(true);
    const ok = await deleteEventComment(item.id);
    setBusy(false);
    if (!ok) return showToast?.('Could not delete that message.');
    setComments((current) => current.filter((comment) => comment.id !== item.id));
  };

  return <section className="surface-card mt-4 rounded-[1.75rem] p-5">
    <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Event discussion</p><h2 className="mt-1 text-lg font-extrabold text-primary">Questions & updates</h2></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-500/10 text-accent-400"><MessageCircle className="h-5 w-5" /></span></div>
    {loading ? <div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/[0.04]" /> : error ? <p className="mt-4 rounded-2xl bg-amber-400/[0.06] p-3 text-sm text-amber-300">{error}</p> : sorted.length ? <div className="mt-4 space-y-2.5">{sorted.map((item) => <Comment key={item.id} item={item} currentUser={currentUser} canManage={canManage} busy={busy} onDelete={remove} />)}</div> : <p className="mt-4 text-sm text-muted">No messages yet. Ask about parking, arrival time, or where everyone is meeting.</p>}

    {currentUser ? <form onSubmit={submit} className="mt-4 border-t border-white/[0.06] pt-4">
      {canManage && <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-secondary"><input type="checkbox" checked={organizerUpdate} onChange={(event) => setOrganizerUpdate(event.target.checked)} className="h-4 w-4 rounded accent-cyan-400" /><Megaphone className="h-4 w-4 text-cyan-300" />Pin as organizer update</label>}
      <div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={2} placeholder={organizerUpdate ? 'Post an important event update…' : 'Ask a question or join the discussion…'} className="surface-input min-h-[52px] flex-1 resize-none rounded-2xl px-3.5 py-3 text-sm" /><button type="submit" disabled={busy || !body.trim()} className="primary-button h-[52px] w-[52px] shrink-0 rounded-2xl p-0 disabled:opacity-40" aria-label="Post message"><Send className="h-4 w-4" /></button></div>
    </form> : <Link to="/signin" className="primary-button mt-4 w-full py-3 text-sm">Sign in to join the discussion</Link>}
  </section>;
}
