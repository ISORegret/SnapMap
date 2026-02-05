import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

const defaultCenter = { lat: 37.8021, lng: -122.4488 };
const defaultZoom = 6;

const mapContainerStyle = {
  width: '100%',
  height: '100%',
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

export default function Map({ allSpots }) {
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [map, setMap] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: 'snapmap-google-map',
  });

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#1a1a24] px-4 text-center text-slate-400">
        <p className="font-medium">Failed to load Google Maps.</p>
        <p className="text-sm">Check your connection and API key.</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#1a1a24] px-4 text-center text-slate-400">
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
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#1a1a24] text-slate-400">
        <span className="animate-pulse">Loading map…</span>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[60vh] w-full flex-1">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={defaultZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
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
    </div>
  );
}
