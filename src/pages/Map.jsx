import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
if (typeof window !== 'undefined') window.L = L;
import 'leaflet.markercluster';
import { MapPin, Settings, Sun, Moon, Heart, Search, ChevronDown, Download, Compass, RefreshCw, Layers as LayersIcon, Check, LocateFixed, X, Navigation, Clock3, Camera } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { haversineKm, getCurrentPosition, DISTANCE_OPTIONS_MI, milesToKm } from '../utils/geo';
import { fetchDownloadCount } from '../utils/stats';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { fetchActiveSpotActivity, subscribeToMapActivity, SPOT_CONDITIONS } from '../api/spotActivity';
import { fetchMapPosts, subscribeToFeed } from '../api/posts';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const defaultCenter = [30.3322, -81.6557];
const defaultZoom = 10;
const VIEWPORT_STORAGE_KEY = 'snapmap_last_viewport';

function isValidCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

function readSavedViewport() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEWPORT_STORAGE_KEY) || 'null');
    if (isValidCoordinate(saved?.lat, saved?.lng) && Number.isFinite(Number(saved?.zoom))) {
      return { center: [Number(saved.lat), Number(saved.lng)], zoom: Math.min(19, Math.max(2, Number(saved.zoom))) };
    }
  } catch {
    // Ignore an old or damaged saved viewport.
  }
  return null;
}

const icon = L.divIcon({
  className: 'snapmap-marker-wrap',
  html: '<span class="snapmap-marker"><span></span></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 38],
  popupAnchor: [0, -34],
});

function safeImageUrl(value) {
  const url = String(value || '');
  if (!/^https?:\/\//i.test(url)) return '';
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function liveSpotIcon(summary, post = null) {
  if (post?.imageUrl) {
    const alertCondition = ['restricted', 'closed', 'unsafe'].includes(summary?.condition);
    const markerClass = alertCondition ? 'is-alert' : summary ? 'is-live' : '';
    return L.divIcon({
      className: 'snapmap-marker-wrap',
      html: `<span class="snapmap-photo-marker ${markerClass}"><img src="${safeImageUrl(post.imageUrl)}" alt="" /><i></i></span>`,
      iconSize: [46, 52],
      iconAnchor: [23, 48],
      popupAnchor: [0, -44],
    });
  }
  if (!summary) return icon;
  const alertCondition = ['restricted', 'closed', 'unsafe'].includes(summary.condition);
  const markerClass = alertCondition ? 'is-alert' : summary.condition === 'busy' ? 'is-busy' : 'is-live';
  return L.divIcon({
    className: 'snapmap-marker-wrap',
    html: `<span class="snapmap-marker ${markerClass}"><span></span><b>${Math.min(summary.count, 9)}${summary.count > 9 ? '+' : ''}</b></span>`,
    iconSize: [40, 46],
    iconAnchor: [20, 42],
    popupAnchor: [0, -38],
  });
}

function hasParking(spot) {
  return Boolean(spot.parking && String(spot.parking).trim());
}
function applyFilter(spots, filter) {
  if (filter === 'all') return spots;
  if (filter === 'hasParking') return spots.filter(hasParking);
  return spots.filter((s) => matchesCategory(s, filter));
}

function applyDistanceFilter(spots, userPosition, distanceMi) {
  if (!userPosition || distanceMi == null) return spots;
  const km = milesToKm(distanceMi);
  return spots.filter(
    (s) => haversineKm(userPosition.lat, userPosition.lng, s.latitude, s.longitude) <= km
  );
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'hasParking', label: 'Has parking' },
  ...CATEGORIES.filter((c) => c.id !== 'all'),
];

const MAP_STYLES = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Low-light driving',
    preview: 'linear-gradient(135deg, #202a35, #080b10)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    id: 'street',
    label: 'Street',
    description: 'Clean and detailed',
    preview: 'linear-gradient(135deg, #d9e5dc, #f4efe3)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'Real-world detail',
    preview: 'linear-gradient(135deg, #52664f, #1b2b28)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Elevation and trails',
    preview: 'linear-gradient(135deg, #91a981, #d6ceb0)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  },
];

