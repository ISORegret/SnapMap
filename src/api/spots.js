import { supabase, hasSupabase } from './supabase';

const DEFAULT_IMAGE_URI = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

function rowToSpot(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    address: row.address ?? '',
    parking: row.parking ?? '',
    howToAccess: row.how_to_access ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    bestTime: row.best_time ?? '',
    crowdLevel: row.crowd_level ?? '',
    score: row.score ?? 0,
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
    images: Array.isArray(row.images) ? row.images : (row.images ? JSON.parse(row.images) : []),
    linkUrl: row.link_url ?? '',
    linkLabel: row.link_label ?? 'More info',
    createdAt: row.created_at,
    createdBy: row.created_by ?? '',
  };
}

export async function fetchCommunitySpots() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('SnapMap: fetch community spots failed', error);
    return [];
  }
  return (data || []).map(rowToSpot);
}

export async function insertCommunitySpot(spot) {
  if (!hasSupabase) return { spot: null, error: 'Supabase not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)' };
  const imageList = spot.images ?? [];
  const firstImage = imageList.length ? imageList[0] : null;
  const rawUri = firstImage?.uri ?? firstImage?.url ?? '';
  const firstUri = typeof rawUri === 'string' ? rawUri.trim() : '';
  const imageUriValue = firstUri.length > 0 ? firstUri : DEFAULT_IMAGE_URI;
  const photoBy = firstImage?.photoBy ? String(firstImage.photoBy).trim() : 'You';
  const row = {
    name: spot.name,
    description: spot.description ?? '',
    address: spot.address ?? '',
    parking: spot.parking ?? '',
    how_to_access: spot.howToAccess ?? '',
    latitude: spot.latitude,
    longitude: spot.longitude,
    best_time: spot.bestTime ?? '',
    crowd_level: spot.crowdLevel ?? '',
    score: spot.score ?? 0,
    tags: spot.tags ?? [],
    images: imageList,
    photo_by: photoBy || 'You',
    link_url: spot.linkUrl ?? '',
    link_label: spot.linkLabel ?? 'More info',
    created_by: ((spot.createdBy ?? '').trim().slice(0, 100)) || '',
  };
  row.image_uri = String(imageUriValue || DEFAULT_IMAGE_URI);
  const { data, error } = await supabase.from('spots').insert(row).select().single();
  if (error) {
    console.warn('SnapMap: insert spot failed', error);
    return { spot: null, error: error.message || String(error) };
  }
  return { spot: rowToSpot(data), error: null };
}

// Minimal UUID check: spot id from Supabase is uuid; local-only spots use 'user-*'
function isLikelyUuid(id) {
  if (id == null || typeof id !== 'string') return false;
  if (String(id).startsWith('user-')) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id).trim());
}

export async function updateCommunitySpot(id, updates) {
  if (!hasSupabase) return false;
  const spotId = id != null ? String(id).trim() : '';
  if (!spotId || !isLikelyUuid(spotId)) {
    console.warn('SnapMap: update spot skipped — id is not a cloud UUID', { id: spotId || id });
    return false;
  }
  const payload = {};
  // Immutable (enforced by DB trigger): latitude, longitude, created_by, created_at — do not send.
  if (updates.name != null) payload.name = updates.name;
  if (updates.description != null) payload.description = updates.description;
  if (updates.address != null) payload.address = updates.address;
  if (updates.parking != null) payload.parking = updates.parking;
  if (updates.howToAccess != null) payload.how_to_access = updates.howToAccess;
  if (updates.bestTime != null) payload.best_time = updates.bestTime;
  if (updates.crowdLevel != null) payload.crowd_level = updates.crowdLevel;
  if (updates.score != null) payload.score = updates.score;
  if (updates.tags != null) payload.tags = updates.tags;
  if (updates.images != null) payload.images = updates.images;
  if (updates.linkUrl != null) payload.link_url = updates.linkUrl;
  if (updates.linkLabel != null) payload.link_label = updates.linkLabel;
  if (Object.keys(payload).length === 0) return true;
  const { data, error } = await supabase
    .from('spots')
    .update(payload)
    .eq('id', spotId)
    .select('id')
    .single();
  if (error) {
    console.warn('SnapMap: update spot failed', { id: spotId, error: error.message, code: error.code });
    return false;
  }
  if (!data) {
    console.warn('SnapMap: update spot — no row updated', { id: spotId });
    return false;
  }
  return true;
}

export async function deleteCommunitySpot(id) {
  if (!hasSupabase) return false;
  const { error } = await supabase.from('spots').delete().eq('id', id);
  if (error) {
    console.warn('SnapMap: delete spot failed', error);
    return false;
  }
  return true;
}

export async function insertSpotReport(spotId, reportType = 'wrong_location', note = '') {
  if (!hasSupabase) return { ok: false, error: 'Supabase not configured' };
  const { error } = await supabase.from('spot_reports').insert({
    spot_id: spotId,
    report_type: reportType,
    note: (note || '').trim().slice(0, 500),
  });
  if (error) {
    console.warn('SnapMap: insert spot report failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchSpotNotes(spotId) {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('spot_notes')
    .select('id, body, created_at')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('SnapMap: fetch spot notes failed', error);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    body: row.body ?? '',
    createdAt: row.created_at,
  }));
}

export async function insertSpotNote(spotId, body) {
  if (!hasSupabase) return { note: null, error: 'Supabase not configured' };
  const trimmed = (body || '').trim().slice(0, 1000);
  if (!trimmed) return { note: null, error: 'Empty note' };
  const { data, error } = await supabase
    .from('spot_notes')
    .insert({ spot_id: spotId, body: trimmed })
    .select()
    .single();
  if (error) {
    console.warn('SnapMap: insert spot note failed', error);
    return { note: null, error: error.message };
  }
  return {
    note: { id: data.id, body: data.body, createdAt: data.created_at },
    error: null,
  };
}
