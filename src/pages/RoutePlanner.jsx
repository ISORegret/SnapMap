import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, LocateFixed, MapPin, Milestone, Navigation, Plus, Search, Trash2 } from 'lucide-react';
import DirectionsLauncher from '../components/DirectionsLauncher';
import { appleMultiStopDirectionsUrl, googleMultiStopDirectionsUrl } from '../utils/mapNavigation';
import { getSpotPrimaryImage } from '../utils/spotImages';
import { haversineKm, kmToMi } from '../utils/geo';

const ROUTE_DRAFT_KEY = 'snapmap_route_draft_v1';
const MAX_ROUTE_STOPS = 4;

function validCoordinate(spot) {
  const lat = Number(spot?.latitude);
  const lng = Number(spot?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

function readDraft() {
  try {
    const value = JSON.parse(localStorage.getItem(ROUTE_DRAFT_KEY) || 'null');
    return Array.isArray(value) ? value.map(String).slice(0, MAX_ROUTE_STOPS) : [];
  } catch {
    return [];
  }
}

export default function RoutePlanner({ allSpots = [], favoriteIds = [], collections = [], userPosition = null, requestPosition, units = 'mi' } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedIds = (searchParams.get('ids') || '').split(',').map((id) => id.trim()).filter(Boolean);
  const [routeIds, setRouteIds] = useState(() => (requestedIds.length ? requestedIds.slice(0, MAX_ROUTE_STOPS) : readDraft()));
  const [query, setQuery] = useState('');
  const [originMode, setOriginMode] = useState(searchParams.get('start') === 'first' ? 'first' : 'current');
  const [locating, setLocating] = useState(false);

  const savedIds = useMemo(() => new Set([
    ...favoriteIds.map(String),
    ...collections.flatMap((collection) => (collection.spotIds || []).map(String)),
  ]), [favoriteIds, collections]);
  const savedSpots = useMemo(() => allSpots.filter((spot) => savedIds.has(String(spot.id)) && validCoordinate(spot)), [allSpots, savedIds]);
  const selectedSpots = useMemo(() => routeIds.map((id) => allSpots.find((spot) => String(spot.id) === String(id))).filter(validCoordinate), [routeIds, allSpots]);
  const availableSpots = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return savedSpots.filter((spot) => !routeIds.includes(String(spot.id)) && (!lower || `${spot.name || ''} ${spot.address || ''}`.toLowerCase().includes(lower)));
  }, [savedSpots, routeIds, query]);

  useEffect(() => {
    try { localStorage.setItem(ROUTE_DRAFT_KEY, JSON.stringify(routeIds)); } catch {}
  }, [routeIds]);

  const moveStop = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= routeIds.length) return;
    setRouteIds((ids) => {
      const next = [...ids];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const useLocation = async () => {
    setOriginMode('current');
    if (userPosition || !requestPosition) return;
    setLocating(true);
    await requestPosition();
    setLocating(false);
  };

  const startAtFirst = originMode === 'first' && selectedSpots.length > 1;
  const navigationStops = startAtFirst ? selectedSpots.slice(1) : selectedSpots;
  const origin = startAtFirst ? selectedSpots[0] : userPosition;
  const googleUrl = googleMultiStopDirectionsUrl(navigationStops, origin);
  const appleUrl = appleMultiStopDirectionsUrl(navigationStops, origin);
  const previewUrl = `/?route=${selectedSpots.map((spot) => spot.id).join(',')}&start=${startAtFirst ? 'first' : 'current'}`;
  const pathPoints = startAtFirst
    ? selectedSpots
    : (userPosition?.lat != null && userPosition?.lng != null ? [userPosition, ...selectedSpots] : selectedSpots);
  const straightLineKm = pathPoints.slice(1).reduce((total, point, index) => {
    const previous = pathPoints[index];
    return total + haversineKm(Number(previous.lat ?? previous.latitude), Number(previous.lng ?? previous.longitude), Number(point.lat ?? point.latitude), Number(point.lng ?? point.longitude));
  }, 0);
  const distance = units === 'km' ? straightLineKm : kmToMi(straightLineKm);

  return (
    <div className="page-shell pb-32 animate-fade-in">
      <header className="page-header">
        <button type="button" onClick={() => navigate(-1)} className="icon-button mb-5 gap-2 rounded-2xl px-3" aria-label="Go back"><ArrowLeft className="h-5 w-5" />Back</button>
        <p className="eyebrow">Shoot-day planner</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-primary">Plan a route</h1>
        <p className="mt-2 text-sm text-muted">Choose up to four saved spots, put them in order, then open the trip in your maps app.</p>
      </header>

      <div className="space-y-5 px-4 pt-5">
        <section className="surface-card rounded-[1.6rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="eyebrow">Starting point</p><p className="mt-1 text-sm font-bold text-primary">{originMode === 'first' && selectedSpots.length > 1 ? selectedSpots[0].name : 'Your current location'}</p></div>
            <button type="button" onClick={useLocation} disabled={locating} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold ${originMode === 'current' ? 'bg-accent-500 text-[#211603]' : 'bg-white/[0.055] text-secondary'}`}><LocateFixed className="h-4 w-4" />{locating ? 'Locating…' : 'Current'}</button>
          </div>
          {selectedSpots.length > 1 && <button type="button" onClick={() => setOriginMode('first')} className={`mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-extrabold ${originMode === 'first' ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/20' : 'bg-white/[0.04] text-muted'}`}>Start the route at stop 1</button>}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="eyebrow">Route order</p><h2 className="mt-1 text-lg font-extrabold text-primary">{selectedSpots.length} of {MAX_ROUTE_STOPS} stops</h2></div>{selectedSpots.length > 0 && <button type="button" onClick={() => setRouteIds([])} className="text-xs font-bold text-rose-400">Clear route</button>}</div>
          {selectedSpots.length === 0 ? <div className="surface-card rounded-[1.5rem] px-5 py-8 text-center"><Milestone className="mx-auto h-7 w-7 text-accent-400" /><p className="mt-3 text-sm font-extrabold text-primary">Add your first stop</p><p className="mt-1 text-xs text-muted">Choose from your saved spots below.</p></div> : <div className="space-y-2">
            {selectedSpots.map((spot, index) => <div key={spot.id} className="surface-card flex items-center gap-3 rounded-[1.35rem] p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-500 text-sm font-black text-[#211603]">{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-primary">{spot.name}</p><p className="mt-0.5 truncate text-xs text-muted">{spot.address || `${Number(spot.latitude).toFixed(4)}, ${Number(spot.longitude).toFixed(4)}`}</p></div>
              <div className="flex shrink-0 gap-1"><button type="button" onClick={() => moveStop(index, -1)} disabled={index === 0} className="icon-button h-9 w-9 rounded-xl disabled:opacity-25" aria-label={`Move ${spot.name} up`}><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => moveStop(index, 1)} disabled={index === selectedSpots.length - 1} className="icon-button h-9 w-9 rounded-xl disabled:opacity-25" aria-label={`Move ${spot.name} down`}><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => setRouteIds((ids) => ids.filter((id) => id !== String(spot.id)))} className="icon-button h-9 w-9 rounded-xl text-rose-400" aria-label={`Remove ${spot.name}`}><Trash2 className="h-4 w-4" /></button></div>
            </div>)}
          </div>}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Saved spots</p><h2 className="mt-1 text-lg font-extrabold text-primary">Add a stop</h2></div>{routeIds.length >= MAX_ROUTE_STOPS && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">Route full</span>}</div>
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved spots" className="surface-input w-full rounded-2xl py-3.5 pl-10 pr-3 text-sm" /></div>
          {savedSpots.length === 0 ? <div className="surface-card rounded-[1.5rem] px-5 py-8 text-center"><p className="text-sm font-bold text-primary">No saved spots with map pins</p><Link to="/explore" className="mt-2 inline-block text-sm font-extrabold text-accent-400">Find spots to save</Link></div> : availableSpots.length === 0 ? <p className="px-1 text-sm text-muted">{routeIds.length >= savedSpots.length ? 'Every saved spot is already in this route.' : 'No saved spots match that search.'}</p> : <div className="space-y-2">
            {availableSpots.map((spot) => <div key={spot.id} className="surface-card flex items-center gap-3 rounded-[1.35rem] p-2.5"><img src={getSpotPrimaryImage(spot)} alt="" className="h-14 w-16 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-primary">{spot.name}</p><p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted"><MapPin className="h-3 w-3 shrink-0" />{spot.address || 'Pinned location'}</p></div><button type="button" onClick={() => setRouteIds((ids) => [...ids, String(spot.id)])} disabled={routeIds.length >= MAX_ROUTE_STOPS} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500 text-[#211603] disabled:opacity-30" aria-label={`Add ${spot.name} to route`}><Plus className="h-5 w-5" /></button></div>)}
          </div>}
        </section>
      </div>

      {selectedSpots.length > 0 && <div className="fixed bottom-[6.75rem] left-3 right-3 z-[1040] mx-auto max-w-lg rounded-[1.45rem] border border-white/10 bg-[var(--bg-nav)] p-2 shadow-2xl backdrop-blur-2xl"><div className="mb-2 flex items-center justify-between px-2 text-xs"><span className="font-bold text-secondary">{selectedSpots.length} stop{selectedSpots.length === 1 ? '' : 's'}</span>{distance > 0 && <span className="text-muted">≈ {distance.toFixed(distance < 10 ? 1 : 0)} {units} between pins</span>}</div><div className="grid grid-cols-2 gap-2"><Link to={previewUrl} className="flex min-h-12 items-center justify-center gap-2 rounded-[1rem] bg-white/[0.06] text-sm font-extrabold text-secondary"><Milestone className="h-4 w-4" />Preview</Link><DirectionsLauncher googleUrl={googleUrl} appleUrl={appleUrl} title="Start this route" googleDescription="Open all route stops in Google Maps" appleDescription="Open all route stops in Apple Maps" className="flex min-h-12 items-center justify-center gap-2 rounded-[1rem] bg-accent-500 text-sm font-extrabold text-[#211603]"><Navigation className="h-4 w-4" />Navigate</DirectionsLauncher></div></div>}
    </div>
  );
}
