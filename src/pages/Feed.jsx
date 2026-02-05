import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight, Camera } from 'lucide-react';

const defaultImage = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

export default function Feed({ allSpots, favoriteIds, toggleFavorite }) {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6">
      {/* App title + tagline (inspired by LocationScout, PhotoHound, LensScape) */}
      <header className="border-b border-white/[0.06] bg-[#0c0c0f] px-4 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              SnapMap
            </h1>
            <p className="text-sm font-medium text-emerald-400/90">
              The best places for photography and cars
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          Exact geo-positions, best times, and directions. Save spots to your list, open in Maps, and plan less — travel more.
        </p>
      </header>

      {/* Section label */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          For You
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          {allSpots.length} spot{allSpots.length !== 1 ? 's' : ''} — curated + yours
        </p>
      </div>

      {/* Spot cards — image-first, title, description, tags, location */}
      <ul className="space-y-4 px-4 pt-2">
        {allSpots.map((spot) => (
          <li key={spot.id}>
            <Link
              to={`/spot/${spot.id}`}
              className="group block overflow-hidden rounded-2xl border border-white/[0.06] bg-[#18181b] transition hover:border-emerald-500/25 hover:bg-[#1f1f23]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800">
                <img
                  src={spot.imageUri || defaultImage}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(spot.id);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
                  aria-label={favoriteIds.includes(spot.id) ? 'Unsave' : 'Save'}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={favoriteIds.includes(spot.id) ? '#f43f5e' : 'transparent'}
                    stroke={favoriteIds.includes(spot.id) ? '#f43f5e' : 'currentColor'}
                    strokeWidth={2}
                  />
                </button>
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <h3 className="font-semibold text-white drop-shadow-sm line-clamp-1 group-hover:text-emerald-300">
                    {spot.name}
                  </h3>
                  {spot.tags?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {spot.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-300 drop-shadow-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">
                      {spot.address || `${spot.latitude?.toFixed(2)}, ${spot.longitude?.toFixed(2)}`}
                    </span>
                  </p>
                </div>
              </div>
              <div className="px-4 py-3">
                {spot.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 group-hover:text-slate-300">
                    {spot.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {spot.bestTime}
                    {spot.score != null && spot.score > 0 && (
                      <span className="ml-1 text-emerald-500/90">· {spot.score}</span>
                    )}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 text-slate-500 group-hover:text-emerald-400">
                  <span className="text-xs font-medium">View</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
