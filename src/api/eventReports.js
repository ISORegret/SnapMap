import { hasSupabase, supabase } from './supabase';

export async function reportEvent(eventId, reportType, note = '') {
  if (!hasSupabase || !eventId) return { ok: false, error: 'Event reporting is unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to report an event.' };
  const allowed = ['wrong_location', 'wrong_date_time', 'canceled', 'duplicate', 'wrong_details'];
  if (!allowed.includes(reportType)) return { ok: false, error: 'Choose what is incorrect.' };
  const { error } = await supabase.from('event_reports').insert({
    reporter_id: user.id,
    event_id: eventId,
    report_type: reportType,
    note: String(note || '').trim().slice(0, 1000),
  });
  if (!error || error.code === '23505') return { ok: true, error: null };
  if (['42P01', 'PGRST205'].includes(error.code)) return { ok: false, error: 'Run migration 041 to enable event reports.' };
  return { ok: false, error: error.message || 'Could not send the report.' };
}

