import { supabase, hasSupabase } from './supabase';

const DEFAULT_IMAGE_URI = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('SnapMap: ignored malformed legacy array field', error);
    return [];
  }
}

function normalizeImageList(row) {
  const uploader = String(row?.created_by_display_name || '').trim();
  const legacyPhotoBy = String(row?.photo_by || '').trim() || 'Unknown';
  const parsed = parseArray(row?.images)
    .map((image) => {
      if (typeof image === 'string') {
        const uri = image.trim();
        return uri ? { uri, photoBy: legacyPhotoBy, uploadedBy: uploader || undefined } : null;
      }
      if (!image || typeof image !== 'object') return null;
      const uri = String(image.uri || image.url || '').trim();
      if (!uri) return null;
      return {
        ...image,
        uri,
        photoBy: String(image.photoBy || image.photo_by || legacyPhotoBy).trim() || 'Unknown',
        ...(image.uploadedBy || uploader ? { uploadedBy: String(image.uploadedBy || uploader).trim() } : {}),
      };
    })
    .filter(Boolean);

  if (parsed.length) return parsed;

  const legacyUri = String(row?.image_uri || '').trim();
  if (!legacyUri) return [];
  return [{
    uri: legacyUri,
    photoBy: legacyPhotoBy,
    ...(uploader ? { uploadedBy: uploader } : {}),
  }];
}

function rowToSpot(row) {
  if (!row) return null;
  const images = normalizeImageList(row);
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
    tags: parseArray(row.tags),
    images,
    // Keep legacy fields available because several UI helpers intentionally support
    // records created before the images JSON column existed.
    imageUri: String(row.image_uri || images[0]?.uri || '').trim(),
    photoBy: String(row.photo_by || images[0]?.photoBy || '').trim(),
    linkUrl: row.link_url ?? '',
    linkLabel: row.link_label ?? 'More info',
    createdAt: row.created_at,
    createdBy: row.created_by ?? '',
    createdByDisplayName: row.created_by_display_name ?? '',
    lastEditedBy: row.last_edited_by ?? '',
    ownerId: row.owner_id ?? null,
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
  return (data || []).map(rowToSpot).filter(Boolean);
}

export async function insertCommunitySpot(spot) {
  if (!hasSupabase) return { spot: null, error: 'Supabase not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)' };
  const imageList = Array.isArray(spot.images) ? spot.images.filter(Boolean) : [];
  const firstImage = imageList.length ? imageList[0] : null;
  const rawUri = typeof firstImage === 'string' ? firstImage : (firstImage?.uri ?? firstImage?.url ?? '');
  const firstUri = typeof rawUri === 'string' ? rawUri.trim() : '';
  const imageUriValue = firstUri.length > 0 ? firstUri : DEFAULT_IMAGE_URI;
  const photoBy = typeof firstImage === 'object' && firstImage?.photoBy ? String(firstImage.photoBy).trim() : 'Unknown';
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
    tags: Array.isArray(spot.tags) ? spot.tags : [],
    images: imageList,
    photo_by: photoBy || 'Unknown',
    link_url: spot.linkUrl ?? '',
    link_label: spot.linkLabel ?? 'More info',
    created_by: ((spot.createdBy ?? '').trim().slice(0, 100)) || '',
    created_by_display_name: ((spot.createdByDisplayName ?? '').trim().slice(0, 200)) || '',
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
  // Immutable (enforced by DB trigger): created_by, created_at only.
  if (updates.name != null) payload.name = updates.name;
  if (updates.description != null) payload.description = updates.description;
  if (updates.address != null) payload.address = updates.address;
  if (updates.latitude != null && Number.isFinite(Number(updates.latitude))) payload.latitude = Number(updates.latitude);
  if (updates.longitude != null && Number.isFinite(Number(updates.longitude))) payload.longitude = Number(updates.longitude);
  if (updates.parking != null) payload.parking = updates.parking;
  if (updates.howToAccess != null) payload.how_to_access = updates.howToAccess;
  if (updates.bestTime != null) payload.best_time = updates.bestTime;
  if (updates.crowdLevel != null) payload.crowd_level = updates.crowdLevel;
  if (updates.score != null) payload.score = updates.score;
  if (updates.tags != null) payload.tags = Array.isArray(updates.tags) ? updates.tags : [];
  if (updates.images != null) {
    const images = Array.isArray(updates.images) ? updates.images.filter(Boolean) : [];
    payload.images = images;
    const first = images[0];
    const firstUri = String(typeof first === 'string' ? first : (first?.uri || first?.url || '')).trim();
    const firstPhotoBy = String(typeof first === 'object' ? (first?.photoBy || first?.photo_by || '') : '').trim();
    // Keep the old columns synchronized so older clients and legacy fallback logic
    // continue to show the current primary photo.
    payload.image_uri = firstUri || DEFAULT_IMAGE_URI;
    payload.photo_by = firstPhotoBy || 'Unknown';
  }
  if (updates.linkUrl != null) payload.link_url = updates.linkUrl;
  if (updates.linkLabel != null) payload.link_label = updates.linkLabel;
  if (updates.lastEditedBy !== undefined) payload.last_edited_by = (updates.lastEditedBy ?? '').toString().trim().slice(0, 100);
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
  if (!hasSupabase || !isLikelyUuid(String(id || ''))) return false;
  const { error } = await supabase.from('spots').delete().eq('id', id);
  if (error) {
    console.warn('SnapMap: delete spot failed', error);
    return false;
  }
  return true;
}

export async function insertSpotReport(spotId, reportType = 'wrong_location', note = '') {
  if (!hasSupabase) return { ok: false, error: 'Supabase not configured' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to report a location' };
  const { error } = await supabase.from('spot_reports').insert({
    spot_id: spotId,
    reporter_id: user.id,
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
    .select('id, body, created_at, user_id, parent_id, profile:profiles!spot_notes_user_id_fkey(id, username, display_name, avatar_url)')
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
    userId: row.user_id ?? null,
    parentId: row.parent_id ?? null,
    profile: row.profile ?? null,
  }));
}

export async function insertSpotNote(spotId, body, parentId = null) {
  if (!hasSupabase) return { note: null, error: 'Supabase not configured' };
  const trimmed = (body || '').trim().slice(0, 1000);
  if (!trimmed) return { note: null, error: 'Empty note' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { note: null, error: 'Sign in to comment' };
  const { data, error } = await supabase
    .from('spot_notes')
    .insert({ spot_id: spotId, body: trimmed, user_id: user.id, parent_id: parentId || null })
    .select('id, body, created_at, user_id, parent_id, profile:profiles!spot_notes_user_id_fkey(id, username, display_name, avatar_url)')
    .single();
  if (error) {
    console.warn('SnapMap: insert spot note failed', error);
    return { note: null, error: error.message };
  }
  return {
    note: { id: data.id, body: data.body, createdAt: data.created_at, userId: data.user_id, parentId: data.parent_id, profile: data.profile ?? null },
    error: null,
  };
}

export async function deleteSpotNote(noteId) {
  if (!hasSupabase || !noteId) return false;
  const { error } = await supabase.from('spot_notes').delete().eq('id', noteId);
  if (error) console.warn('SnapMap: delete spot comment failed', error);
  return !error;
}
