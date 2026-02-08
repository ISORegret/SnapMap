import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Map as MapIcon, Plus, Heart, WifiOff, Sun, Moon } from 'lucide-react';
import { CURATED_SPOTS } from './data/curatedSpots';
import {
  loadUserSpots,
  saveUserSpots,
  loadFavorites,
  saveFavorites,
  loadCollections,
  saveCollections,
  loadSyncCode,
  saveSyncCode,
  addSpotToCollection,
  removeSpotFromCollection,
  createCollection as createCollectionInStore,
  deleteCollection as deleteCollectionInStore,
} from './data/spotStore';
import { fetchCommunitySpots, insertCommunitySpot, updateCommunitySpot, deleteCommunitySpot } from './api/spots';
import { fetchFavorites as fetchFavoritesApi, addFavorite as addFavoriteApi, removeFavorite as removeFavoriteApi } from './api/favorites';
import { getProfileById, createProfile } from './api/profiles';
import { supabase, hasSupabase } from './api/supabase';
import { getCurrentPosition } from './utils/geo';
import Feed from './pages/Feed';
const MapPage = lazy(() => import('./pages/Map'));
import Add from './pages/Add';
import Saved from './pages/Saved';
import SpotDetail from './pages/SpotDetail';
import Profile from './pages/Profile';
import SignIn from './pages/SignIn';
import InstallPrompt from './components/InstallPrompt';
import Tutorial from './components/Tutorial';
import { hapticLight } from './utils/haptics';
import { checkUpdateAvailable } from './utils/version';