function FitBounds({ spots, fitKey }) {
  const map = useMap();
  const lastFitKeyRef = useRef(null);
  React.useEffect(() => {
    if (!spots?.length) return;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    const bounds = L.latLngBounds(spots.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, spots, fitKey]);
  return null;
}

function FlyToCenter({ center, zoom = 14 }) {
  const map = useMap();
  React.useEffect(() => {
    if (center?.lat == null || center?.lng == null) return;
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.8 });
  }, [map, center?.lat, center?.lng, center?.key, zoom]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function SpotMarkersCluster({ spots, icon, activityBySpot, recentPostBySpot, setSelectedSpotId }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    if (!map || typeof L.MarkerClusterGroup !== 'function') return;
    const group = new L.MarkerClusterGroup({ showCoverageOnHover: false, zoomToBoundsOnClick: true });
    groupRef.current = group;

    spots.forEach((spot) => {
      const marker = L.marker([spot.latitude, spot.longitude], { icon: liveSpotIcon(activityBySpot[spot.id], recentPostBySpot[spot.id]) || icon });
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        setSelectedSpotId(spot.id);
      });
      group.addLayer(marker);
    });

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map, spots, icon, activityBySpot, recentPostBySpot, setSelectedSpotId]);

  return null;
}

function ViewportTracker({ onViewportChange, onUserViewportChange }) {
  const userMoveRef = useRef(false);
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewportChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      if (!userMoveRef.current) return;
      const bounds = map.getBounds();
      userMoveRef.current = false;
      onUserViewportChange({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
    },
  });
  useEffect(() => {
    const container = map.getContainer();
    const markUserMove = () => { userMoveRef.current = true; };
    container.addEventListener('pointerdown', markUserMove, { passive: true });
    container.addEventListener('touchstart', markUserMove, { passive: true });
    container.addEventListener('wheel', markUserMove, { passive: true });
    return () => {
      container.removeEventListener('pointerdown', markUserMove);
      container.removeEventListener('touchstart', markUserMove);
      container.removeEventListener('wheel', markUserMove);
    };
  }, [map]);
  return null;
}

async function geocodeAddress(query) {
  if (!String(query).trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(String(query).trim())}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'SnapMap/1.0 (photo spot app)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.[0];
  if (!first || first.lat == null || first.lon == null) return null;
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
}

