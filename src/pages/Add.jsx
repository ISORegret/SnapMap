import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImagePlus, MapPin, User, ChevronDown, FileClock, X, Search, CheckCircle2 } from 'lucide-react';
import { getSpotImages, resizeImageToDataUrl } from '../utils/spotImages';
import { hasSupabase } from '../api/supabase';
import { getCurrentPosition } from '../utils/geo';

const MAX_IMAGE_DIM = 1200;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';
const DRAFT_KEY = 'snapmap_add_draft';

async function geocodeAddress(query) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Address lookup failed.');
  const result = (await response.json())?.[0];
  if (!result) return null;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, label: result.display_name || query };
}

export default function Add({ onAdd, onUpdate, currentUser, currentUserProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const editSpot = location.state?.editSpot;
  const fromMap = !editSpot && location.state?.lat != null && location.state?.lng != null;
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [parking, setParking] = useState('');
  const [howToAccess, setHowToAccess] = useState('');
  const [lat, setLat] = useState(() =>
    fromMap ? String(location.state.lat) : ''
  );
  const [lng, setLng] = useState(() =>
    fromMap ? String(location.state.lng) : ''
  );
  const [bestTime, setBestTime] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('');
  const [images, setImages] = useState([]); // [{ uri, photoBy }]
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressMatch, setAddressMatch] = useState('');
  const [addressDirty, setAddressDirty] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ name: '', latitude: '', longitude: '' });
  const [saveFeedback, setSaveFeedback] = useState(null); // 'success' | 'error' | null
  const [showDetails, setShowDetails] = useState(Boolean(editSpot));
  const [draftAvailable, setDraftAvailable] = useState(() => {
    if (editSpot) return null;
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
  });
  const [draftReady, setDraftReady] = useState(() => Boolean(editSpot) || !localStorage.getItem(DRAFT_KEY));

  useEffect(() => {
    if (!editSpot) return;
    setName(editSpot.name ?? '');
    setDescription(editSpot.description ?? '');
    setAddress(editSpot.address ?? '');
    setParking(editSpot.parking ?? '');
    setHowToAccess(editSpot.howToAccess ?? '');
    setLat(editSpot.latitude != null ? String(editSpot.latitude) : '');
    setLng(editSpot.longitude != null ? String(editSpot.longitude) : '');
    setBestTime(editSpot.bestTime ?? '');
    setCrowdLevel(editSpot.crowdLevel ?? '');
    setImages(getSpotImages(editSpot));
    setTags(Array.isArray(editSpot.tags) ? editSpot.tags.join(', ') : (editSpot.tags ?? ''));
    setLinkUrl(editSpot.linkUrl ?? '');
    setLinkLabel(editSpot.linkLabel ?? 'More info');
    setCreatedBy(editSpot.createdBy ?? '');
    setAddressDirty(false);
    setAddressMatch('');
    setFieldErrors({ name: '', latitude: '', longitude: '' });
    setSaveFeedback(null);
  }, [editSpot]);

  // When signed in and creating (not editing), prefill "Added by" with current user
  useEffect(() => {
    if (editSpot || !currentUserProfile?.username) return;
    setCreatedBy((prev) => (prev === '' ? currentUserProfile.username : prev));
  }, [currentUserProfile?.username, editSpot]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setPhotoError('');
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('Please choose an image file.');
      return;
    }
    const defaultPhotoBy = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()
      || (currentUserProfile?.username ? `@${currentUserProfile.username}` : 'You');
    Promise.all(files.map((file) => resizeImageToDataUrl(file, MAX_IMAGE_DIM, 0.85)))
      .then((dataUrls) => {
        setImages((prev) => [...prev, ...dataUrls.map((uri) => ({ uri, photoBy: defaultPhotoBy }))]);
      })
      .catch(() => setPhotoError('Could not load photo. Try another.'));
  };

  const hydrateDraft = useCallback((draft) => {
    if (!draft) return;
    setName(draft.name || '');
    setDescription(draft.description || '');
    setAddress(draft.address || '');
    setParking(draft.parking || '');
    setHowToAccess(draft.howToAccess || '');
    setLat(draft.lat || '');
    setLng(draft.lng || '');
    setBestTime(draft.bestTime || '');
    setCrowdLevel(draft.crowdLevel || '');
    setImages(Array.isArray(draft.images) ? draft.images : []);
    setTags(draft.tags || '');
    setLinkUrl(draft.linkUrl || '');
    setLinkLabel(draft.linkLabel || '');
    setCreatedBy(draft.createdBy || '');
    setShowDetails(Boolean(draft.showDetails));
    setAddressDirty(Boolean(draft.address));
    setAddressMatch('');
  }, []);

  const resumeDraft = () => {
    hydrateDraft(draftAvailable);
    setDraftAvailable(null);
    setDraftReady(true);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftAvailable(null);
    setDraftReady(true);
  };

  useEffect(() => {
    if (editSpot || !draftReady) return undefined;
    const meaningful = name.trim() || description.trim() || address.trim() || images.length || fromMap;
    if (!meaningful) return undefined;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, description, address, parking, howToAccess, lat, lng, bestTime, crowdLevel, images, tags, linkUrl, linkLabel, createdBy, showDetails, savedAt: Date.now() }));
      } catch (_) {
        setPhotoError('Draft is too large for this device. Your form is still open.');
      }
    }, 500);
    return () => clearTimeout(id);
  }, [editSpot, draftReady, fromMap, name, description, address, parking, howToAccess, lat, lng, bestTime, crowdLevel, images, tags, linkUrl, linkLabel, createdBy, showDetails]);

  const setPhotoBy = (index, photoBy) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], photoBy };
      return next;
    });
  };

  const removePhoto = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const searchAddress = useCallback(async () => {
    const query = address.trim();
    if (!query) {
      setLocationError('Enter an address or place name first.');
      return null;
    }
    setLocationError(null);
    setAddressMatch('');
    setAddressSearching(true);
    try {
      const match = await geocodeAddress(query);
      if (!match) {
        setLocationError('Address not found. Add the city/state or try a nearby business or landmark.');
        return null;
      }
      setLat(match.latitude.toFixed(6));
      setLng(match.longitude.toFixed(6));
      setAddressMatch(match.label);
      setAddressDirty(false);
      setFieldErrors((prev) => ({ ...prev, latitude: '', longitude: '' }));
      return match;
    } catch {
      setLocationError('Address search is unavailable right now. Try again or use your current location.');
      return null;
    } finally {
      setAddressSearching(false);
    }
  }, [address]);

  const useMyLocation = useCallback(async () => {
    setLocationError(null);
    setAddressMatch('');
    setLocationLoading(true);
    const pos = await getCurrentPosition();
    setLocationLoading(false);
    if (pos) {
      setLat(pos.lat.toFixed(6));
      setLng(pos.lng.toFixed(6));
      setAddressDirty(false);
      setFieldErrors((prev) => ({ ...prev, latitude: '', longitude: '' }));
    } else {
      setLocationError('Location unavailable. Allow access or search by address.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || addressSearching) return;

    const errors = { name: '', latitude: '', longitude: '' };
    if (!name.trim()) errors.name = 'Name is required.';

    let latNum = parseFloat(String(lat).trim());
    let lngNum = parseFloat(String(lng).trim());
    let validLat = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
    let validLng = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180;

    if (address.trim() && (addressDirty || !validLat || !validLng)) {
      const match = await searchAddress();
      if (!match) return;
      latNum = match.latitude;
      lngNum = match.longitude;
      validLat = true;
      validLng = true;
    }

    if (!editSpot) {
      if (!validLat) errors.latitude = 'Search an address or use your location.';
      if (!validLng) errors.longitude = 'Search an address or use your location.';
    }
    setFieldErrors(errors);
    if (errors.name || errors.latitude || errors.longitude) return;

    const creatorPhotoBy = (currentUserProfile?.display_name || currentUserProfile?.displayName || '').trim()
      || (currentUserProfile?.username ? `@${currentUserProfile.username}` : 'You');
    const validImages = images
      .filter((img) => img?.uri && String(img.uri).trim())
      .map((img) => {
        const by = (img.photoBy || 'You').trim();
        const photoBy = (by === 'You' && currentUserProfile) ? creatorPhotoBy : by;
        return { uri: img.uri.trim(), photoBy };
      });
    const hasRealPhoto = validImages.some((img) => img.uri && img.uri !== DEFAULT_IMAGE);
    if (!editSpot && !hasRealPhoto) {
      setPhotoError('Add at least one photo of the spot.');
      return;
    }
    setPhotoError('');
    const finalImages = validImages.length ? validImages : [{ uri: DEFAULT_IMAGE, photoBy: 'You' }];

    const latitude = validLat ? latNum : editSpot?.latitude;
    const longitude = validLng ? lngNum : editSpot?.longitude;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      setLocationError('Search an address or use your current location before saving.');
      return;
    }
    const addressOrLocation = address.trim()
      || `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || '',
        address: addressOrLocation,
        parking: parking.trim() || '',
        howToAccess: howToAccess.trim() || '',
        latitude: Number(latitude),
        longitude: Number(longitude),
        bestTime: bestTime.trim() || 'Not specified',
        crowdLevel: crowdLevel === 'quiet' || crowdLevel === 'moderate' || crowdLevel === 'busy' ? crowdLevel : '',
        score: editSpot ? (editSpot.score ?? 0) : 0,
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()) : [],
        images: finalImages,
        linkUrl: linkUrl.trim() || '',
        linkLabel: linkLabel.trim() || 'More info',
        createdBy: (currentUserProfile?.username && !editSpot) ? currentUserProfile.username : (createdBy.trim() || ''),
        createdByDisplayName: (currentUserProfile && !editSpot)
          ? ((currentUserProfile.display_name || currentUserProfile.displayName || '').trim() || currentUserProfile.username || '')
          : '',
      };
      if (editSpot && onUpdate) {
        setSaveFeedback(null);
        const ok = await onUpdate(editSpot.id, payload);
        setSaveFeedback(ok ? 'success' : 'error');
        if (ok) {
          localStorage.removeItem(DRAFT_KEY);
          setTimeout(() => navigate(`/spot/${editSpot.id}`, { replace: true }), 1500);
        }
      } else {
        await onAdd(payload);
        localStorage.removeItem(DRAFT_KEY);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell-narrow pb-24 animate-fade-in">
      <header className="pb-6 pt-2">
        <p className="eyebrow">Community map</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-primary">
          {editSpot ? 'Edit spot' : 'Add a spot'}
        </h1>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted">
          {editSpot
            ? "Update name, description, location, photos, and more. All changes sync across devices."
            : currentUser && hasSupabase
              ? 'This spot will be published to the community map.'
              : hasSupabase
                ? 'This spot will stay on this device. Sign in first to publish it to the community map.'
                : 'Data stays on your device. Add Supabase in .env to share spots.'}
        </p>
      </header>
      {draftAvailable && !editSpot && (
        <div className="surface-card mb-5 rounded-[1.5rem] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-500/15 text-accent-400"><FileClock className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-primary">Continue your unfinished spot?</p>
              <p className="mt-1 truncate text-xs text-slate-500">{draftAvailable.name || draftAvailable.address || 'Untitled draft'}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={resumeDraft} className="primary-button px-4 py-2 text-xs">Resume</button>
                <button type="button" onClick={discardDraft} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-400">Start fresh</button>
              </div>
            </div>
            <button type="button" onClick={discardDraft} className="rounded-lg p-1 text-slate-600" aria-label="Discard draft"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-500">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder="Spot name"
            required
            className={`mt-1 w-full rounded-2xl border bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
              fieldErrors.name ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500' : 'border-white/10 focus:border-accent-500 focus:ring-accent-500'
            }`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-amber-400">{fieldErrors.name}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Short description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Iconic overlook with city views"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Address or place</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Search a street address, business, park, or landmark. SnapMap will place the coordinates for you.</p>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setAddressDirty(true);
                setAddressMatch('');
                setLocationError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchAddress();
                }
              }}
              placeholder="e.g. 1000 Riverside Ave, Jacksonville, FL"
              autoComplete="street-address"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={addressSearching || !address.trim()}
              className="primary-button min-w-24 shrink-0 px-3 py-2.5 text-xs disabled:opacity-50"
            >
              <Search className={`h-4 w-4 ${addressSearching ? 'animate-pulse' : ''}`} />
              {addressSearching ? 'Finding…' : 'Search'}
            </button>
          </div>
          {addressMatch && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">Found: {addressMatch}</span></p>
          )}
        </div>
        <button type="button" onClick={() => setShowDetails((open) => !open)} className="surface-card flex w-full items-center justify-between rounded-[1.35rem] px-4 py-3.5 text-left">
          <span>
            <span className="block text-sm font-extrabold text-primary">Shoot details</span>
            <span className="mt-0.5 block text-xs text-slate-500">Parking, access, best time, crowds, tags, and links</span>
          </span>
          <ChevronDown className={`h-5 w-5 text-accent-400 transition ${showDetails ? 'rotate-180' : ''}`} />
        </button>
        {showDetails && <>
        <div>
          <label className="block text-xs font-medium text-slate-500">Parking (optional)</label>
          <input
            type="text"
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            placeholder="e.g. Street, free · Lot nearby"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">How to access (optional)</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Dirt road, 4WD, gate code, etc.</p>
          <input
            type="text"
            value={howToAccess}
            onChange={(e) => setHowToAccess(e.target.value)}
            placeholder="e.g. Dirt road 2 mi from Hwy 1; 4WD recommended"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        </>}
        {fromMap && (
          <p className="rounded-lg bg-accent-500/10 px-3 py-2 text-xs text-accent-400">
            Location set from map pin — add a name and save.
          </p>
        )}
        <div className="surface-card rounded-[1.5rem] p-5">
          <p className="eyebrow mb-1">Location</p>
          <p className="mb-3 text-xs text-slate-500">Search the address above or use your current location. Coordinates are filled automatically.</p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locationLoading}
            className="primary-button mb-3 w-full py-3.5 text-sm disabled:opacity-60"
          >
            <MapPin className="h-5 w-5 shrink-0" />
            {locationLoading ? 'Getting location…' : 'Use my location'}
          </button>
          {locationError && (
            <p className="mb-3 text-xs text-amber-400">{locationError}</p>
          )}
          {lat && lng && !locationError && (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-400"><CheckCircle2 className="h-4 w-4" />Location set · {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Latitude <span className="font-normal">(advanced)</span></label>
              <input
                type="text"
                value={lat}
                onChange={(e) => {
                  setLat(e.target.value);
                  setAddressDirty(false);
                  setAddressMatch('');
                  if (fieldErrors.latitude) setFieldErrors((prev) => ({ ...prev, latitude: '' }));
                }}
                placeholder="Auto-filled"
                className={`mt-1 w-full rounded-2xl border bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                  fieldErrors.latitude ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500' : 'border-white/10 focus:border-accent-500 focus:ring-accent-500'
                }`}
              />
              {fieldErrors.latitude && (
                <p className="mt-1 text-xs text-amber-400">{fieldErrors.latitude}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Longitude <span className="font-normal">(advanced)</span></label>
              <input
                type="text"
                value={lng}
                onChange={(e) => {
                  setLng(e.target.value);
                  setAddressDirty(false);
                  setAddressMatch('');
                  if (fieldErrors.longitude) setFieldErrors((prev) => ({ ...prev, longitude: '' }));
                }}
                placeholder="Auto-filled"
                className={`mt-1 w-full rounded-2xl border bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                  fieldErrors.longitude ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500' : 'border-white/10 focus:border-accent-500 focus:ring-accent-500'
                }`}
              />
              {fieldErrors.longitude && (
                <p className="mt-1 text-xs text-amber-400">{fieldErrors.longitude}</p>
              )}
            </div>
          </div>
        </div>
        {showDetails && <>
        <div>
          <label className="block text-xs font-medium text-slate-500">Added by</label>
          {currentUserProfile?.username ? (
            <>
              <p className="mt-0.5 text-[11px] text-slate-500">This spot will show as added by your profile.</p>
              <div className="mt-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-accent-500/20">
                  {currentUserProfile?.avatar_url ? (
                    <img src={currentUserProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-accent-400"><User className="h-4 w-4" /></div>
                  )}
                </div>
                <span className="text-sm font-medium text-primary">
                  {(currentUserProfile.display_name || currentUserProfile.displayName || '').trim() || `@${currentUserProfile.username}`}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-[11px] text-slate-500">Show as &quot;Added by @handle&quot; or leave blank for Anonymous.</p>
              <div className="mt-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-accent-500/20">
                  <div className="flex h-full w-full items-center justify-center text-accent-400"><User className="h-4 w-4" /></div>
                </div>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  placeholder="e.g. yourname"
                  className="min-w-0 flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Best time (optional)</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Exact sunrise/golden/blue hour shown on spot page.</p>
          <input
            type="text"
            value={bestTime}
            onChange={(e) => setBestTime(e.target.value)}
            placeholder="e.g. Morning & evening, Sunset"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Crowd level (optional)</label>
          <div className="mt-1 flex gap-2">
            {['quiet', 'moderate', 'busy'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setCrowdLevel(crowdLevel === level ? '' : level)}
                className={`flex-1 rounded-2xl border py-2 text-xs font-medium capitalize transition ${
                  crowdLevel === level
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 bg-[var(--bg-input)] text-slate-400 hover:bg-white/5'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="automotive, urban, sunset"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Link (optional)</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Webcam, permit page, blog, etc.</p>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Link label (e.g. Webcam, More info)"
            className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[var(--bg-input)] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        </>}
        <div>
          <label className="block text-xs font-medium text-slate-500">Photos {editSpot ? '(optional)' : '*'}</label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {editSpot
              ? 'Add one or more shots; you can return and add more later.'
              : 'Add at least one photo of the spot. You can add more later.'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            aria-hidden
          />
          <div className="mt-1 flex flex-col gap-3">
            {images.map((img, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-[var(--bg-input)] p-2">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-800">
                  <img src={img.uri} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white hover:bg-black/80"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={img.photoBy || ''}
                  onChange={(e) => setPhotoBy(index, e.target.value)}
                  placeholder="Photo by (e.g. You, @handle)"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[var(--bg-input)] py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ImagePlus className="h-5 w-5" />
              {images.length === 0 ? 'Choose from phone' : 'Add another photo'}
            </button>
            {photoError && (
              <p className="text-xs text-red-400">{photoError}</p>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || addressSearching}
          className="primary-button w-full py-4 text-sm disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? (editSpot ? 'Saving…' : 'Adding…') : addressSearching ? 'Finding address…' : editSpot ? 'Save changes' : 'Add spot'}
        </button>
        {editSpot && saveFeedback === 'success' && (
          <p className="mt-2 text-center text-sm text-accent-400" role="status">
            Successfully saved.
          </p>
        )}
        {editSpot && saveFeedback === 'error' && (
          <p className="mt-2 text-center text-sm text-amber-400" role="alert">
            Failed to save. Check connection and try again.
          </p>
        )}
      </form>
    </div>
  );
}