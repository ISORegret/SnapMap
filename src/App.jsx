import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { CURATED_SPOTS } from './data/curatedSpots';
import { loadUserSpots, saveUserSpots, loadFavorites, saveFavorites } from './data/spotStore';
import Feed from './pages/Feed';
import Map from './pages/Map';
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

  return (
    <div className="flex min-h-screen flex-col bg-surface-900">
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
        <Route path="/map" element={<Map allSpots={allSpots} />} />
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
      <nav className="sticky bottom-0 z-20 flex justify-around border-t border-white/5 bg-surface-800 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <Link to="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
          For You
        </Link>
        <Link to="/map" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
          Map
        </Link>
        <Link to="/add" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-light">
          Add
        </Link>
        <Link to="/saved" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
          Saved
        </Link>
      </nav>
    </div>
  );
}
