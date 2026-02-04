import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

// Fix default marker icon in Vite (paths break otherwise)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const defaultCenter = [37.8021, -122.4488];

function FitBounds({ spots }) {
  const map = useMap();
  useEffect(() => {
    if (!spots?.length) return;
    const bounds = L.latLngBounds(spots.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, spots]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function Map({ allSpots }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="relative w-full flex-1"
      style={{ height: 'calc(100vh - 56px)' }}
    >
      {!mounted ? (
        <div className="flex h-full items-center justify-center bg-slate-800 text-slate-400">
          Loading map…
        </div>
      ) : (
        <MapContainer
          center={defaultCenter}
          zoom={6}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <MapResizeFix />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds spots={allSpots} />
          {allSpots.map((spot) => (
            <Marker key={spot.id} position={[spot.latitude, spot.longitude]}>
              <Popup>
                <Link
                  to={`/spot/${spot.id}`}
                  className="font-semibold text-emerald-500 hover:underline"
                >
                  {spot.name}
                </Link>
                <br />
                <small className="text-slate-500">{spot.bestTime}</small>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
