import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
if (typeof window !== 'undefined') window.L = L;
import 'leaflet.markercluster';
import { MapPin } from 'lucide-react';
import { CATEGORIES, matchesCategory } from '../utils/categories';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const defaultCenter = [37.8021, -122.4488];
const defaultZoom = 6;

const NAV_HEIGHT_PX = 64;

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

export default function Map({ allSpots }) {
  const navigate = useNavigate();
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [filter, setFilter] = useState('all');

  const filteredSpots = useMemo(() => applyFilter(allSpots, filter), [allSpots, filter]);

  const onMapClick = useCallback(({ lat, lng }) => {
    setPendingPin({ lat, lng });
    setSelectedSpotId(null);
  }, []);

  const goToAddSpot = useCallback(() => {
    if (!pendingPin) return;
    navigate('/add', { state: { lat: pendingPin.lat, lng: pendingPin.lng } });
    setPendingPin(null);
  }, [navigate, pendingPin]);

  return (
    <div
      className="absolute inset-0 w-full min-h-[300px]"
      style={{ bottom: NAV_HEIGHT_PX, minHeight: 300 }}
    >
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
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full min-h-[300px]"
        style={{ height: '100%', minHeight: 300 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds spots={filteredSpots} />
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

      {/* Single filter row */}
      <div className="absolute left-3 right-3 top-3 z-[1000] flex gap-2 overflow-x-auto rounded-xl bg-black/70 p-2 backdrop-blur scrollbar-none">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === opt.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-14 left-3 z-[1000] rounded-lg bg-black/70 px-3 py-2 text-xs text-slate-300 backdrop-blur sm:left-3">
        Tap map to pin · Save spot here
      </div>
      {pendingPin && (
        <div className="absolute bottom-14 left-3 right-3 z-[1000] rounded-xl border border-white/10 bg-[#18181b] p-4 shadow-xl sm:left-auto sm:right-3 sm:max-w-sm">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <MapPin className="h-4 w-4" />
              Add spot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
