import { supabase, hasSupabase } from './supabase';

export async function fetchFavorites(syncCode) {
  if (!hasSupabase || !syncCode || !String(syncCode).trim()) return [];
  const code = String(syncCode).trim();
  const { data, error } = await supabase
    .from('favorites')
    .select('spot_id')
    .eq('sync_code', code);
  if (error) {
    console.warn('SnapMap: fetch favorites failed', error);
    return [];
  }
  return (data || []).map((row) => row.spot_id);
}

export async function addFavorite(syncCode, spotId) {
  if (!hasSupabase || !syncCode || !spotId) return false;
  const code = String(syncCode).trim();
  const { error } = await supabase.from('favorites').insert({ sync_code: code, spot_id: spotId });
  if (error) {
    console.warn('SnapMap: add favorite failed', error);
    return false;
  }
  return true;
}

export async function removeFavorite(syncCode, spotId) {
  if (!hasSupabase || !syncCode || !spotId) return false;
  const code = String(syncCode).trim();
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('sync_code', code)
    .eq('spot_id', spotId);
  if (error) {
    console.warn('SnapMap: remove favorite failed', error);
    return false;
  }
  return true;
}
