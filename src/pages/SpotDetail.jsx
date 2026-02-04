import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, ExternalLink } from 'lucide-react';

export default function SpotDetail({
  getSpotById,
  isUserSpot,
  isFavorite,
  toggleFavorite,
  updateSpot,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const spot = getSpotById(id);

  if (!spot) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400">Spot not found.</p>
        <Link to="/" className="text-accent">
          Back to For You
        </Link>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-surface-900 pb-6">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-surface-900/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(spot.id)}
          className="rounded-full p-2 text-white hover:bg-white/5"
          aria-label={isFavorite(spot.id) ? 'Unsave' : 'Save'}
        >
          <Heart
            className="h-5 w-5"
            fill={isFavorite(spot.id) ? '#ef4444' : 'transparent'}
            stroke={isFavorite(spot.id) ? '#ef4444' : 'currentColor'}
            strokeWidth={2}
          />
        </button>
      </header>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800">
        <img
          src={spot.imageUri || 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80'}
          alt={spot.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="px-4 pt-4">
        <h1 className="text-xl font-semibold text-white">{spot.name}</h1>
        {spot.address && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            {spot.address}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-500">
          {spot.bestTime}
          {spot.score != null && spot.score > 0 && ` · ${spot.score}`}
        </p>
        {spot.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {spot.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-700 px-2.5 py-1 text-xs text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {spot.photoBy && (
          <p className="mt-2 text-xs text-slate-600">Photo: {spot.photoBy}</p>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-800 py-3 text-sm font-medium text-accent hover:bg-surface-700 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-900"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Maps
        </a>
      </div>
    </div>
  );
}
