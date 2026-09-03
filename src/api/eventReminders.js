import { hasSupabase, supabase } from './supabase';

export async function fetchEventReminder(eventId) {
  if (!hasSupabase || !eventId) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('event_reminders')
    .select('event_id, day_before, hours_before')
    .eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
  if (error) return null;
  return data ? { eventId: data.event_id, dayBefore: data.day_before, hoursBefore: data.hours_before } : null;
}

export async function setEventReminder(eventId, enabled, hoursBefore = 3) {
  if (!hasSupabase || !eventId) return { ok: false, error: 'Event reminders need cloud sync.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to use event reminders.' };
  const request = enabled
    ? supabase.from('event_reminders').upsert({ event_id: eventId, user_id: user.id, day_before: true, hours_before: Math.min(12, Math.max(1, Number(hoursBefore) || 3)), updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' })
    : supabase.from('event_reminders').delete().eq('event_id', eventId).eq('user_id', user.id);
  const { error } = await request;
  return error ? { ok: false, error: ['42P01', 'PGRST205'].includes(error.code) ? 'Apply migration 037 to use event reminders.' : (error.message || 'Could not update reminder.') } : { ok: true, error: null };
}

export async function claimDueEventReminders() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase.rpc('claim_due_event_reminders');
  if (error) return [];
  return (data || []).map((item) => ({
    id: item.notification_id,
    eventId: item.reminder_event_id,
    kind: item.reminder_kind,
    title: item.event_title,
    startsAt: item.event_starts_at,
    venueName: item.event_venue_name,
  }));
}

export function browserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserNotifications() {
  if (browserNotificationPermission() === 'unsupported') return 'unsupported';
  try { return await window.Notification.requestPermission(); } catch { return 'denied'; }
}

export async function showBrowserEventReminder(reminder) {
  if (browserNotificationPermission() !== 'granted' || !reminder) return false;
  const when = new Date(reminder.startsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const body = `${reminder.title} starts ${when}${reminder.venueName ? ` at ${reminder.venueName}` : ''}.`;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(reminder.kind === 'soon' ? 'Event starting soon' : 'Event tomorrow', {
        body,
        icon: `${import.meta.env.BASE_URL}snapmap-icon.png`,
        badge: `${import.meta.env.BASE_URL}snapmap-icon.png`,
        tag: `snapmap-event-${reminder.eventId}-${reminder.kind}`,
        data: { url: `#/event/${reminder.eventId}` },
      });
      return true;
    }
    new window.Notification('SnapMap event reminder', { body });
    return true;
  } catch {
    return false;
  }
}

