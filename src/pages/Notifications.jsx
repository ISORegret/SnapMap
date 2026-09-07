import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CalendarDays, Check, CheckCheck, Heart, MapPin, MessageCircle, Trash2, User, UserCheck, UserPlus, Users } from 'lucide-react';
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../api/notifications';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'events', label: 'Events' },
  { id: 'community', label: 'Community' },
];

const EVENT_TYPES = new Set(['event_reminder', 'event_rsvp', 'event_claim_approved', 'event_claim_rejected']);

function notificationCopy(item) {
  const name = item.actor?.display_name || 'A creator';
  if (item.type === 'event_reminder') {
    const starts = item.event?.starts_at ? new Date(item.event.starts_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon';
    return { icon: CalendarDays, text: `${item.event?.title || 'Your event'} starts ${starts}`, detail: 'Event reminder', href: item.eventId ? `/event/${item.eventId}` : '/explore?view=events', tone: 'event' };
  }
  if (item.type === 'event_rsvp') return { icon: UserCheck, text: `${name} RSVP’d to your event`, detail: item.event?.title, href: item.eventId ? `/event/${item.eventId}` : '/explore?view=events', tone: 'event' };
  if (item.type === 'event_claim_approved') return { icon: Check, text: `Your ownership claim was approved`, detail: item.event?.title, href: item.eventId ? `/event/${item.eventId}` : '/explore?view=events', tone: 'success' };
  if (item.type === 'event_claim_rejected') return { icon: Bell, text: `Your ownership claim wasn’t approved`, detail: item.event?.title, href: item.eventId ? `/event/${item.eventId}` : '/explore?view=events', tone: 'muted' };
  if (item.type === 'friend_request') return { icon: UserPlus, text: `${name} sent you a friend request`, detail: 'View creator profile', href: item.actor?.username ? `/user/${item.actor.username}` : '/profile', tone: 'social' };
  if (item.type === 'friend_accepted') return { icon: Users, text: `${name} accepted your friend request`, detail: 'You’re now friends', href: item.actor?.username ? `/user/${item.actor.username}` : '/profile', tone: 'success' };
  if (item.type === 'post_like') return { icon: Heart, text: `${name} liked your post`, detail: 'View post', href: item.postId ? `/explore?post=${item.postId}` : '/explore', tone: 'like' };
  if (item.type === 'post_comment') return { icon: MessageCircle, text: `${name} commented on your post`, detail: 'Join the conversation', href: item.postId ? `/explore?post=${item.postId}` : '/explore', tone: 'social' };
  if (item.type === 'comment_reply') return { icon: MessageCircle, text: `${name} replied to your comment`, detail: item.spot?.name, href: item.spotId ? `/spot/${item.spotId}` : '/', tone: 'social' };
  return { icon: MapPin, text: `${name} commented on ${item.spot?.name || 'your location'}`, detail: 'View location', href: item.spotId ? `/spot/${item.spotId}` : '/', tone: 'spot' };
}

function timeLabel(value) {
  const time = new Date(value).getTime();
  const elapsed = Math.max(0, Date.now() - time);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return 'Yesterday';
  if (hours < 168) return new Date(value).toLocaleDateString([], { weekday: 'short' });
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startItem = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startToday - startItem) / 86400000);
  if (dayDifference <= 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  if (dayDifference < 7) return 'This week';
  return 'Earlier';
}

const TONE_CLASSES = {
  event: 'bg-sky-400/15 text-sky-300',
  success: 'bg-emerald-400/15 text-emerald-300',
  like: 'bg-rose-400/15 text-rose-300',
  spot: 'bg-violet-400/15 text-violet-300',
  social: 'bg-accent-500/15 text-accent-400',
  muted: 'bg-white/[0.06] text-muted',
};

