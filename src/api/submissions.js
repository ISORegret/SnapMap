import { hasSupabase, supabase } from './supabase';

const SOURCES = [
  ['spot_reports', 'Spot report', 'spot_id', 'report_type', 'reporter_id'],
  ['post_reports', 'Post report', 'post_id', 'reason', 'reporter_id'],
  ['comment_reports', 'Comment report', 'comment_id', 'reason', 'reporter_id'],
  ['private_message_reports', 'Message report', 'message_id', 'reason', 'reporter_id'],
  ['event_reports', 'Event report', 'event_id', 'report_type', 'reporter_id'],
  ['event_claims', 'Event ownership claim', 'event_id', 'organizer_role', 'claimant_id'],
];

export async function fetchMySubmissions(userId) {
  if (!hasSupabase || !userId) return { items: [], failedKinds: ['Submissions'] };
  const results = await Promise.all(SOURCES.map(async ([table, kind, target, reason, owner]) => {
    try {
      const { data, error } = await supabase.from(table)
        .select(`id,status,created_at,${target},${reason}`)
        .eq(owner, userId).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return { items: (data || []).map((row) => ({
        id: `${table}:${row.id}`, reference: row.id.slice(0, 8), kind,
        claim: table === 'event_claims', targetId: row[target], status: row.status,
        createdAt: row.created_at, reason: row[reason],
        href: row[target] && (target === 'event_id' ? `/event/${row[target]}` : target === 'spot_id' ? `/spot/${row[target]}` : null),
      })) };
    } catch { return { items: [], failedKind: kind }; }
  }));
  return {
    items: results.flatMap((result) => result.items).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    failedKinds: results.map((result) => result.failedKind).filter(Boolean),
  };
}
