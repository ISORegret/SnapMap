import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarDays, Camera, Flag, MapPin, MessageCircle, Send, User, X } from 'lucide-react';
import { getFriendConnections, getFriendState } from '../api/follows';
import { getProfileByUsername } from '../api/profiles';
import { blockUser } from '../api/safety';
import { fetchConversation, fetchInbox, markConversationRead, reportPrivateMessage, sendMessage, subscribeToMessages } from '../api/messages';

function timeLabel(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ profile, className = 'h-12 w-12' }) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400 ${className}`}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}</span>;
}

function shareHref(message) {
  if (message.shareType === 'spot') return `/spot/${message.shareId}`;
  if (message.shareType === 'event') return `/event/${message.shareId}`;
  return `/explore?post=${message.shareId}`;
}

function ShareCard({ share, onRemove }) {
  if (!share) return null;
  const Icon = share.type === 'event' ? CalendarDays : share.type === 'post' ? Camera : MapPin;
  return <div className="flex items-center gap-3 rounded-2xl border border-accent-500/20 bg-accent-500/[0.07] p-3">
    {share.imageUrl ? <img src={share.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-400"><Icon className="h-5 w-5" /></span>}
    <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-accent-400">Sharing {share.type}</p><p className="truncate text-sm font-extrabold text-primary">{share.title || 'SnapMap share'}</p>{share.subtitle && <p className="truncate text-xs text-muted">{share.subtitle}</p>}</div>
    {onRemove && <button type="button" onClick={onRemove} className="icon-button h-8 w-8 rounded-xl" aria-label="Remove share"><X className="h-4 w-4" /></button>}
  </div>;
}

function Inbox({ currentUser, share }) {
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const [inbox, connections] = await Promise.all([fetchInbox(), getFriendConnections(currentUser.id)]);
    setConversations(inbox);
    setFriends(connections.friends || []);
    setLoading(false);
  }, [currentUser.id]);
  useEffect(() => { refresh(); return subscribeToMessages(refresh); }, [refresh]);
  const conversationIds = useMemo(() => new Set(conversations.map((item) => item.profile.id)), [conversations]);
  const newFriends = friends.filter((friend) => !conversationIds.has(friend.id));
  const messageState = share ? { share } : undefined;

  return <div className="page-shell pb-32 animate-fade-in">
    <header className="page-header sticky top-0 z-20"><div className="mx-auto flex max-w-2xl items-center gap-3"><Link to="/profile" className="icon-button" aria-label="Back to profile"><ArrowLeft className="h-5 w-5" /></Link><div><p className="eyebrow">Friends only</p><h1 className="text-xl font-black text-primary">Messages</h1></div></div></header>
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5">
      {share && <section><p className="mb-2 text-xs font-bold text-muted">Choose a friend to share with</p><ShareCard share={share} /></section>}
      {loading && <div className="surface-card h-40 animate-pulse rounded-[1.6rem]" />}
      {!loading && conversations.length === 0 && !friends.length && <section className="surface-card rounded-[1.6rem] p-7 text-center"><MessageCircle className="mx-auto h-9 w-9 text-accent-400" /><h2 className="mt-3 font-extrabold text-primary">Your inbox is ready</h2><p className="mt-1 text-sm text-muted">Add another creator as a friend. Once they accept, you can message each other here.</p><Link to="/explore?view=creators" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Find creators</Link></section>}
      {conversations.length > 0 && <section><p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-muted">Recent</p><div className="surface-card overflow-hidden rounded-[1.6rem] divide-y divide-[var(--border-subtle)]">{conversations.map(({ profile, latest, unreadCount }) => <Link key={profile.id} to={`/messages/${profile.username}`} state={messageState} className="flex items-center gap-3 p-4 transition hover:bg-white/[0.035]"><Avatar profile={profile} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className={`truncate text-sm ${unreadCount ? 'font-black text-primary' : 'font-extrabold text-secondary'}`}>{profile.display_name || profile.username}</p><span className="ml-auto shrink-0 text-[10px] text-muted">{timeLabel(latest.createdAt)}</span></div><p className={`mt-0.5 truncate text-xs ${unreadCount ? 'font-semibold text-secondary' : 'text-muted'}`}>{latest.senderId === currentUser.id ? 'You: ' : ''}{latest.body || `Shared a ${latest.shareType}`}</p></div>{unreadCount > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent-500 px-1.5 text-[10px] font-black text-[#211603]">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>)}</div></section>}
      {newFriends.length > 0 && <section><p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-muted">Start a message</p><div className="grid gap-2 sm:grid-cols-2">{newFriends.map((friend) => <Link key={friend.id} to={`/messages/${friend.username}`} state={messageState} className="surface-card flex items-center gap-3 rounded-2xl p-3"><Avatar profile={friend} className="h-10 w-10" /><div className="min-w-0"><p className="truncate text-sm font-extrabold text-primary">{friend.display_name || friend.username}</p><p className="truncate text-xs text-muted">@{friend.username}</p></div></Link>)}</div></section>}
    </main>
  </div>;
}

function Conversation({ currentUser, username, initialShare, onRead, showToast }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [friendState, setFriendState] = useState('loading');
  const [body, setBody] = useState('');
  const [share, setShare] = useState(initialShare || null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const refresh = useCallback(async (otherId) => {
    const items = await fetchConversation(otherId);
    setMessages(items);
    await markConversationRead(otherId);
    onRead?.();
    setLoading(false);
  }, [onRead]);

  useEffect(() => {
    let active = true;
    getProfileByUsername(username).then(async (result) => {
      if (!active || !result) { setLoading(false); return; }
      setProfile(result);
      const state = await getFriendState(currentUser.id, result.id);
      if (!active) return;
      setFriendState(state);
      if (state === 'friends') await refresh(result.id);
      else setLoading(false);
    });
    return () => { active = false; };
  }, [username, currentUser.id, refresh]);

  useEffect(() => {
    if (!profile?.id || friendState !== 'friends') return undefined;
    return subscribeToMessages(() => refresh(profile.id));
  }, [profile?.id, friendState, refresh]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    if ((!body.trim() && !share) || sending || !profile) return;
    setSending(true);
    const result = await sendMessage({ recipientId: profile.id, body, share });
    setSending(false);
    if (result.message) { setMessages((items) => [...items, result.message]); setBody(''); setShare(null); }
    else showToast?.(result.error || 'Could not send message.');
  };

  const report = async (message) => {
    if (!window.confirm('Report this message for review?')) return;
    showToast?.(await reportPrivateMessage(message.id) ? 'Message reported. Thank you.' : 'Could not report this message.');
  };
  const block = async () => {
    if (!profile || !window.confirm(`Block ${profile.display_name || profile.username}? This also removes the friendship.`)) return;
    if (await blockUser(profile.id)) { showToast?.('Creator blocked.'); navigate('/messages', { replace: true }); }
  };

  if (!loading && (!profile || friendState !== 'friends')) return <div className="page-shell px-4 py-16 text-center"><MessageCircle className="mx-auto h-9 w-9 text-muted" /><h1 className="mt-4 font-black text-primary">Messages unavailable</h1><p className="mt-1 text-sm text-muted">Private messages are available between accepted friends.</p><Link to="/messages" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Back to messages</Link></div>;

  return <div className="page-shell pb-48 animate-fade-in">
    <header className="page-header sticky top-0 z-30"><div className="mx-auto flex max-w-2xl items-center gap-3"><Link to="/messages" className="icon-button" aria-label="Back to messages"><ArrowLeft className="h-5 w-5" /></Link><Avatar profile={profile} className="h-10 w-10" /><Link to={profile ? `/user/${profile.username}` : '#'} className="min-w-0 flex-1"><p className="truncate text-sm font-black text-primary">{profile?.display_name || profile?.username || 'Loading…'}</p>{profile && <p className="truncate text-[11px] text-muted">@{profile.username}</p>}</Link>{profile && <button type="button" onClick={block} className="icon-button text-rose-400" aria-label="Block creator"><Ban className="h-4 w-4" /></button>}</div></header>
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      {loading && <div className="surface-card h-64 animate-pulse rounded-[1.6rem]" />}
      {!loading && messages.length === 0 && <div className="py-16 text-center"><MessageCircle className="mx-auto h-10 w-10 text-accent-400" /><p className="mt-3 font-extrabold text-primary">Start the conversation</p><p className="mt-1 text-sm text-muted">Only you and {profile?.display_name || profile?.username} can see these messages.</p></div>}
      <div className="space-y-2">{messages.map((message, index) => {
        const mine = message.senderId === currentUser.id;
        const attachedShare = message.shareType ? { type: message.shareType, id: message.shareId, title: message.shareTitle, subtitle: message.shareSubtitle, imageUrl: message.shareImageUrl } : null;
        return <div key={message.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[84%] rounded-[1.35rem] px-3.5 py-2.5 ${mine ? 'rounded-br-md bg-accent-500 text-[#211603]' : 'surface-card rounded-bl-md text-primary'}`}>
          {attachedShare && <Link to={shareHref(message)} className="mb-2 block overflow-hidden rounded-xl bg-black/15"><ShareCard share={attachedShare} /></Link>}
          {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>}
          <div className={`mt-1 flex items-center gap-2 text-[9px] ${mine ? 'justify-end text-[#211603]/60' : 'text-muted'}`}><span>{timeLabel(message.createdAt)}</span>{!mine && <button type="button" onClick={() => report(message)} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Report message"><Flag className="h-3 w-3" /></button>}</div>
        </div></div>;
      })}<div ref={bottomRef} /></div>
    </main>
    <form onSubmit={submit} className="fixed inset-x-0 bottom-[calc(6.1rem+env(safe-area-inset-bottom))] z-[1040] mx-auto w-full max-w-2xl px-3">
      <div className="rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-card-solid)] p-2.5 shadow-2xl backdrop-blur-xl">
        {share && <div className="mb-2"><ShareCard share={share} onRemove={() => setShare(null)} /></div>}
        <div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={1} maxLength={1500} placeholder="Message…" className="surface-input max-h-32 min-h-11 flex-1 resize-none rounded-2xl px-3.5 py-3 text-sm" /><button type="submit" disabled={sending || (!body.trim() && !share)} className="primary-button h-11 w-11 shrink-0 rounded-2xl disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button></div>
      </div>
    </form>
  </div>;
}

export default function Messages({ currentUser, onRead, showToast } = {}) {
  const { username } = useParams();
  const location = useLocation();
  const share = location.state?.share || null;
  if (!currentUser) return <div className="page-shell px-4 py-16 text-center"><MessageCircle className="mx-auto h-9 w-9 text-accent-400" /><h1 className="mt-4 font-black text-primary">Sign in to message friends</h1><Link to="/signin" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Sign in</Link></div>;
  return username ? <Conversation currentUser={currentUser} username={username} initialShare={share} onRead={onRead} showToast={showToast} /> : <Inbox currentUser={currentUser} share={share} />;
}

