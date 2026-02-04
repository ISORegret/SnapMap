import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight } from 'lucide-react';

const defaultImage = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

export default function Feed({ allSpots, favoriteIds, toggleFavorite }) {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6">
      <header className="border-b border-white/[0.06] bg-[#0c0c0f] px-4 py-5">
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
              className="group flex gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#18181b] transition hover:border-emerald-500/20 hover:bg-[#27272a]"
            >
              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                <img
                  src={spot.imageUri || defaultImage}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(spot.id);
                  }}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                  aria-label={favoriteIds.includes(spot.id) ? 'Unsave' : 'Save'}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={favoriteIds.includes(spot.id) ? '#f43f5e' : 'transparent'}
                    stroke={favoriteIds.includes(spot.id) ? '#f43f5e' : 'currentColor'}
                    strokeWidth={2}
                  />
                </button>
              </div>
              <div className="min-w-0 flex-1 py-3 pr-2">
                <h2 className="font-medium text-white truncate group-hover:text-emerald-400">
                  {spot.name}
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {spot.address || `${spot.latitude?.toFixed(2)}, ${spot.longitude?.toFixed(2)}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {spot.bestTime}
                  {spot.score != null && spot.score > 0 && ` · ${spot.score}`}
                </p>
              </div>
              <div className="flex items-center pr-3 text-slate-500 group-hover:text-emerald-400">
                <ChevronRight className="h-5 w-5" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
