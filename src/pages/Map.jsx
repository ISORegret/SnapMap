import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
if (typeof window !== 'undefined') window.L = L;
import 'leaflet.markercluster';
import { MapPin, Settings, Sun, Moon, Heart, Search, ChevronDown, ChevronRight, Download, ArrowLeft } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';
import { haversineKm, getCurrentPosition, DISTANCE_OPTIONS_MI, milesToKm } from '../utils/geo';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { fetchDownloadCount } from '../utils/stats';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const defaultCenter = [37.8021, -122.4488];
const defaultZoom = 6;

const LIST_PANEL_HEIGHT_PX = 200;

// Fix default marker icon in react-leaflet (webpack/vite)
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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

    spots.forEach((spot) => {
      const marker = L.marker([spot.latitude, spot.longitude], { icon })
        .bindPopup(
          `<div class="min-w-[140px] text-slate-200">
            <a href="#/spot/${spot.id}" class="font-semibold text-emerald-400 hover:underline">${escapeHtml(spot.name)}</a>
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

export default function Map({ allSpots, theme = 'dark', setTheme, units = 'mi', setUnits }) {
  const navigate = useNavigate();
  const [selectedSpotId, setSelectedSpotId] = useState(null);
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
  const [flyToSpot, setFlyToSpot] = useState(null); // { lat, lng } when list item tapped
  const listItemRefs = useRef({});

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
    setSelectedSpotId(null);
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

  const onListSpotTap = useCallback((spot) => {
    setFlyToSpot({ lat: spot.latitude, lng: spot.longitude });
    setSelectedSpotId(spot.id);
  }, []);

  useEffect(() => {
    if (selectedSpotId && listItemRefs.current[selectedSpotId]) {
      listItemRefs.current[selectedSpotId].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedSpotId]);

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

  return (
    <div className="absolute inset-0 w-full flex flex-col">
      {/* Location permission prompt */}
      {showLocationPrompt && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog" aria-labelledby="map-location-prompt-title">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#151a18] p-5 shadow-xl">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <MapPin className="h-8 w-8 text-emerald-400" />
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
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onLocationPromptAllow}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredSpots.length === 0 && (
        <div className="absolute inset-0 z-[999] flex flex-col items-center justify-center gap-4 bg-[#0c0f0e]/90 px-6 backdrop-blur-sm">
          <p className="text-center text-sm font-medium text-slate-300">
            No spots yet. Add your first spot to see it on the map.
          </p>
          <button
            type="button"
            onClick={() => navigate('/add')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-600"
          >
            <MapPin className="h-4 w-4" />
            Add a spot
          </button>
        </div>
      )}
      <div className="flex-1 min-h-[200px] relative" style={{ minHeight: 200 }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        style={{ height: '100%', minHeight: 200 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds spots={filteredSpots} />
        {searchCenter && <FlyToCenter center={searchCenter} />}
        {flyToSpot && <FlyToCenter center={flyToSpot} zoom={15} />}
        <MapClickHandler onMapClick={onMapClick} />

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
          setSelectedSpotId={setSelectedSpotId}
        />
      </MapContainer>

      <div className="absolute bottom-2 left-3 z-[1000] rounded-lg bg-black/70 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        Tap map to pin · Save spot here
      </div>
      {pendingPin && (
        <div className="absolute bottom-2 left-3 right-3 z-[1000] rounded-xl border border-white/10 bg-[#18181b] p-4 shadow-xl sm:left-auto sm:right-3 sm:max-w-sm">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white bg-emerald-600"
            >
              <MapPin className="h-4 w-4" />
              Add spot
            </button>
          </div>
        </div>
      )}
      </div>

      {/* List + map link: spot list panel */}
      <div
        className="shrink-0 border-t border-white/10 bg-[#0c0c0f]/95 backdrop-blur flex flex-col"
        style={{ height: LIST_PANEL_HEIGHT_PX }}
      >
        <p className="shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Spots ({filteredSpots.length})
        </p>
        <div className="flex-1 overflow-auto overscroll-contain">
          {filteredSpots.length === 0 ? (
            <p className="px-4 py-2 text-sm text-slate-500">No spots match. Adjust filters or add a spot.</p>
          ) : (
            <ul className="space-y-1 px-2 pb-2">
              {filteredSpots.map((spot) => (
                <li key={spot.id}>
                  <button
                    type="button"
                    ref={(el) => { if (el) listItemRefs.current[spot.id] = el; }}
                    onClick={() => onListSpotTap(spot)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      selectedSpotId === spot.id
                        ? 'border-emerald-500 bg-emerald-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                      <img
                        src={getSpotPrimaryImage(spot)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{spot.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {spot.address && spot.address !== 'Not specified'
                          ? spot.address
                          : spot.latitude != null && spot.longitude != null
                            ? `${Number(spot.latitude).toFixed(2)}, ${Number(spot.longitude).toFixed(2)}`
                            : '—'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Settings in corner */}
      {setTheme && (
        <div className="absolute right-3 top-3 z-[1001]">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="rounded-full bg-black/70 p-2 text-slate-400 backdrop-blur transition hover:bg-black/80 hover:text-emerald-400"
            aria-label="Settings"
            aria-expanded={settingsOpen}
          >
            <Settings className="h-5 w-5" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/10 bg-[#151a18] py-2 shadow-xl">
                {downloadCount != null && (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400" aria-hidden>
                    <Download className="h-4 w-4 shrink-0" />
                    {downloadCount.toLocaleString()}+ downloads
                  </div>
                )}
                {setUnits && (
                  <button
                    type="button"
                    onClick={() => { setUnits(units === 'mi' ? 'km' : 'mi'); setSettingsOpen(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-emerald-400"
                  >
                    <MapPin className="h-4 w-4" />
                    Distance: {units === 'mi' ? 'Miles' : 'km'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setSettingsOpen(false); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-emerald-400"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <a
                  href="#/saved"
                  onClick={() => setSettingsOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-emerald-400"
                >
                  <Heart className="h-4 w-4" />
                  Saved
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* Back button + Search address */}
      <div className="absolute left-3 right-14 top-3 z-[1000] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="shrink-0 rounded-xl border border-white/10 bg-black/70 p-2.5 text-slate-300 backdrop-blur transition hover:bg-black/80 hover:text-emerald-400 hover:border-emerald-500/30"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <form onSubmit={handleMapSearch} className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={mapSearchQuery}
              onChange={(e) => { setMapSearchQuery(e.target.value); setMapSearchError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleMapSearch()}
              placeholder="Search address or place…"
              className="w-full rounded-xl border border-white/10 bg-black/70 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 backdrop-blur focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <button
            type="submit"
            disabled={mapSearchLoading || !mapSearchQuery.trim()}
            className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {mapSearchLoading ? '…' : 'Go'}
          </button>
        </form>
        {mapSearchError && (
          <p className="w-full text-xs text-amber-400 mt-0.5">{mapSearchError}</p>
        )}
      </div>

      {/* Filter + Distance dropdowns */}
      <div className="absolute left-3 top-[4.25rem] right-12 z-[1000] flex gap-2">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => { setFilterDropdownOpen((o) => !o); setDistanceDropdownOpen(false); }}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur hover:bg-black/80"
          >
            <span className="truncate">Filter: {filterLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${filterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/10 bg-[#151a18] py-2 shadow-xl">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setFilter(opt.id); setFilterDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                      filter === opt.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                    {filter === opt.id && <span className="text-emerald-400">✓</span>}
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
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur hover:bg-black/80"
          >
            <span className="truncate">Distance: {distanceLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${distanceDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {distanceDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDistanceDropdownOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/10 bg-[#151a18] py-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => { setDistanceFilterMi(null); setDistanceDropdownOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                    distanceFilterMi === null ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  All
                  {distanceFilterMi === null && <span className="text-emerald-400">✓</span>}
                </button>
                {DISTANCE_OPTIONS_MI.map((mi) => (
                  <button
                    key={mi}
                    type="button"
                    onClick={() => { setDistanceFilter(mi); setDistanceDropdownOpen(false); }}
                    disabled={positionLoading}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                      distanceFilterMi === mi ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Within {mi} mi
                    {distanceFilterMi === mi && <span className="text-emerald-400">✓</span>}
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
