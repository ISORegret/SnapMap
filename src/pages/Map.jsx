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

// Modern dark map tiles (CartoDB Voyager = light; Stadia Alidade Smooth Dark = dark)
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
    }, 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function Map({ allSpots }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative h-full min-h-0 w-full flex-1">
      {!mounted ? (
        <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#1a1a24] text-slate-400">
          <span className="animate-pulse">Loading map…</span>
        </div>
      ) : (
        <MapContainer
          center={defaultCenter}
          zoom={6}
          className="h-full w-full rounded-none"
          style={{ height: '100%', width: '100%', minHeight: '100%' }}
          scrollWheelZoom
          preferCanvas
        >
          <MapResizeFix />
          <TileLayer
            attribution={TILE_ATTRIBUTION}
            url={TILE_URL}
          />
          <FitBounds spots={allSpots} />
          {allSpots.map((spot) => (
            <Marker key={spot.id} position={[spot.latitude, spot.longitude]}>
              <Popup className="snapmap-popup">
                <Link
                  to={`/spot/${spot.id}`}
                  className="font-semibold text-emerald-400 hover:underline"
                >
                  {spot.name}
                </Link>
                <br />
                <small className="text-slate-400">{spot.bestTime}</small>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