export default function Notifications({ currentUser, onUnreadChange }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const syncUnreadCount = useCallback((nextItems) => {
    onUnreadChange?.(nextItems.filter((item) => !item.readAt).length);
  }, [onUnreadChange]);

  const loadNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      onUnreadChange?.(0);
      return;
    }
    if (showLoading) setLoading(true);
    const result = await fetchNotifications();
    setItems(result);
    syncUnreadCount(result);
    setLoading(false);
  }, [currentUser?.id, onUnreadChange, syncUnreadCount]);

  useEffect(() => {
    let cancelled = false;
    loadNotifications({ showLoading: true });
    if (!currentUser?.id) return () => { cancelled = true; };
    const unsubscribe = subscribeToNotifications(currentUser.id, () => {
      if (!cancelled) loadNotifications();
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [currentUser?.id, loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === 'unread') return !item.readAt;
    if (filter === 'events') return EVENT_TYPES.has(item.type);
    if (filter === 'community') return !EVENT_TYPES.has(item.type);
    return true;
  }), [filter, items]);
  const groups = useMemo(() => visibleItems.reduce((result, item) => {
    const label = groupLabel(item.createdAt);
    const existing = result.find((group) => group.label === label);
    if (existing) existing.items.push(item);
    else result.push({ label, items: [item] });
    return result;
  }, []), [visibleItems]);

  const openNotification = (item, href) => {
    if (!item.readAt) {
      const readAt = new Date().toISOString();
      const nextItems = items.map((entry) => entry.id === item.id ? { ...entry, readAt } : entry);
      setItems(nextItems);
      syncUnreadCount(nextItems);
      markNotificationRead(item.id);
    }
    navigate(href);
  };

  const markEverythingRead = async () => {
    const readAt = new Date().toISOString();
    const nextItems = items.map((item) => ({ ...item, readAt: item.readAt || readAt }));
    setItems(nextItems);
    syncUnreadCount(nextItems);
    await markAllNotificationsRead();
  };

  const removeItem = async (item) => {
    const nextItems = items.filter((entry) => entry.id !== item.id);
    setItems(nextItems);
    syncUnreadCount(nextItems);
    if (!(await deleteNotification(item.id))) loadNotifications();
  };

  const clearRead = async () => {
    const nextItems = items.filter((item) => !item.readAt);
    setItems(nextItems);
    syncUnreadCount(nextItems);
    if (!(await deleteReadNotifications())) loadNotifications();
  };

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="icon-button" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="eyebrow">Activity center</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary">Notifications</h1></div>
          {unreadCount > 0 && <button type="button" onClick={markEverythingRead} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold text-accent-400 transition hover:bg-accent-500/10" aria-label="Mark all notifications read"><CheckCheck className="h-4 w-4" />All read</button>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 md:px-6">
        {!currentUser ? (
          <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">Sign in to see notifications</p><Link to="/signin" className="primary-button mt-5 inline-flex px-5 py-2.5 text-sm">Sign in</Link></div>
        ) : loading ? (
          [0, 1, 2].map((item) => <div key={item} className="surface-card h-20 animate-pulse rounded-[1.4rem]" />)
        ) : items.length === 0 ? (
          <div className="surface-card rounded-[1.5rem] px-6 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">You’re all caught up</p><p className="mt-1 text-sm text-muted">Event reminders and community activity will appear here.</p></div>
        ) : <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0" aria-label="Notification filters">
            {FILTERS.map((option) => {
              const count = option.id === 'unread' ? unreadCount : option.id === 'events' ? items.filter((item) => EVENT_TYPES.has(item.type)).length : option.id === 'community' ? items.filter((item) => !EVENT_TYPES.has(item.type)).length : items.length;
              return <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-extrabold transition ${filter === option.id ? 'border-accent-500/50 bg-accent-500/15 text-accent-400' : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-muted'}`}>{option.label}{count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}</button>;
            })}
            {items.some((item) => item.readAt) && <button type="button" onClick={clearRead} className="ml-auto shrink-0 rounded-full px-3 py-2 text-xs font-bold text-muted transition hover:bg-white/[0.04] hover:text-primary">Clear read</button>}
          </div>

          {visibleItems.length === 0 ? (
            <div className="surface-card rounded-[1.5rem] px-6 py-12 text-center"><CheckCheck className="mx-auto h-8 w-8 text-muted" /><p className="mt-4 font-bold text-primary">Nothing here right now</p><p className="mt-1 text-sm text-muted">Try another notification filter.</p></div>
          ) : groups.map((group) => (
            <section key={group.label} className="space-y-2.5">
              <p className="px-1 pt-2 text-xs font-black uppercase tracking-[0.16em] text-muted">{group.label}</p>
              {group.items.map((item) => {
                const content = notificationCopy(item);
                const Icon = content.icon;
                return (
                  <article key={item.id} className={`surface-card flex items-center gap-2 rounded-[1.4rem] p-2 transition ${!item.readAt ? 'border-accent-500/30 bg-accent-500/[0.06]' : ''}`}>
                    <button type="button" onClick={() => openNotification(item, content.href)} className="flex min-w-0 flex-1 items-center gap-3 rounded-[1rem] p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${TONE_CLASSES[content.tone] || TONE_CLASSES.social}`}>{item.actor?.avatar_url ? <img src={item.actor.avatar_url} alt="" className="h-full w-full object-cover" /> : item.actor ? <User className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div>
                      <div className="min-w-0 flex-1"><p className={`text-sm leading-snug text-primary ${!item.readAt ? 'font-extrabold' : 'font-semibold'}`}>{content.text}</p><div className="mt-1 flex items-center gap-1.5 text-xs text-muted"><span className="truncate">{content.detail || 'Open update'}</span><span aria-hidden="true">·</span><time className="shrink-0" dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time></div></div>
                      {!item.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" aria-label="Unread" />}
                    </button>
                    <button type="button" onClick={() => removeItem(item)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-rose-400/10 hover:text-rose-300" aria-label="Delete notification"><Trash2 className="h-4 w-4" /></button>
                  </article>
                );
              })}
            </section>
          ))}
        </>}
      </main>
    </div>
  );
}
