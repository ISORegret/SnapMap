import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';

const defaultCenter = { lat: 37.8021, lng: -122.4488 };
const defaultZoom = 6;

// Full-screen map: fill space above bottom nav (nav ~64px)
const NAV_HEIGHT_PX = 64;
const mapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: 300,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1a1a24' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a24' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27272a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  ],
};

function MapTroubleshoot() {
  const [show, setShow] = useState(false);
  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-black/70 p-2 text-xs text-slate-400 backdrop-blur sm:left-auto sm:right-3 sm:max-w-[280px]">
      <button type="button" onClick={() => setShow((s) => !s)} className="text-emerald-400 hover:underline">
        {show ? 'Hide troubleshooting' : 'Map not loading? Click here'}
      </button>
      {show && (
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-500">
          <li>Enable <strong className="text-slate-400">Maps JavaScript API</strong> in Google Cloud</li>
          <li>Enable <strong className="text-slate-400">billing</strong> for the project</li>
          <li>If key has referrer restrictions, add <code className="rounded bg-white/10 px-1">http://localhost:5173/*</code></li>
        </ul>
      )}
    </div>
  );
}

export default function Map({ allSpots }) {
  const navigate = useNavigate();
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [map, setMap] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: 'snapmap-google-map',
    version: 'weekly',
    loadingElement: <div style={{ height: `calc(100vh - ${NAV_HEIGHT_PX}px)`, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a24', color: '#9ca3af' }}>Loading map…</div>,
  });

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onMapClick = useCallback((e) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPendingPin({ lat, lng });
    setSelectedSpotId(null);
  }, []);

  const goToAddSpot = useCallback(() => {
    if (!pendingPin) return;
    navigate('/add', { state: { lat: pendingPin.lat, lng: pendingPin.lng } });
    setPendingPin(null);
  }, [navigate, pendingPin]);

  // Fit bounds when spots or map change
  React.useEffect(() => {
    if (!map || !allSpots?.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    allSpots.forEach((spot) => {
      bounds.extend({ lat: spot.latitude, lng: spot.longitude });
    });
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    const listener = map.addListener('idle', () => {
      const z = map.getZoom();
      if (z > 14) map.setZoom(14);
    });
    return () => window.google.maps.event.removeListener(listener);
  }, [map, allSpots]);

  if (loadError) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1a1a24] px-4 py-8 text-center text-slate-400"
        style={{ bottom: NAV_HEIGHT_PX }}
      >
        <p className="font-medium">Google Maps failed to load</p>
        <p className="text-sm text-slate-500">{loadError.message || 'Check the browser console (F12) for details.'}</p>
        <div className="mt-2 max-w-md rounded-xl border border-white/10 bg-black/20 p-4 text-left text-xs text-slate-500">
          <p className="mb-2 font-medium text-slate-400">Checklist:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Enable <strong>Maps JavaScript API</strong> in{' '}
              <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Google Cloud Console</a>
            </li>
            <li>Enable <strong>billing</strong> for your project (required for Maps)</li>
            <li>If the key has referrer restrictions, add <code className="rounded bg-white/10 px-1">http://localhost:5173/*</code> and <code className="rounded bg-white/10 px-1">http://127.0.0.1:5173/*</code></li>
          </ul>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a24] px-4 text-center text-slate-400" style={{ bottom: NAV_HEIGHT_PX }}>
        <p className="font-medium">Google Maps API key required</p>
        <p className="text-sm">
          Create a <code className="rounded bg-white/10 px-1.5 py-0.5 text-emerald-400">.env</code> file with:
        </p>
        <pre className="mt-1 rounded-lg bg-black/30 px-3 py-2 text-left text-xs text-slate-300">
          VITE_GOOGLE_MAPS_API_KEY=your_key_here
        </pre>
        <p className="text-xs text-slate-500">
          Get a key at{' '}
          <a
            href="https://console.cloud.google.com/google/maps-apis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Google Cloud Console
          </a>{' '}
          (Maps JavaScript API).
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a24] text-slate-400" style={{ bottom: NAV_HEIGHT_PX }}>
        <span className="animate-pulse">Loading map…</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 w-full"
      style={{ bottom: NAV_HEIGHT_PX }}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={defaultZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={onMapClick}
        options={mapOptions}
      >
        {pendingPin && <Marker position={pendingPin} zIndex={1000} />}
        {allSpots.map((spot) => (
          <Marker
            key={spot.id}
            position={{ lat: spot.latitude, lng: spot.longitude }}
            onClick={() => setSelectedSpotId(spot.id)}
          >
            {selectedSpotId === spot.id && (
              <InfoWindow onCloseClick={() => setSelectedSpotId(null)}>
                <div className="min-w-[140px] text-zinc-900">
                  <Link
                    to={`/spot/${spot.id}`}
                    className="font-semibold text-emerald-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {spot.name}
                  </Link>
                  <br />
                  <small className="text-zinc-600">{spot.bestTime}</small>
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
      <div className="absolute bottom-14 left-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-xs text-slate-300 backdrop-blur sm:left-3">
        Tap map to pin · Save spot here
      </div>
      {pendingPin && (
        <div className="absolute bottom-14 left-3 right-3 z-20 rounded-xl border border-white/10 bg-[#18181b] p-4 shadow-xl sm:left-auto sm:right-3 sm:max-w-sm">
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
      <MapTroubleshoot />
    </div>
  );
}
