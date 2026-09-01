import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap, useMapEvents, LayersControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
if (typeof window !== 'undefined') window.L = L;
import 'leaflet.markercluster';
import { MapPin, Settings, Sun, Moon, Heart, Search, ChevronDown, Download, ArrowLeft, Compass, RefreshCw } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { haversineKm, getCurrentPosition, DISTANCE_OPTIONS_MI, milesToKm } from '../utils/geo';
import { fetchDownloadCount } from '../utils/stats';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const defaultCenter = [37.8021, -122.4488];
const defaultZoom = 6;

const icon = L.divIcon({
  className: 'snapmap-marker-wrap',
  html: '<span class="snapmap-marker"><span></span></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 38],
  popupAnchor: [0, -34],
});

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

function FitBounds({ spots }) {
  const map = useMap();
  React.useEffect(() => {
    if (!spots?.length) return;
    const bounds = L.latLngBounds(spots.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, spots]);
  return null;
}

function FlyToCenter({ center, zoom = 14 }) {
  const map = useMap();
  React.useEffect(() => {
    if (center?.lat == null || center?.lng == null) return;
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.8 });
  }, [map, center?.lat, center?.lng, zoom]);
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

function SpotMarkersCluster({ spots, icon, setSelectedSpotId }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    if (!map || typeof L.MarkerClusterGroup !== 'function') return;
    const group = new L.MarkerClusterGroup({ showCoverageOnHover: false, zoomToBoundsOnClick: true });
    groupRef.current = group;

    const container = map.getContainer();
    const handlePopupLinkClick = (e) => {
      const a = e.target?.closest?.('a[data-spot-id]');
      if (a) {
        e.preventDefault();
        const id = a.getAttribute('data-spot-id');
        if (id) window.location.hash = `#/spot/${id}`;
      }
    };
    container.addEventListener('click', handlePopupLinkClick);

    spots.forEach((spot) => {
      const marker = L.marker([spot.latitude, spot.longitude], { icon })
        .bindPopup(
          `<div class="min-w-[140px] text-slate-200">
            <a href="#/spot/${escapeHtml(spot.id)}" data-spot-id="${escapeHtml(spot.id)}" class="font-semibold text-accent-400 hover:underline">${escapeHtml(spot.name)}</a>
            <br><small class="text-slate-400">${escapeHtml(spot.bestTime || '—')}</small>
          </div>`,
          { className: 'snapmap-popup' }
        );
      marker.on('popupopen', () => setSelectedSpotId(spot.id));
      marker.on('popupclose', () => setSelectedSpotId(null));
      group.addLayer(marker);
    });

    map.addLayer(group);
    return () => {
      container.removeEventListener('click', handlePopupLinkClick);
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map, spots, icon, setSelectedSpotId]);

  return null;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
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

export default function Map({ allSpots, theme = 'dark', setTheme, units = 'mi', setUnits, onRefreshSpots, spotsLoading = false }) {
  const navigate = useNavigate();
  const [mapReady, setMapReady] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [filter, setFilter] = useState('all');
  const [userPosition, setUserPosition] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [searchCenter, setSearchCenter] = useState(null); // { lat, lng } to fly map to

  const requestPosition = useCallback(async () => {
    if (userPosition) return userPosition;
    setPositionLoading(true);
    const pos = await getCurrentPosition();
    setPositionLoading(false);
    if (pos) setUserPosition(pos);
    return pos;
  }, [userPosition]);

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
    const pos = await getCurrentPosition();
    setPositionLoading(false);
    if (pos) {
      setUserPosition(pos);
      if (mi != null) setDistanceFilterMi(mi);
    }
  }, [locationPromptMi]);

  const onLocationPromptDismiss = useCallback(() => {
    setShowLocationPrompt(false);
    setLocationPromptMi(null);
  }, []);

  const byFilter = useMemo(() => applyFilter(allSpots, filter), [allSpots, filter]);
  const filteredSpots = useMemo(
    () => applyDistanceFilter(byFilter, userPosition, distanceFilterMi),
    [byFilter, userPosition, distanceFilterMi]
  );

  const onMapClick = useCallback(({ lat, lng }) => {
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
        setSearchCenter({ lat: result.lat, lng: result.lng });
      } else {
        setMapSearchError('Address not found. Try a different search.');
      }
    } catch {
      setMapSearchError('Search failed. Try again.');
    } finally {
      setMapSearchLoading(false);
    }
  }, [mapSearchQuery]);

  const filterLabel = FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? 'All';
  const distanceLabel = distanceFilterMi == null ? 'All' : `Within ${distanceFilterMi} mi`;

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
            <h2 id="map-location-prompt-title" className="mt-4 text-center text-lg font-semibold text-white">
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
      <div className="flex-1 min-h-[200px] relative overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        style={{ height: '100%', minHeight: 200 }}
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <FitBounds spots={filteredSpots} />
        {searchCenter && <FlyToCenter center={searchCenter} />}
        <MapClickHandler onMapClick={onMapClick} />

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
          spots={filteredSpots}
          icon={icon}
          setSelectedSpotId={() => {}}
        />
      </MapContainer>

      <div className="surface-card absolute bottom-[7.1rem] left-3 right-3 z-[1000] flex items-center justify-between gap-3 rounded-[1.25rem] px-3.5 py-3 text-xs text-secondary sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
        <span className="font-semibold">Tap anywhere to pin a new spot</span>
        <Link to="/explore" className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[var(--accent-muted)] px-3 py-2 font-extrabold text-accent-400 transition hover:bg-accent-500 hover:text-[#211603]">
          <Compass className="h-3.5 w-3.5" />
          Browse spots
        </Link>
      </div>
      {pendingPin && (
        <div className="surface-card absolute left-3 right-3 z-[1000] rounded-[1.5rem] p-5 sm:left-auto sm:right-3 sm:max-w-sm" style={{ bottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}>
          <p className="text-sm font-medium text-white">Save spot here</p>
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
              </div>
            </>
          )}
        </div>
      )}

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
              onKeyDown={(e) => e.key === 'Enter' && handleMapSearch()}
              placeholder="Search address or place…"
              className="surface-input h-11 w-full rounded-2xl bg-[var(--bg-nav)] pl-10 pr-3 text-sm font-semibold backdrop-blur-xl placeholder:text-[var(--text-muted)]"
            />
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