export default function App() {
  const [userSpots, setUserSpots] = useState([]);
  const [communitySpots, setCommunitySpots] = useState([]);
  const [communitySpotsLoading, setCommunitySpotsLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [collections, setCollections] = useState([]);
  const [syncCode, setSyncCodeState] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [theme, setThemeState] = useState(() =>
    typeof localStorage !== 'undefined' ? (localStorage.getItem('snapmap_theme') || 'dark') : 'dark'
  );
  const [units, setUnitsState] = useState(() =>
    typeof localStorage !== 'undefined' ? (localStorage.getItem('snapmap_units') || 'mi') : 'mi'
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const navigate = useNavigate();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  const requestPosition = useCallback(async () => {
    const pos = await getCurrentPosition();
    if (pos) setUserPosition(pos);
    return pos;
  }, []);

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark';
    setThemeState(value);
    if (typeof localStorage !== 'undefined') localStorage.setItem('snapmap_theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }, []);

  const setUnits = useCallback((next) => {
    const value = next === 'km' ? 'km' : 'mi';
    setUnitsState(value);
    if (typeof localStorage !== 'undefined') localStorage.setItem('snapmap_units', value);
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
    setSyncCodeState(loadSyncCode());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // When user lands from magic link with hash #access_token=... (no path), exchange for session and go to Feed
  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const qIndex = hash.indexOf('?');
    const search = qIndex >= 0 ? hash.slice(qIndex + 1) : hash;
    const params = new URLSearchParams(search);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token) return;
    supabase.auth
      .setSession({ access_token, refresh_token: refresh_token || '' })
      .then(() => {
        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + '#/');
        navigate('/', { replace: true });
      })
      .catch(() => {});
  }, [hasSupabase, navigate]);

  // Native app: when opened via magic link (snapmap://auth/callback#access_token=...), exchange for session
  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    const setSessionFromUrl = (url) => {
      if (!url || !url.includes('access_token')) return;
      const hashStart = url.indexOf('#');
      const fragment = hashStart >= 0 ? url.slice(hashStart + 1) : '';
      const qIndex = fragment.indexOf('?');
      const search = qIndex >= 0 ? fragment.slice(qIndex + 1) : fragment;
      const params = new URLSearchParams(search);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token) return;
      supabase.auth
        .setSession({ access_token, refresh_token: refresh_token || '' })
        .then(() => navigate('/', { replace: true }))
        .catch(() => {});
    };
    let listener;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        const { url } = await App.getLaunchUrl();
        if (url) setSessionFromUrl(url);
        listener = await App.addListener('appUrlOpen', (e) => setSessionFromUrl(e.url));
      } catch (_) {}
    })();
    return () => {
      listener?.remove?.();
    };
  }, [hasSupabase, supabase, navigate]);

  useEffect(() => {
    if (!currentUser?.id || !hasSupabase) return;
    getProfileById(currentUser.id).then((p) => {
      if (!p) {
        const u = (currentUser.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'user';
        createProfile({ id: currentUser.id, username: u, displayName: u });
      }
    });
  }, [currentUser?.id, currentUser?.email]);

  useEffect(() => {
    if (!ready) return;
    setCommunitySpotsLoading(true);
    fetchCommunitySpots()
      .then(setCommunitySpots)
      .finally(() => setCommunitySpotsLoading(false));
  }, [ready]);

  useEffect(() => {
    if (ready) requestPosition();
  }, [ready, requestPosition]);

  // Refetch community spots when tab becomes visible so other device's edits show up
  useEffect(() => {
    if (!isOnline) return;
    const refetch = () => {
      setCommunitySpotsLoading(true);
      fetchCommunitySpots()
        .then(setCommunitySpots)
        .finally(() => setCommunitySpotsLoading(false));
    };
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refetch();
    };
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
  }, [isOnline]);

  // Supabase Realtime: refetch community spots as soon as any spot is inserted/updated/deleted (sync across devices)
  useEffect(() => {
    if (!isOnline || !ready || !hasSupabase || !supabase) return;
    const channel = supabase
      .channel('spots-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spots' },
        () => {
          fetchCommunitySpots().then(setCommunitySpots);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, ready]);

  // Periodic refetch while app is visible (backup if Realtime is not enabled for spots)
  const REFETCH_INTERVAL_MS = 45 * 1000;
  useEffect(() => {
    if (!isOnline) return;
    let intervalId = null;
    const schedule = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      intervalId = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        fetchCommunitySpots().then(setCommunitySpots);
      }, REFETCH_INTERVAL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule();
      else if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    if (document.visibilityState === 'visible') schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    checkUpdateAvailable(appVersion).then(setUpdateAvailable);
  }, [isOnline, appVersion]);

  // When sync code is set and online, load favorites from Supabase and refetch on visibility
  const syncCodeRef = React.useRef(syncCode);
  syncCodeRef.current = syncCode;
  useEffect(() => {
    if (!ready || !isOnline || !hasSupabase || !syncCode) return;
    let cancelled = false;
    fetchFavoritesApi(syncCode).then((ids) => {
      if (!cancelled) {
        setFavoriteIds(ids);
        saveFavorites(ids);
      }
    });
    return () => { cancelled = true; };
  }, [ready, isOnline, syncCode]);

  const refetchFavorites = useCallback((overrideCode) => {
    const code = overrideCode ?? syncCodeRef.current;
    if (!hasSupabase || !code) return Promise.resolve();
    return fetchFavoritesApi(code).then((ids) => {
      setFavoriteIds(ids);
      saveFavorites(ids);
    });
  }, []);

  useEffect(() => {
    if (!isOnline || !syncCode || !hasSupabase) return;
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refetchFavorites();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isOnline, syncCode, refetchFavorites]);

  const setSyncCode = useCallback((code) => {
    const trimmed = code ? String(code).trim() : '';
    setSyncCodeState(trimmed);
    saveSyncCode(trimmed);
  }, []);

  const pushFavoritesToSync = useCallback(async (code, ids) => {
    if (!hasSupabase || !code || !ids?.length) return;
    for (const spotId of ids) {
      if (spotId && !String(spotId).startsWith('user-')) await addFavoriteApi(code, spotId);
    }
  }, []);

  // Prefer userSpots over communitySpots when same id (so local edits persist after reopen)
  const allSpotsRaw = [
    ...CURATED_SPOTS,
    ...communitySpots.filter((c) => !userSpots.some((u) => u.id === c.id)),
    ...userSpots,
  ];

  // Dedupe by name+address so same place doesn't show twice with different coordinates (and different distances)
  const spotKey = (s) => `${(s.name || '').trim().toLowerCase()}|${(s.address || '').trim().toLowerCase()}`;
  const keepByKey = new Map();
  for (const spot of allSpotsRaw) {
    const key = spotKey(spot);
    if (!key || key === '|') continue;
    const prev = keepByKey.get(key);
    const inUser = userSpots.some((u) => u.id === spot.id);
    const prevInUser = prev && userSpots.some((u) => u.id === prev.id);
    const keep =
      !prev
        ? spot
        : inUser && !prevInUser
          ? spot
          : prevInUser && !inUser
            ? prev
            : (new Date(spot.createdAt || 0) > new Date(prev.createdAt || 0) ? spot : prev);
    keepByKey.set(key, keep);
  }
  const seenKeys = new Set();
  const allSpots = allSpotsRaw.filter((spot) => {
    const key = spotKey(spot);
    if (!key || key === '|') return true;
    const kept = keepByKey.get(key);
    if (kept?.id !== spot.id) return false;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const addSpot = useCallback(
    async (spot) => {
      let payload = { ...spot };
      if (currentUser) {
        const profile = await getProfileById(currentUser.id);
        if (profile?.username) payload = { ...payload, createdBy: profile.username };
      }
      const result = await insertCommunitySpot(payload);
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
      const newSpot = { ...payload, id, uploadError: result.error || undefined };
      setUserSpots((prev) => {
        const next = [newSpot, ...prev];
        saveUserSpots(next);
        return next;
      });
      hapticLight();
      navigate('/');
    },
    [currentUser, navigate]
  );

  const updateSpot = useCallback(
    async (spotId, updates) => {
      const inUser = userSpots.find((s) => s.id === spotId);
      const isCloudId = spotId && !String(spotId).startsWith('user-');

      if (inUser) {
        const updated = { ...inUser, ...updates };
        setUserSpots((prev) => {
          const next = prev.map((s) => (s.id === spotId ? updated : s));
          saveUserSpots(next);
          return next;
        });
        if (isCloudId) {
          const ok = await updateCommunitySpot(spotId, updates);
          if (ok) {
            setCommunitySpots((prev) => prev.map((s) => (s.id === spotId ? { ...s, ...updates } : s)));
            return true;
          }
          setUserSpots((prev) => {
            const next = prev.map((s) =>
              s.id === spotId ? { ...s, ...updates, syncError: true } : s
            );
            saveUserSpots(next);
            return next;
          });
          return false;
        }
        return true; // local-only spot, local save succeeded
      }
      if (isCloudId) {
        const ok = await updateCommunitySpot(spotId, updates);
        if (ok) {
          setCommunitySpots((prev) => prev.map((s) => (s.id === spotId ? { ...s, ...updates } : s)));
          return true;
        }
        return false;
      }
      return true; // no cloud id, nothing to sync
    },
    [userSpots]
  );

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

  const toggleFavorite = useCallback(
    async (spotId) => {
      const isAdding = !favoriteIds.includes(spotId);
      const next = isAdding
        ? [...favoriteIds, spotId]
        : favoriteIds.filter((id) => id !== spotId);
      setFavoriteIds(next);
      saveFavorites(next);
      if (isAdding) hapticLight();
      if (syncCode && hasSupabase) {
        if (isAdding) {
          const ok = await addFavoriteApi(syncCode, spotId);
          if (!ok) {
            setFavoriteIds(favoriteIds);
            saveFavorites(favoriteIds);
          }
        } else {
          removeFavoriteApi(syncCode, spotId);
        }
      }
    },
    [favoriteIds, syncCode]
  );

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
              <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border border-emerald-500/30 bg-[#0c0c0f] shadow-[0_0_40px_-8px_rgba(52,211,153,0.4)]">
                <img src={`${import.meta.env.BASE_URL}snapmap-icon.svg`} alt="" className="h-20 w-20 object-contain" aria-hidden />
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
      <Tutorial />
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-950/95 px-4 py-2 text-sm font-medium text-amber-200" role="status">
          <WifiOff className="h-4 w-4 shrink-0" />
          You&apos;re offline. Sync may fail until you&apos;re back online.
        </div>
      )}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-44">
        <Routes>
          <Route
            path="/"
            element={
              <Feed
                allSpots={allSpots}
                favoriteIds={favoriteIds}
                toggleFavorite={toggleFavorite}
                onDismissSpotError={(spotId) => updateSpot(spotId, { uploadError: undefined, syncError: undefined })}
                onRefresh={() => {
                  setCommunitySpotsLoading(true);
                  return fetchCommunitySpots().then(setCommunitySpots).finally(() => setCommunitySpotsLoading(false));
                }}
                spotsLoading={communitySpotsLoading}
                updateAvailable={updateAvailable}
                userPosition={userPosition}
                requestPosition={requestPosition}
                theme={theme}
                setTheme={setTheme}
                units={units}
                setUnits={setUnits}
                currentUser={currentUser}
                onSignOut={() => supabase?.auth?.signOut()}
              />
            }
          />
          <Route path="/map" element={<Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-slate-400">Loading map…</div>}><MapPage allSpots={allSpots} theme={theme} setTheme={setTheme} units={units} setUnits={setUnits} /></Suspense>} />
          <Route path="/add" element={<Add onAdd={addSpot} onUpdate={updateSpot} />} />
          <Route path="/signin" element={<SignIn currentUser={currentUser} />} />
          <Route path="/user/:username" element={<Profile allSpots={allSpots} currentUser={currentUser} />} />
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
                onDismissSpotError={(spotId) => updateSpot(spotId, { uploadError: undefined, syncError: undefined })}
                syncCode={syncCode}
                setSyncCode={setSyncCode}
                refetchFavorites={refetchFavorites}
                pushFavoritesToSync={pushFavoritesToSync}
                hasSupabase={hasSupabase}
                theme={theme}
                setTheme={setTheme}
                units={units}
                setUnits={setUnits}
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
                onDismissSpotError={(spotId) => updateSpot(spotId, { uploadError: undefined, syncError: undefined })}
                collections={collections}
                addToCollection={addToCollection}
                removeFromCollection={removeFromCollection}
                userPosition={userPosition}
                units={units}
              />
            }
          />
        </Routes>
      </main>
      {/* Floating / compact nav: pill only, no black bar; content scrolls behind it */}
      <div className="fixed left-0 right-0 z-20 flex flex-col items-center px-4 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" style={{ bottom: 12 }}>
        <nav
          className="flex w-full max-w-md items-center justify-around gap-1 rounded-full border border-white/10 px-2 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          style={{ backgroundColor: 'var(--bg-nav)' }}
          aria-label="Main"
        >
          <NavLink to="/" className={navLinkClass}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">For You ({allSpots.length})</span>
          </NavLink>
          <NavLink to="/map" className={navLinkClass}>
            <MapIcon className="h-5 w-5" />
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
        <p className="mt-1 text-center text-[10px] text-slate-500" aria-hidden="true">
          v{appVersion}
          {updateAvailable && (
            <span className="block text-[9px] text-emerald-400 mt-0.5">Update available</span>
          )}
        </p>
      </div>
    </div>
  );
}
