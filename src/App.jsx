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
import { hapticLight } from './utils/haptics';

export default function App() {
  const [userSpots, setUserSpots] = useState([]);
  const [communitySpots, setCommunitySpots] = useState([]);
  const [communitySpotsLoading, setCommunitySpotsLoading] = useState(true);
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
    setCommunitySpotsLoading(true);
    fetchCommunitySpots()
      .then(setCommunitySpots)
      .finally(() => setCommunitySpotsLoading(false));
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
        hapticLight();
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
      hapticLight();
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
    const isAdding = !favoriteIds.includes(spotId);
    const next = isAdding
      ? [...favoriteIds, spotId]
      : favoriteIds.filter((id) => id !== spotId);
    setFavoriteIds(next);
    saveFavorites(next);
    if (isAdding) hapticLight();
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
      <div
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 animate-fade-in"
        role="status"
        aria-label="Loading"
      >
        {/* Background gradient + radial glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#051009] via-[#080c0a] to-[#050a08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,rgba(52,211,153,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_80%,rgba(16,185,129,0.08),transparent_50%)]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo container with glow and pulse */}
          <div className="animate-splash-pulse flex flex-col items-center gap-8">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-2xl" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/25 to-emerald-600/15 shadow-[0_0_40px_-8px_rgba(52,211,153,0.4)]">
                <Map className="h-14 w-14 text-emerald-400 drop-shadow-lg" strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gradient drop-shadow-sm md:text-5xl">
                SnapMap
              </h1>
              <p className="mt-3 text-base text-slate-400 md:text-lg">
                The best places for photography and cars
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Exact geo · Best times · Plan less, travel more
              </p>
            </div>
          </div>
          {/* Loading indicator */}
          <div className="mt-14 flex flex-col items-center gap-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-emerald-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.6s' }}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-slate-500">Loading…</p>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-splash-progress rounded-full bg-emerald-500" />
            </div>
          </div>
        </div>
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
    <div className="flex min-h-screen flex-col app-shell animate-fade-in" style={{ backgroundColor: 'var(--bg-page)' }}>
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
                onRefresh={() => {
                  setCommunitySpotsLoading(true);
                  return fetchCommunitySpots().then(setCommunitySpots).finally(() => setCommunitySpotsLoading(false));
                }}
                spotsLoading={communitySpotsLoading}
              />
            }
          />
          <Route path="/map" element={<MapPage allSpots={allSpots} />} />
          <Route path="/add" element={<Add onAdd={addSpot} onUpdate={updateSpot} />} />
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
