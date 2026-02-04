const USER_SPOTS_KEY = 'snapmap-user-spots';
const FAVORITES_KEY = 'snapmap-favorites';

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
