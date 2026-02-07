import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Map, Plus, Heart, WifiOff, Sun, Moon } from 'lucide-react';
import { CURATED_SPOTS } from './data/curatedSpots';
import {
  loadUserSpots,
  saveUserSpots,
  loadFavorites,
  saveFavorites,
  loadCollections,
  saveCollections,
  addSpotToCollection,
  removeSpotFromCollection,
  createCollection as createCollectionInStore,
  deleteCollection as deleteCollectionInStore,
} from './data/spotStore';
import { fetchCommunitySpots, insertCommunitySpot, updateCommunitySpot, deleteCommunitySpot } from './api/spots';
import Feed from './pages/Feed';
import MapPage from './pages/Map';
import Add from './pages/Add';
import Saved from './pages/Saved';
import SpotDetail from './pages/SpotDetail';
import InstallPrompt from './components/InstallPrompt';

export default function App() {
  const [userSpots, setUserSpots] = useState([]);
  const [communitySpots, setCommunitySpots] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [collections, setCollections] = useState([]);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [theme, setThemeState] = useState(() =>
    typeof localStorage !== 'undefined' ? (localStorage.getItem('snapmap_theme') || 'dark') : 'dark'
  );
  const navigate = useNavigate();

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark';
    setThemeState(value);
    if (typeof localStorage !== 'undefined') localStorage.setItem('snapmap_theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    setUserSpots(loadUserSpots());
    setFavoriteIds(loadFavorites());
    setCollections(loadCollections());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchCommunitySpots().then(setCommunitySpots);
  }, [ready]);

  const allSpots = [
    ...CURATED_SPOTS,
    ...communitySpots,
    ...userSpots.filter((u) => !communitySpots.some((c) => c.id === u.id)),
  ];

  const addSpot = useCallback(
    async (spot) => {
      const result = await insertCommunitySpot(spot);
      if (result.spot) {
        setUserSpots((prev) => {
          const next = [result.spot, ...prev];
          saveUserSpots(next);
          return next;
        });
        setCommunitySpots((prev) => [result.spot, ...prev]);
        navigate('/');
        return;
      }
      const id = `user-${Date.now()}`;
      const newSpot = { ...spot, id, uploadError: result.error || undefined };
      setUserSpots((prev) => {
        const next = [newSpot, ...prev];
        saveUserSpots(next);
        return next;
      });
      navigate('/');
    },
    [navigate]
  );

  const updateSpot = useCallback((spotId, updates) => {
    const inUser = userSpots.find((s) => s.id === spotId);
    if (inUser) {
      const updated = { ...inUser, ...updates };
      setUserSpots((prev) => {
        const next = prev.map((s) => (s.id === spotId ? updated : s));
        saveUserSpots(next);
        return next;
      });
    }
    const isCloudId = spotId && !String(spotId).startsWith('user-');
    if (isCloudId) {
      updateCommunitySpot(spotId, updates).then((ok) => {
        if (ok) setCommunitySpots((prev) => prev.map((s) => (s.id === spotId ? { ...s, ...updates } : s)));
      });
    }
  }, [userSpots]);

  const deleteSpot = useCallback((spotId) => {
    deleteCommunitySpot(spotId);
    const nextSpots = userSpots.filter((s) => s.id !== spotId);
    setUserSpots(nextSpots);
    saveUserSpots(nextSpots);
    setCommunitySpots((prev) => prev.filter((s) => s.id !== spotId));
    const nextFavs = favoriteIds.filter((id) => id !== spotId);
    setFavoriteIds(nextFavs);
    saveFavorites(nextFavs);
    const nextColls = collections.map((c) => ({
      ...c,
      spotIds: c.spotIds.filter((id) => id !== spotId),
    }));
    setCollections(nextColls);
    saveCollections(nextColls);
    navigate('/');
  }, [userSpots, favoriteIds, collections, navigate]);

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

  const addToCollection = useCallback((collectionId, spotId) => {
    setCollections(addSpotToCollection(collectionId, spotId));
  }, []);
  const removeFromCollection = useCallback((collectionId, spotId) => {
    setCollections(removeSpotFromCollection(collectionId, spotId));
  }, []);
  const createCollection = useCallback((name) => {
    setCollections(createCollectionInStore(name));
  }, []);
  const deleteCollection = useCallback((id) => {
    setCollections(deleteCollectionInStore(id));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  const navLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'text-emerald-400' : 'text-slate-500 hover:bg-emerald-500/10 hover:text-slate-300'
    }`;
  const addLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-emerald-400 ${
      isActive ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#080c0a]' : ''
    }`;

  return (
    <div className="flex min-h-screen flex-col app-shell" style={{ backgroundColor: 'var(--bg-page)' }}>
      <InstallPrompt />
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-950/95 px-4 py-2 text-sm font-medium text-amber-200" role="status">
          <WifiOff className="h-4 w-4 shrink-0" />
          You&apos;re offline. Sync may fail until you&apos;re back online.
        </div>
      )}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <Feed
                allSpots={allSpots}
                favoriteIds={favoriteIds}
                toggleFavorite={toggleFavorite}
                onDismissSpotError={(spotId) => updateSpot(spotId, { uploadError: undefined })}
                onRefresh={() => fetchCommunitySpots().then(setCommunitySpots)}
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
                collections={collections}
                createCollection={createCollection}
                deleteCollection={deleteCollection}
                removeFromCollection={removeFromCollection}
                onDismissSpotError={(spotId) => updateSpot(spotId, { uploadError: undefined })}
                theme={theme}
                setTheme={setTheme}
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
                onDeleteSpot={deleteSpot}
                collections={collections}
                addToCollection={addToCollection}
                removeFromCollection={removeFromCollection}
              />
            }
          />
        </Routes>
      </main>
      <nav className="sticky bottom-0 z-20 flex flex-col border-t border-emerald-500/10 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]" style={{ backgroundColor: 'var(--bg-nav)' }}>
        <div className="flex items-center justify-around gap-1 px-2 py-2">
          <NavLink to="/" className={navLinkClass}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">For You ({allSpots.length})</span>
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
        </div>
        <p className="text-center text-[10px] text-slate-500 pb-1" aria-hidden="true">
          v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </p>
      </nav>
    </div>
  );
}
