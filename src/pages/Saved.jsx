import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, ChevronRight, FolderPlus, Trash2, Search } from 'lucide-react';
import { getSpotPrimaryImage } from '../utils/spotImages';

function matchesSearch(spot, q) {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().trim();
  const name = (spot.name || '').toLowerCase();
  const address = (spot.address || '').toLowerCase();
  const desc = (spot.description || '').toLowerCase();
  return name.includes(lower) || address.includes(lower) || desc.includes(lower);
}

function SpotCard({ spot, onUnsave, compact }) {
  return (
    <Link
      to={`/spot/${spot.id}`}
      className="group flex gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#18181b] transition hover:border-emerald-500/20 hover:bg-[#27272a]"
    >
      <div className={`relative shrink-0 overflow-hidden rounded-lg bg-slate-800 ${compact ? 'h-14 w-16' : 'h-24 w-28'}`}>
        <img
          src={getSpotPrimaryImage(spot)}
          alt=""
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onUnsave(spot.id);
          }}
          className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label="Unsave"
        >
          <Heart className="h-3 w-3" fill="#f43f5e" stroke="#f43f5e" strokeWidth={2} />
        </button>
      </div>
      <div className="min-w-0 flex-1 py-2 pr-2">
        <h2 className="font-medium text-white truncate group-hover:text-emerald-400">{spot.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          {(spot.address && spot.address !== 'Not specified')
            ? spot.address
            : (spot.latitude != null && spot.longitude != null
              ? `${Number(spot.latitude).toFixed(2)}, ${Number(spot.longitude).toFixed(2)}`
              : '—')}
        </p>
        {!compact && spot.bestTime && spot.bestTime !== 'Not specified' && (
          <p className="mt-1 text-xs text-slate-500">{spot.bestTime}</p>
        )}
      </div>
      <div className="flex items-center pr-2 text-slate-500 group-hover:text-emerald-400">
        <ChevronRight className="h-5 w-5" />
      </div>
    </Link>
  );
}

export default function Saved({
  allSpots,
  favoriteIds,
  toggleFavorite,
  collections = [],
  createCollection,
  deleteCollection,
  removeFromCollection,
}) {
  const [newListName, setNewListName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const savedSpots = allSpots.filter((s) => favoriteIds.includes(s.id));
  const savedSpotsFiltered = useMemo(
    () => savedSpots.filter((s) => matchesSearch(s, searchQuery)),
    [savedSpots, searchQuery]
  );
  const otherCollections = collections.filter((c) => c.id !== 'favorites');

  const handleCreateList = (e) => {
    e.preventDefault();
    const name = newListName.trim() || 'New list';
    createCollection(name);
    setNewListName('');
  };

  const totalInCollections = otherCollections.reduce((acc, c) => acc + c.spotIds.length, 0);
  const hasAny = savedSpots.length > 0 || totalInCollections > 0;
  const getSpotsForCollection = (coll) =>
    allSpots.filter((s) => coll.spotIds.includes(s.id)).filter((s) => matchesSearch(s, searchQuery));

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6">
      <header className="border-b border-white/[0.06] bg-[#0c0c0f] px-4 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-white">Saved</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Favorites + your lists — heart to save, or add spots to a list from the spot page.
        </p>
      </header>

      {/* Search */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved spots…"
            className="w-full rounded-xl border border-white/10 bg-[#18181b] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* New list */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <form onSubmit={handleCreateList} className="flex gap-2">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            className="flex-1 rounded-xl border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            <FolderPlus className="h-4 w-4" />
            Add list
          </button>
        </form>
      </div>

      {!hasAny ? (
        <div className="px-4 py-16 text-center">
          <p className="text-slate-500">No saved spots yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Tap the heart on any spot to save it here, or create a list above and add spots from the spot page.
          </p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {/* Favorites */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Favorites
            </h2>
            {savedSpotsFiltered.length === 0 ? (
              <p className="text-sm text-slate-600">
                {savedSpots.length === 0 ? 'No favorites yet — heart a spot to add it.' : 'No favorites match your search.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {savedSpotsFiltered.map((spot) => (
                  <li key={spot.id}>
                    <SpotCard spot={spot} onUnsave={toggleFavorite} compact={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Other collections */}
          {otherCollections.map((coll) => {
            const spots = getSpotsForCollection(coll);
            return (
              <section key={coll.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {coll.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => deleteCollection(coll.id)}
                    className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-red-400"
                    aria-label={`Delete ${coll.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {spots.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    {coll.spotIds.length === 0 ? 'No spots — add from a spot page (Add to list).' : 'No spots in this list match your search.'}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {spots.map((spot) => (
                      <li key={spot.id}>
                        <SpotCard
                          spot={spot}
                          onUnsave={() => removeFromCollection(coll.id, spot.id)}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
