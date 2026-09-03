import { hasSupabase, supabase } from './supabase';

export async function fetchMyEventClaim(eventId) {
  if (!hasSupabase || !eventId) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('event_claims')
    .select('id, event_id, claimant_id, organizer_role, verification_contact, proof_note, status, created_at, reviewed_at')
    .eq('event_id', eventId)
    .eq('claimant_id', user.id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function submitEventClaim({ eventId, organizerRole, verificationContact, proofNote }) {
  if (!hasSupabase || !eventId) return { claim: null, error: 'Event claims are unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { claim: null, error: 'Sign in to claim an event.' };
  const contact = String(verificationContact || '').trim().slice(0, 300);
  const proof = String(proofNote || '').trim().slice(0, 1500);
  if (contact.length < 3 || proof.length < 10) return { claim: null, error: 'Add verification contact information and a short explanation.' };
  const { data: claimId, error } = await supabase.rpc('submit_event_claim', {
    target_event_id: eventId,
    claim_role: ['organizer', 'venue', 'staff'].includes(organizerRole) ? organizerRole : 'organizer',
    claim_contact: contact,
    claim_proof: proof,
  });
  if (!error && claimId) return { claim: { id: claimId, event_id: eventId, claimant_id: user.id, organizer_role: organizerRole, status: 'pending', created_at: new Date().toISOString() }, error: null };
  if (['42883', 'PGRST202'].includes(error?.code)) return { claim: null, error: 'Run migration 042 to enable event claims.' };
  return { claim: null, error: error?.message || 'Could not submit the claim.' };
}
