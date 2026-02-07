const USER_SPOTS_KEY = 'snapmap-user-spots';
const FAVORITES_KEY = 'snapmap-favorites';
const COLLECTIONS_KEY = 'snapmap-collections';
const SYNC_CODE_KEY = 'snapmap-favorites-sync-code';
const DEVICE_ID_KEY = 'snapmap-device-id';

export function loadUserSpots() {
  try {
    const raw = localStorage.getItem(USER_SPOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserSpots(spots) {
  try {
    localStorage.setItem(USER_SPOTS_KEY, JSON.stringify(spots));
  } catch {
    // e.g. private browsing, quota exceeded — fail silently like load functions
  }
}

export function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // e.g. private browsing, quota exceeded — fail silently like load functions
  }
}

export function loadSyncCode() {
  try {
    const raw = localStorage.getItem(SYNC_CODE_KEY);
    return raw ? String(raw).trim() : '';
  } catch {
    return '';
  }
}

export function saveSyncCode(code) {
  try {
    if (code) localStorage.setItem(SYNC_CODE_KEY, String(code).trim());
    else localStorage.removeItem(SYNC_CODE_KEY);
  } catch {}
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 14) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_anon_' + Date.now();
  }
}

// Collections: named lists of spot ids
export function loadCollections() {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (list.length === 0) {
      const defaultList = [{ id: 'favorites', name: 'Favorites', spotIds: [] }];
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(defaultList));
      return defaultList;
    }
    return list;
  } catch {
    return [{ id: 'favorites', name: 'Favorites', spotIds: [] }];
  }
}

export function saveCollections(collections) {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  } catch {}
}

export function addSpotToCollection(collectionId, spotId) {
  const list = loadCollections();
  const coll = list.find((c) => c.id === collectionId);
  if (!coll || coll.spotIds.includes(spotId)) return list;
  const next = list.map((c) =>
    c.id === collectionId ? { ...c, spotIds: [...c.spotIds, spotId] } : c
  );
  saveCollections(next);
  return next;
}

export function removeSpotFromCollection(collectionId, spotId) {
  const list = loadCollections();
  const next = list.map((c) =>
    c.id === collectionId ? { ...c, spotIds: c.spotIds.filter((id) => id !== spotId) } : c
  );
  saveCollections(next);
  return next;
}

export function createCollection(name) {
  const list = loadCollections();
  const id = `coll-${Date.now()}`;
  const next = [...list, { id, name: name.trim() || 'New list', spotIds: [] }];
  saveCollections(next);
  return next;
}

export function deleteCollection(collectionId) {
  const list = loadCollections().filter((c) => c.id !== collectionId);
  saveCollections(list);
  return list;
}
