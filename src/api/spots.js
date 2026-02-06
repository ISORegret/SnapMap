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
  const firstUri = firstImage?.uri ? String(firstImage.uri).trim() : '';
  const imageUri = (firstUri && firstUri.length > 0) ? firstUri : DEFAULT_IMAGE_URI;
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
    image_uri: imageUri ?? DEFAULT_IMAGE_URI,
    photo_by: photoBy || 'You',
    link_url: spot.linkUrl ?? '',
    link_label: spot.linkLabel ?? 'More info',
  };
  const { data, error } = await supabase.from('spots').insert(row).select().single();
  if (error) {
    console.warn('SnapMap: insert spot failed', error);
    return { spot: null, error: error.message || String(error) };
  }
  return { spot: rowToSpot(data), error: null };
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
