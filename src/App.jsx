import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Map, Plus, Heart } from 'lucide-react';
import { CURATED_SPOTS } from './data/curatedSpots';
import { loadUserSpots, saveUserSpots, loadFavorites, saveFavorites } from './data/spotStore';
import Feed from './pages/Feed';
import MapPage from './pages/Map';
import Add from './pages/Add';
import Saved from './pages/Saved';
import SpotDetail from './pages/SpotDetail';

export default function App() {
  const [userSpots, setUserSpots] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setUserSpots(loadUserSpots());
    setFavoriteIds(loadFavorites());
    setReady(true);
  }, []);

  const allSpots = [...CURATED_SPOTS, ...userSpots];

  const addSpot = useCallback((spot) => {
    const id = `user-${Date.now()}`;
    const newSpot = { ...spot, id };
    const next = [newSpot, ...userSpots];
    setUserSpots(next);
    saveUserSpots(next);
    navigate('/');
  }, [userSpots, navigate]);

  const updateSpot = useCallback((spotId, updates) => {
    const spot = userSpots.find((s) => s.id === spotId);
    if (!spot) return;
    const updated = { ...spot, ...updates };
    const next = userSpots.map((s) => (s.id === spotId ? updated : s));
    setUserSpots(next);
    saveUserSpots(next);
  }, [userSpots]);

  const toggleFavorite = useCallback((spotId) => {
    const next = favoriteIds.includes(spotId)
      ? favoriteIds.filter((id) => id !== spotId)
      : [...favoriteIds, spotId];
    setFavoriteIds(next);
    saveFavorites(next);
  }, [favoriteIds]);

  const getSpotById = (id) => allSpots.find((s) => s.id === id);
  const isUserSpot = (spotId) => userSpots.some((s) => s.id === spotId);
  const isFavorite = (spotId) => favoriteIds.includes(spotId);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  const navLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'text-emerald-400' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
    }`;
  const addLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 ${
      isActive ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0c0c0f]' : ''
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0c0f]">
      <main className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route
            path="/"
            element={
              <Feed
                allSpots={allSpots}
                favoriteIds={favoriteIds}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          <Route path="/map" element={<MapPage allSpots={allSpots} />} />
          <Route path="/add" element={<Add onAdd={addSpot} />} />
          <Route
            path="/saved"
            element={
              <Saved
                allSpots={allSpots}
                favoriteIds={favoriteIds}
                toggleFavorite={toggleFavorite}
              />
            }
          />
          <Route
            path="/spot/:id"
            element={
              <SpotDetail
                getSpotById={getSpotById}
                isUserSpot={isUserSpot}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                updateSpot={updateSpot}
              />
            }
          />
        </Routes>
      </main>
      <nav className="sticky bottom-0 z-20 flex items-center justify-around gap-1 border-t border-white/[0.06] bg-[#0c0c0f]/95 px-2 py-2 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <NavLink to="/" className={navLinkClass}>
          <LayoutGrid className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">For You</span>
        </NavLink>
        <NavLink to="/map" className={navLinkClass}>
          <Map className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">Map</span>
        </NavLink>
        <NavLink to="/add" className={addLinkClass}>
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">Add</span>
        </NavLink>
        <NavLink to="/saved" className={navLinkClass}>
          <Heart className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">Saved</span>
        </NavLink>
      </nav>
    </div>
  );
}