export default function Map({ allSpots, favoriteIds = [], toggleFavorite, theme = 'dark', setTheme, units = 'mi', setUnits, userPosition: sharedUserPosition = null, requestPosition: requestSharedPosition, onRefreshSpots, spotsLoading = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryLatitude = searchParams.has('lat') ? Number(searchParams.get('lat')) : null;
  const queryLongitude = searchParams.has('lng') ? Number(searchParams.get('lng')) : null;
  const hasQueryLocation = isValidCoordinate(queryLatitude, queryLongitude);
  const initialViewport = useMemo(() => {
    if (hasQueryLocation) return { center: [queryLatitude, queryLongitude], zoom: 15 };
    const saved = readSavedViewport();
    if (saved) return saved;
    if (isValidCoordinate(sharedUserPosition?.lat, sharedUserPosition?.lng)) {
      return { center: [sharedUserPosition.lat, sharedUserPosition.lng], zoom: 13 };
    }
    return { center: defaultCenter, zoom: defaultZoom };
  }, []);
  const [mapReady, setMapReady] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [filter, setFilter] = useState('all');
  const [userPosition, setUserPosition] = useState(sharedUserPosition);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [mapStyle, setMapStyleState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('snapmap_map_style');
      if (MAP_STYLES.some((style) => style.id === saved)) return saved;
    }
    return theme === 'light' ? 'street' : 'midnight';
  });
  const [downloadCount, setDownloadCount] = useState(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [distanceDropdownOpen, setDistanceDropdownOpen] = useState(false);
  const [distanceFilterMi, setDistanceFilterMi] = useState(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPromptMi, setLocationPromptMi] = useState(null); // pending mi when user allows
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapSearchError, setMapSearchError] = useState(null);
  const [searchCenter, setSearchCenter] = useState(() => hasQueryLocation ? { lat: queryLatitude, lng: queryLongitude, key: 'shared-location' } : null);
  const [selectedSpotId, setSelectedSpotId] = useState(() => searchParams.get('spot'));
  const [selectedPostId, setSelectedPostId] = useState(() => searchParams.get('post'));
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('snapmap_recent_searches') || '[]'); } catch { return []; }
  });
  const [candidateBounds, setCandidateBounds] = useState(null);
  const [appliedBounds, setAppliedBounds] = useState(null);
  const [activityBySpot, setActivityBySpot] = useState({});
  const [mapPosts, setMapPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchActiveSpotActivity().then((next) => {
      if (!cancelled) setActivityBySpot(next);
    });
    refresh();
    const unsubscribe = subscribeToMapActivity(refresh);
    const interval = window.setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchMapPosts().then((posts) => {
      if (!cancelled) setMapPosts(posts);
    });
    refresh();
    const unsubscribe = subscribeToFeed(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const requestPosition = useCallback(async (force = false) => {
    if (userPosition && !force) return userPosition;
    setPositionLoading(true);
    const pos = requestSharedPosition ? await requestSharedPosition() : await getCurrentPosition();
    setPositionLoading(false);
    if (pos) setUserPosition(pos);
    return pos;
  }, [userPosition, requestSharedPosition]);

  useEffect(() => {
    if (sharedUserPosition) setUserPosition(sharedUserPosition);
  }, [sharedUserPosition]);

  const setDistanceFilter = useCallback((mi) => {
    if (mi === null) {
      setDistanceFilterMi(null);
      return;
    }
    if (!userPosition) {
      setLocationPromptMi(mi);
      setShowLocationPrompt(true);
      return;
    }
    setDistanceFilterMi(mi);
  }, [userPosition]);

  const onLocationPromptAllow = useCallback(async () => {
    const mi = locationPromptMi;
    setShowLocationPrompt(false);
    setLocationPromptMi(null);
    setPositionLoading(true);
    const pos = await requestPosition();
    setPositionLoading(false);
    if (pos) {
      setUserPosition(pos);
      if (mi != null) setDistanceFilterMi(mi);
    }
  }, [locationPromptMi, requestPosition]);

  const onLocationPromptDismiss = useCallback(() => {
    setShowLocationPrompt(false);
    setLocationPromptMi(null);
  }, []);

  const validSpots = useMemo(() => allSpots.filter((spot) => isValidCoordinate(spot.latitude, spot.longitude)), [allSpots]);
  const byFilter = useMemo(() => applyFilter(validSpots, filter), [validSpots, filter]);
  const filteredSpots = useMemo(
    () => applyDistanceFilter(byFilter, userPosition, distanceFilterMi),
    [byFilter, userPosition, distanceFilterMi]
  );
  const displayedSpots = useMemo(() => {
    if (!appliedBounds) return filteredSpots;
    return filteredSpots.filter((spot) => (
      spot.latitude >= appliedBounds.south && spot.latitude <= appliedBounds.north
      && spot.longitude >= appliedBounds.west && spot.longitude <= appliedBounds.east
    ));
  }, [filteredSpots, appliedBounds]);
  const selectedSpot = useMemo(
    () => displayedSpots.find((spot) => String(spot.id) === String(selectedSpotId)) || null,
    [displayedSpots, selectedSpotId]
  );
  const recentPostBySpot = useMemo(() => mapPosts.reduce((grouped, post) => {
    if (post.spotId && !grouped[post.spotId]) grouped[post.spotId] = post;
    return grouped;
  }, {}), [mapPosts]);
  const standalonePosts = useMemo(() => mapPosts.filter((post) => !post.spotId && post.imageUrl && isValidCoordinate(post.latitude, post.longitude)), [mapPosts]);
  const selectedPost = useMemo(() => mapPosts.find((post) => String(post.id) === String(selectedPostId)) || null, [mapPosts, selectedPostId]);

  const saveViewport = useCallback((viewport) => {
    if (!isValidCoordinate(viewport.lat, viewport.lng)) return;
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
  }, []);

  const onMapClick = useCallback(({ lat, lng }) => {
    setSelectedPostId(null);
    setSelectedSpotId(null);
    setPendingPin({ lat, lng });
  }, []);

  const goToAddSpot = useCallback(() => {
    if (!pendingPin) return;
    navigate('/add', { state: { lat: pendingPin.lat, lng: pendingPin.lng } });
    setPendingPin(null);
  }, [navigate, pendingPin]);

  const handleMapSearch = useCallback(async (e) => {
    e?.preventDefault();
    const q = mapSearchQuery.trim();
    if (!q) return;
    setMapSearchError(null);
    setMapSearchLoading(true);
    try {
      const result = await geocodeAddress(q);
      if (result) {
        setSearchCenter({ lat: result.lat, lng: result.lng, key: Date.now() });
        setAppliedBounds(null);
        setCandidateBounds(null);
        const next = [q, ...recentSearches.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 5);
        setRecentSearches(next);
        localStorage.setItem('snapmap_recent_searches', JSON.stringify(next));
        setSearchFocused(false);
      } else {
        setMapSearchError('Address not found. Try a different search.');
      }
    } catch {
      setMapSearchError('Search failed. Try again.');
    } finally {
      setMapSearchLoading(false);
    }
  }, [mapSearchQuery, recentSearches]);

  const handleLocateMe = useCallback(async () => {
    setMapSearchError(null);
    setPositionLoading(true);
    const pos = await requestPosition(true);
    setPositionLoading(false);
    if (!pos) {
      setMapSearchError('Location unavailable. Check location permission and try again.');
      return;
    }
    setUserPosition(pos);
    setAppliedBounds(null);
    setCandidateBounds(null);
    setSearchCenter({ lat: pos.lat, lng: pos.lng, key: Date.now() });
  }, [requestPosition]);

  const filterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? 'All';
  const distanceLabel = distanceFilterMi == null ? 'All' : `Within ${distanceFilterMi} mi`;
  const activeMapStyle = MAP_STYLES.find((style) => style.id === mapStyle) || MAP_STYLES[0];

  const setMapStyle = useCallback((styleId) => {
    if (!MAP_STYLES.some((style) => style.id === styleId)) return;
    setMapStyleState(styleId);
    if (typeof localStorage !== 'undefined') localStorage.setItem('snapmap_map_style', styleId);
    setStylePickerOpen(false);
  }, []);

  useEffect(() => {
    fetchDownloadCount().then(setDownloadCount);
  }, []);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const handleBack = (e) => {
      goBack();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    };
    document.addEventListener('backbutton', handleBack);
    return () => document.removeEventListener('backbutton', handleBack);
  }, [goBack]);

  // Defer MapContainer mount to avoid react-leaflet hook-order issues (#310)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mapReady) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-page text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent-500" />
        <span className="text-xs font-bold uppercase tracking-[0.18em]">Loading map</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-10 flex min-h-0 flex-col bg-page">
      {/* Location permission prompt */}
      {showLocationPrompt && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog" aria-labelledby="map-location-prompt-title">
          <div className="surface-card w-full max-w-sm rounded-[1.75rem] p-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-accent-500/20 p-3">
                <MapPin className="h-8 w-8 text-accent-400" />
              </div>
            </div>
            <h2 id="map-location-prompt-title" className="mt-4 text-center text-lg font-semibold text-primary">
              Use your location?
            </h2>
            <p className="mt-2 text-center text-sm text-slate-400">
              SnapMap uses your location to show spots near you on the map. Your device will ask for permission.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onLocationPromptDismiss}
                className="flex-1 rounded-2xl border border-white/10 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onLocationPromptAllow}
                className="primary-button flex-1 py-3 text-sm"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredSpots.length === 0 && (
        <div className="absolute inset-0 z-[999] flex flex-col items-center justify-center gap-4 bg-[var(--bg-page)] px-6 backdrop-blur-sm">
          <p className="text-center text-sm font-medium text-slate-300">
            No spots yet. Add your first spot to see it on the map.
          </p>
          <button
            type="button"
            onClick={() => navigate('/add')}
            className="primary-button px-5 py-3 text-sm"
          >
            <MapPin className="h-4 w-4" />
            Add a spot
          </button>
        </div>
      )}
      <div className={`map-style-${mapStyle} relative min-h-[200px] flex-1 overflow-hidden`}>
      <MapContainer
        center={initialViewport.center}
        zoom={initialViewport.zoom}
        className="h-full w-full"
        style={{ height: '100%', minHeight: 200 }}
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          key={activeMapStyle.id}
          attribution={activeMapStyle.attribution}
          url={activeMapStyle.url}
          maxZoom={19}
          zIndex={1}
        />
        {activeMapStyle.labelUrl && (
          <TileLayer
            key={`${activeMapStyle.id}-labels`}
            url={activeMapStyle.labelUrl}
            maxZoom={19}
            zIndex={2}
          />
        )}
        {searchCenter && <FlyToCenter center={searchCenter} />}
        <MapClickHandler onMapClick={onMapClick} />
        <ViewportTracker onViewportChange={saveViewport} onUserViewportChange={setCandidateBounds} />

        {userPosition && (
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={10}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.8,
              weight: 2,
              opacity: 1,
            }}
            zIndexOffset={500}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}
        {pendingPin && (
          <Marker
            position={[pendingPin.lat, pendingPin.lng]}
            icon={icon}
            zIndexOffset={1000}
          />
        )}
        <SpotMarkersCluster
          spots={displayedSpots}
          icon={icon}
          activityBySpot={activityBySpot}
          recentPostBySpot={recentPostBySpot}
          setSelectedSpotId={(spotId) => { setSelectedPostId(null); setPendingPin(null); setSelectedSpotId(spotId); }}
        />
        {standalonePosts.map((post) => (
          <Marker
            key={`post-${post.id}`}
            position={[post.latitude, post.longitude]}
            icon={liveSpotIcon(null, post)}
            zIndexOffset={700}
            eventHandlers={{ click: () => { setSelectedSpotId(null); setPendingPin(null); setSelectedPostId(post.id); } }}
          />
        ))}
      </MapContainer>
      <div className="map-vignette absolute inset-0 z-[500] pointer-events-none" aria-hidden="true" />

      <div className="surface-card absolute bottom-[7.1rem] left-3 right-3 z-[1000] flex items-center justify-between gap-3 rounded-[1.25rem] px-3.5 py-3 text-xs text-secondary sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
        <span className="font-semibold">Tap anywhere to pin a new spot</span>
        <Link to="/explore" className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[var(--accent-muted)] px-3 py-2 font-extrabold text-accent-400 transition hover:bg-accent-500 hover:text-[#211603]">
          <Compass className="h-3.5 w-3.5" />
          Browse spots
        </Link>
      </div>
      {candidateBounds && (
        <button
          type="button"
          onClick={() => { setAppliedBounds(candidateBounds); setCandidateBounds(null); setSelectedSpotId(null); }}
          className="primary-button absolute left-1/2 top-[7.55rem] z-[1003] -translate-x-1/2 whitespace-nowrap px-4 py-2.5 text-xs shadow-xl"
        >
          <Search className="h-3.5 w-3.5" />
          Search this area
        </button>
      )}
      {appliedBounds && !candidateBounds && (
        <button type="button" onClick={() => setAppliedBounds(null)} className="surface-card absolute left-1/2 top-[7.55rem] z-[1003] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-bold text-accent-400">
          Show all spots
        </button>
      )}
      {selectedSpot && !pendingPin && (
        <div className="surface-card absolute bottom-[11.1rem] left-3 right-3 z-[1004] overflow-hidden rounded-[1.5rem] p-2.5 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
          <div className="flex gap-3">
            <Link to={`/spot/${selectedSpot.id}`} className="h-24 w-28 shrink-0 overflow-hidden rounded-[1.1rem] bg-black/20">
              <img src={getSpotPrimaryImage(selectedSpot)} alt="" className="h-full w-full object-cover" />
            </Link>
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-start gap-2">
                <Link to={`/spot/${selectedSpot.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-primary">{selectedSpot.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{selectedSpot.address || 'Pinned photography spot'}</p>
                </Link>
                <button type="button" onClick={() => setSelectedSpotId(null)} className="rounded-lg p-1 text-slate-500 hover:bg-white/5" aria-label="Close spot preview"><X className="h-4 w-4" /></button>
              </div>
              {selectedSpot.bestTime && <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-accent-400"><Clock3 className="h-3.5 w-3.5" />{selectedSpot.bestTime}</p>}
              {activityBySpot[selectedSpot.id] && (
                <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-extrabold ${['restricted', 'closed', 'unsafe'].includes(activityBySpot[selectedSpot.id].condition) ? 'text-rose-400' : 'text-emerald-400'}`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  {activityBySpot[selectedSpot.id].condition
                    ? `${SPOT_CONDITIONS.find((item) => item.id === activityBySpot[selectedSpot.id].condition)?.label || 'Live update'} · `
                    : ''}
                  {activityBySpot[selectedSpot.id].checkIns > 0
                    ? `${activityBySpot[selectedSpot.id].checkIns} here now`
                    : 'Updated recently'}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => toggleFavorite?.(selectedSpot.id)} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${favoriteIds.includes(selectedSpot.id) ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.06] text-slate-300'}`}>
                  <Heart className="h-3.5 w-3.5" fill={favoriteIds.includes(selectedSpot.id) ? 'currentColor' : 'none'} />
                  {favoriteIds.includes(selectedSpot.id) ? 'Saved' : 'Save'}
                </button>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.latitude},${selectedSpot.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-slate-300">
                  <Navigation className="h-3.5 w-3.5" /> Directions
                </a>
                {recentPostBySpot[selectedSpot.id] && (
                  <Link to={`/explore?post=${recentPostBySpot[selectedSpot.id].id}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-2.5 py-1.5 text-[11px] font-bold text-accent-400">
                    <Camera className="h-3.5 w-3.5" /> Post
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedPost && !selectedSpot && !pendingPin && (
        <div className="surface-card absolute bottom-[11.1rem] left-3 right-3 z-[1004] overflow-hidden rounded-[1.5rem] p-2.5 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
          <div className="flex gap-3">
            <Link to={`/explore?post=${selectedPost.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.1rem] bg-black/20">
              <img src={selectedPost.imageUrl} alt="" className="h-full w-full object-cover" />
            </Link>
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-start gap-2">
                <Link to={`/explore?post=${selectedPost.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-primary">{selectedPost.locationName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">Photo by {selectedPost.author?.display_name || selectedPost.author?.username || 'a creator'}</p>
                </Link>
                <button type="button" onClick={() => setSelectedPostId(null)} className="rounded-lg p-1 text-slate-500 hover:bg-white/5" aria-label="Close post preview"><X className="h-4 w-4" /></button>
              </div>
              {selectedPost.locationPrecision === 'approximate' && <p className="mt-2 text-[11px] font-bold text-amber-400">Approximate location</p>}
              <div className="mt-3 flex gap-2">
                <Link to={`/explore?post=${selectedPost.id}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500 px-3 py-2 text-[11px] font-extrabold text-[#211603]"><Camera className="h-3.5 w-3.5" />Open post</Link>
                {selectedPost.spotId && <Link to={`/spot/${selectedPost.spotId}`} className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] font-bold text-slate-300"><MapPin className="h-3.5 w-3.5" />Spot details</Link>}
              </div>
            </div>
          </div>
        </div>
      )}
      {pendingPin && (
        <div className="surface-card absolute left-3 right-3 z-[1000] rounded-[1.5rem] p-5 sm:left-auto sm:right-3 sm:max-w-sm" style={{ bottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}>
          <p className="text-sm font-medium text-primary">Save spot here</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPendingPin(null)}
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={goToAddSpot}
              className="primary-button flex-1 px-3 py-2.5 text-sm"
            >
              <MapPin className="h-4 w-4" />
              Add spot
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Settings in corner */}
      {setTheme && (
        <div className="absolute right-3 top-3 z-[1001]">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="icon-button h-11 w-11 rounded-2xl"
            aria-label="Settings"
            aria-expanded={settingsOpen}
          >
            <Settings className="h-5 w-5" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} aria-hidden />
              <div className="surface-card absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl py-2">
                {downloadCount != null && (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400" aria-hidden>
                    <Download className="h-4 w-4 shrink-0" />
                    {downloadCount.toLocaleString()}+ downloads
                  </div>
                )}
                {onRefreshSpots && (
                  <button
                    type="button"
                    onClick={() => { onRefreshSpots(); setSettingsOpen(false); }}
                    disabled={spotsLoading}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-accent-400 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${spotsLoading ? 'animate-spin' : ''}`} />
                    Refresh spots
                  </button>
                )}
                {setUnits && (
                  <button
                    type="button"
                    onClick={() => { setUnits(units === 'mi' ? 'km' : 'mi'); setSettingsOpen(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-accent-400"
                  >
                    <MapPin className="h-4 w-4" />
                    Distance: {units === 'mi' ? 'Miles' : 'km'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setSettingsOpen(false); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-accent-400"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <a
                  href="#/saved"
                  onClick={() => setSettingsOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-accent-400"
                >
                  <Heart className="h-4 w-4" />
                  Saved
                </a>
                <a
                  href="#/settings"
                  onClick={() => setSettingsOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-accent-400"
                >
                  <Settings className="h-4 w-4" />
                  All settings
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleLocateMe}
        disabled={positionLoading}
        className="icon-button absolute bottom-[11.35rem] right-3 z-[1002] h-12 w-12 rounded-2xl text-primary transition hover:border-accent-500/40 hover:text-accent-400 disabled:opacity-60"
        aria-label="Center map on my location"
        title="My location"
      >
        <LocateFixed className={`h-5 w-5 ${positionLoading ? 'animate-pulse text-accent-400' : ''}`} strokeWidth={2.4} />
      </button>

      {/* App-native map style control */}
      <div className="absolute right-3 top-[4.25rem] z-[1002]">
        <button
          type="button"
          onClick={() => { setStylePickerOpen((open) => !open); setSettingsOpen(false); }}
          className={`icon-button h-11 w-11 rounded-2xl ${stylePickerOpen ? 'border-accent-500/40 text-accent-400' : ''}`}
          aria-label="Choose map style"
          aria-expanded={stylePickerOpen}
        >
          <LayersIcon className="h-5 w-5" />
        </button>
        {stylePickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStylePickerOpen(false)} aria-hidden />
            <div className="surface-card absolute right-0 top-full z-50 mt-2 w-64 rounded-[1.4rem] p-2.5">
              <div className="px-2 pb-2 pt-1">
                <p className="eyebrow">Map appearance</p>
                <p className="mt-1 text-xs font-medium text-muted">Choose the view that fits the shoot.</p>
              </div>
              <div className="space-y-1">
                {MAP_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setMapStyle(style.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                      mapStyle === style.id ? 'bg-accent-500/12' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="h-10 w-10 shrink-0 rounded-xl border border-white/10 shadow-inner" style={{ background: style.preview }} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-extrabold ${mapStyle === style.id ? 'text-accent-400' : 'text-primary'}`}>{style.label}</span>
                      <span className="block text-[11px] font-medium text-muted">{style.description}</span>
                    </span>
                    {mapStyle === style.id && <Check className="h-4 w-4 shrink-0 text-accent-400" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Brand + location search */}
      <div className="absolute left-3 right-16 top-3 z-[1000] flex flex-wrap items-center gap-2">
        <div className="surface-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl p-2" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}snapmap-icon.svg`} alt="" className="h-full w-full object-contain" />
        </div>
        <form onSubmit={handleMapSearch} className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={mapSearchQuery}
              onChange={(e) => { setMapSearchQuery(e.target.value); setMapSearchError(null); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Search address or place…"
              className="surface-input h-11 w-full rounded-2xl bg-[var(--bg-nav)] pl-10 pr-3 text-sm font-semibold backdrop-blur-xl placeholder:text-[var(--text-muted)]"
            />
            {searchFocused && recentSearches.length > 0 && !mapSearchQuery && (
              <div className="surface-card absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl py-2">
                <p className="px-4 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Recent searches</p>
                {recentSearches.map((item) => (
                  <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setMapSearchQuery(item)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-secondary hover:bg-white/5">
                    <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{item}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={mapSearchLoading || !mapSearchQuery.trim()}
            className="primary-button h-11 shrink-0 px-4 text-sm disabled:opacity-50"
          >
            {mapSearchLoading ? '…' : 'Go'}
          </button>
        </form>
        {mapSearchError && (
          <p className="w-full text-xs text-amber-400 mt-0.5">{mapSearchError}</p>
        )}
      </div>

      {/* Filter + Distance dropdowns */}
      <div className="absolute left-3 top-[4.25rem] right-16 z-[1000] flex gap-2 sm:max-w-md">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => { setFilterDropdownOpen((o) => !o); setDistanceDropdownOpen(false); }}
            className="surface-card flex w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-secondary"
          >
            <span className="truncate">Filter: {filterLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${filterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(false)} aria-hidden />
              <div className="surface-card absolute left-0 top-full z-50 mt-2 max-h-56 w-full overflow-auto rounded-2xl py-2">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setFilter(opt.id); setFilterDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                      filter === opt.id ? 'bg-accent-500/20 text-accent-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                    {filter === opt.id && <span className="text-accent-400">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => { setDistanceDropdownOpen((o) => !o); setFilterDropdownOpen(false); }}
            className="surface-card flex w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-secondary"
          >
            <span className="truncate">Distance: {distanceLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${distanceDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {distanceDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDistanceDropdownOpen(false)} aria-hidden />
              <div className="surface-card absolute left-0 top-full z-50 mt-2 max-h-56 w-full overflow-auto rounded-2xl py-2">
                <button
                  type="button"
                  onClick={() => { setDistanceFilterMi(null); setDistanceDropdownOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                    distanceFilterMi === null ? 'bg-accent-500/20 text-accent-400' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  All
                  {distanceFilterMi === null && <span className="text-accent-400">✓</span>}
                </button>
                {DISTANCE_OPTIONS_MI.map((mi) => (
                  <button
                    key={mi}
                    type="button"
                    onClick={() => { setDistanceFilter(mi); setDistanceDropdownOpen(false); }}
                    disabled={positionLoading}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                      distanceFilterMi === mi ? 'bg-accent-500/20 text-accent-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Within {mi} mi
                    {distanceFilterMi === mi && <span className="text-accent-400">✓</span>}
                  </button>
                ))}
                {!userPosition && (distanceFilterMi != null || positionLoading) && (
                  <p className="px-4 py-2 text-xs text-slate-500">Allow location for distance</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
