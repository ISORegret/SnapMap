import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight } from 'lucide-react';

const defaultImage = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

export default function Feed({ allSpots, favoriteIds, toggleFavorite }) {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-surface-900 pb-6">
      <header className="border-b border-white/5 bg-surface-900 px-4 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          For You
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Photo & car spots — tap to open, heart to save
        </p>
      </header>
      <ul className="space-y-3 px-4 pt-4">
        {allSpots.map((spot) => (
          <li key={spot.id}>
            <Link
              to={`/spot/${spot.id}`}
              className="group flex gap-3 overflow-hidden rounded-2xl border border-white/5 bg-surface-800 transition hover:border-white/10 hover:bg-surface-700"
            >
              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-700">
                <img
                  src={spot.imageUri || defaultImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(spot.id);
                  }}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/80"
                  aria-label={favoriteIds.includes(spot.id) ? 'Unsave' : 'Save'}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={favoriteIds.includes(spot.id) ? '#ef4444' : 'transparent'}
                    stroke={favoriteIds.includes(spot.id) ? '#ef4444' : 'currentColor'}
                    strokeWidth={2}
                  />
                </button>
              </div>
              <div className="min-w-0 flex-1 py-3 pr-2">
                <h2 className="font-medium text-white truncate group-hover:text-accent">
                  {spot.name}
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {spot.address || `${spot.latitude?.toFixed(2)}, ${spot.longitude?.toFixed(2)}`}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {spot.bestTime}
                  {spot.score != null && spot.score > 0 && ` · ${spot.score}`}
                </p>
              </div>
              <div className="flex items-center pr-3 text-slate-500 group-hover:text-accent">
                <ChevronRight className="h-5 w-5" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
