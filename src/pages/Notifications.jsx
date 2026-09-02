import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Heart, MessageCircle, User, UserCheck, UserPlus } from 'lucide-react';
import { fetchNotifications, markAllNotificationsRead } from '../api/notifications';

function notificationCopy(item) {
  const name = item.actor?.display_name || item.actor?.username || 'A creator';
  if (item.type === 'friend_request') return { icon: UserPlus, text: `${name} sent you a friend request`, href: item.actor?.username ? `/user/${item.actor.username}` : '/profile' };
  if (item.type === 'friend_accepted') return { icon: UserCheck, text: `${name} accepted your friend request`, href: item.actor?.username ? `/user/${item.actor.username}` : '/profile' };
  if (item.type === 'post_like') return { icon: Heart, text: `${name} liked your post`, href: item.postId ? `/explore?post=${item.postId}` : '/explore' };
  if (item.type === 'post_comment') return { icon: MessageCircle, text: `${name} commented on your post`, href: item.postId ? `/explore?post=${item.postId}` : '/explore' };
  if (item.type === 'comment_reply') return { icon: MessageCircle, text: `${name} replied to your comment`, href: item.spotId ? `/spot/${item.spotId}` : '/' };
  return { icon: MessageCircle, text: `${name} commented on ${item.spot?.name || 'your location'}`, href: item.spotId ? `/spot/${item.spotId}` : '/' };
}

export default function Notifications({ currentUser, onRead }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser) { setLoading(false); return; }
    fetchNotifications().then(async (result) => {
      if (cancelled) return;
      setItems(result);
      setLoading(false);
      if (result.some((item) => !item.readAt)) {
        await markAllNotificationsRead();
        if (!cancelled) onRead?.();
      }
    });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="icon-button" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="eyebrow">Updates for you</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary">Notifications</h1></div>
          <CheckCheck className="h-5 w-5 text-accent-400" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 md:px-6">
        {!currentUser ? (
          <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">Sign in to see notifications</p><Link to="/signin" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Sign in</Link></div>
        ) : loading ? (
          [0, 1, 2].map((item) => <div key={item} className="surface-card h-20 animate-pulse rounded-[1.4rem]" />)
        ) : items.length === 0 ? (
          <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">You’re all caught up</p><p className="mt-1 text-sm text-muted">Friend requests, likes, and comments will appear here.</p></div>
        ) : items.map((item) => {
          const content = notificationCopy(item);
          const Icon = content.icon;
          return (
            <Link key={item.id} to={content.href} className={`surface-card flex items-center gap-3 rounded-[1.4rem] p-3.5 transition hover:border-accent-500/30 ${!item.readAt ? 'border-accent-500/30 bg-accent-500/[0.06]' : ''}`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">{item.actor?.avatar_url ? <img src={item.actor.avatar_url} alt="" className="h-full w-full object-cover" /> : item.actor ? <User className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-snug text-primary">{content.text}</p><p className="mt-1 text-[11px] text-muted">{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div>
              {!item.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" />}
            </Link>
          );
        })}
      </main>
    </div>
  );
}
