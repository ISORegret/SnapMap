export const MAP_APP_PREFERENCE_KEY = 'snapmap_preferred_maps_app';

export const MAP_APP_OPTIONS = [
  { id: 'ask', label: 'Ask every time' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
];

export function getMapAppPreference() {
  if (typeof window === 'undefined') return 'ask';
  const saved = window.localStorage.getItem(MAP_APP_PREFERENCE_KEY);
  return MAP_APP_OPTIONS.some((option) => option.id === saved) ? saved : 'ask';
}

export function setMapAppPreference(value) {
  if (typeof window === 'undefined') return;
  const next = MAP_APP_OPTIONS.some((option) => option.id === value) ? value : 'ask';
  window.localStorage.setItem(MAP_APP_PREFERENCE_KEY, next);
}

export function googleDirectionsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}&travelmode=driving`;
}

export function appleDirectionsUrl(latitude, longitude) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(`${latitude},${longitude}`)}&dirflg=d`;
}

function validPoint(point) {
  const latitude = Number(point?.lat ?? point?.latitude);
  const longitude = Number(point?.lng ?? point?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude},${longitude}`;
}

export function googleMultiStopDirectionsUrl(stops = [], origin = null) {
  const points = stops.map(validPoint).filter(Boolean);
  if (!points.length) return 'https://www.google.com/maps';
  const params = new URLSearchParams({ api: '1', destination: points[points.length - 1], travelmode: 'driving' });
  const start = validPoint(origin);
  if (start) params.set('origin', start);
  if (points.length > 1) params.set('waypoints', points.slice(0, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function appleMultiStopDirectionsUrl(stops = [], origin = null) {
  const points = stops.map(validPoint).filter(Boolean);
  if (!points.length) return 'https://maps.apple.com';
  const params = new URLSearchParams({ destination: points[points.length - 1], mode: 'driving' });
  const start = validPoint(origin);
  if (start) params.set('source', start);
  points.slice(0, -1).forEach((point) => params.append('waypoint', point));
  return `https://maps.apple.com/directions?${params.toString()}`;
}
