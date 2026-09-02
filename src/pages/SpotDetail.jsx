import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, ExternalLink, Car, Sun, Cloud, Copy, Share2, Users, User, Navigation, Trash2, Image, Flag, Pencil, Star, MessageCircle, Reply } from 'lucide-react';
import SunCalc from 'suncalc';
import { toPng } from 'html-to-image';
import { getSpotImages, getSpotPrimaryImage, resizeImageToDataUrl } from '../utils/spotImages';
import { haversineKm, kmToMi } from '../utils/geo';
import { insertSpotReport, fetchSpotNotes, insertSpotNote, deleteSpotNote } from '../api/spots';
import { getCheckInCount, hasCheckedIn, addCheckIn } from '../api/checkIns';
import { getSpotRating, getUserRating, setSpotRating } from '../api/ratings';
import { getDeviceId } from '../data/spotStore';
import { hasSupabase, supabase } from '../api/supabase';
import { getBlockedUserIds, reportComment } from '../api/safety';

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function SpotImageGallery({ images, spotName }) {
  const [index, setIndex] = React.useState(0);
  const touchStartX = React.useRef(0);
  const SWIPE_THRESHOLD = 50;
  if (!images?.length) return null;
  const current = images[index] || images[0];
  const goPrev = () => setIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_THRESHOLD) goPrev();
    else if (dx < -SWIPE_THRESHOLD) goNext();
  };
  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={current.uri}
          alt={spotName}
          className="h-full w-full object-cover select-none"
          draggable={false}
        />
        {images.length > 1 && (
          <>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition ${
                    i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
            <p className="absolute bottom-8 left-2 right-2 text-center text-[10px] text-white/80 drop-shadow">
              Photo by {current.photoBy} · {index + 1}/{images.length}
            </p>
          </>
        )}
        {images.length === 1 && current.photoBy && (
          <p className="absolute bottom-2 left-2 text-[10px] text-white/80 drop-shadow">
            Photo by {current.photoBy}
          </p>
        )}
      </div>
      {/* Thumbnail gallery - show all photos when more than one */}
      {images.length > 1 && (
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-medium text-slate-500 mb-2">Photos at this spot ({images.length})</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                  i === index ? 'border-accent-500' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img.uri} alt={`${spotName} photo ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Open-Meteo weather code → short label (WMO codes)
function weatherLabel(code) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Fog';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return '—';
}

function WeatherAtSpot({ latitude, longitude, units = 'mi' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const temperatureUnit = units === 'km' ? 'celsius' : 'fahrenheit';
    const windUnit = units === 'km' ? 'kmh' : 'mph';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=${temperatureUnit}&wind_speed_unit=${windUnit}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.current_weather) {
          setWeather(data.current_weather);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [latitude, longitude, retry]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-3 text-sm text-slate-500">
        <Cloud className="h-4 w-4 animate-pulse" />
        Loading weather…
      </div>
    );
  }
  if (error || !weather) {
    return (
      <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-3">
        <p className="text-center text-xs text-slate-500">
          Weather unavailable. Check connection or try again.
        </p>
        <button
          type="button"
          onClick={() => setRetry((r) => r + 1)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }
  const label = weatherLabel(weather.weather_code);
  const temp = Math.round(weather.temperature);
  const unit = units === 'km' ? '°C' : '°F';
  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Cloud className="h-5 w-5 text-slate-500" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-lg font-semibold text-primary">{temp}{unit}</span>
        {weather.wind_speed != null && (
          <p className="text-[10px] text-slate-500">Wind {Math.round(weather.wind_speed)} {units === 'km' ? 'km/h' : 'mph'}</p>
        )}
      </div>
    </div>
  );
}

function photoByLabel(profile) {
  if (!profile) return 'You';
  const name = (profile.display_name || profile.displayName || '').trim();
  if (name) return name;
  if (profile.username) return `@${profile.username}`;
  return 'You';
}

export default function SpotDetail({
  getSpotById,
  isUserSpot,
  isFavorite,
  toggleFavorite,
  updateSpot,
  onDeleteSpot,
  onDismissSpotError,
  collections = [],
  addToCollection,
  removeFromCollection,
  userPosition = null,
  units = 'mi',
  currentUser = null,
  currentUserProfile = null,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const spot = getSpotById(id);
  const [sunDate, setSunDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [addPhotoLoading, setAddPhotoLoading] = useState(false);
  const [shareImageLoading, setShareImageLoading] = useState(false);
  const [shareImageError, setShareImageError] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState('wrong_location');
  const [reportNote, setReportNote] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [reportedCommentIds, setReportedCommentIds] = useState([]);
  const [checkInCount, setCheckInCount] = useState(0);
  const [userHasCheckedIn, setUserHasCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [userRating, setUserRating] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const addPhotoInputRef = useRef(null);
  const shareCardRef = useRef(null);
  const conditionsRef = useRef(null);
  const visibleNotes = useMemo(() => notes.filter((note) => !blockedUserIds.includes(note.userId)), [notes, blockedUserIds]);
  const rootNotes = useMemo(() => visibleNotes.filter((note) => !note.parentId), [visibleNotes]);
  const repliesByParent = useMemo(() => {
    const grouped = {};
    visibleNotes.filter((note) => note.parentId).forEach((note) => {
      if (!grouped[note.parentId]) grouped[note.parentId] = [];
      grouped[note.parentId].push(note);
    });
    return grouped;
  }, [visibleNotes]);

  useEffect(() => {
    if (currentUser?.id) getBlockedUserIds().then(setBlockedUserIds);
    else setBlockedUserIds([]);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!spot?.id || !hasSupabase) return;
    let cancelled = false;
    Promise.all([getCheckInCount(spot.id), hasCheckedIn(spot.id, getDeviceId())]).then(([count, has]) => {
      if (!cancelled) {
        setCheckInCount(count);
        setUserHasCheckedIn(has);
      }
    });
    return () => { cancelled = true; };
  }, [spot?.id]);

  useEffect(() => {
    if (!spot?.id || !hasSupabase) return;
    let cancelled = false;
    Promise.all([getSpotRating(spot.id), getUserRating(spot.id, getDeviceId())]).then(([r, ur]) => {
      if (!cancelled) {
        setRating(r);
        setUserRating(ur);
      }
    });
    return () => { cancelled = true; };
  }, [spot?.id]);

  const sunTimes = useMemo(() => {
    if (!spot?.latitude || !spot?.longitude) return null;
    const d = new Date(sunDate);
    const times = SunCalc.getTimes(d, spot.latitude, spot.longitude);
    const { sunrise, sunset, dawn, dusk, goldenHour, goldenHourEnd } = times;
    // Golden hour AM: sunrise → goldenHourEnd (soft morning light)
    // Golden hour PM: goldenHour → sunset (soft evening light)
    // Blue hour AM: dawn → sunrise
    // Blue hour PM: sunset → dusk
    return {
      sunrise: formatTime(sunrise),
      sunset: formatTime(sunset),
      goldenAmStart: formatTime(sunrise),
      goldenAmEnd: formatTime(goldenHourEnd),
      goldenPmStart: formatTime(goldenHour),
      goldenPmEnd: formatTime(sunset),
      blueAmStart: formatTime(dawn),
      blueAmEnd: formatTime(sunrise),
      bluePmStart: formatTime(sunset),
      bluePmEnd: formatTime(dusk),
    };
  }, [spot?.latitude, spot?.longitude, sunDate]);

  const canAddNotes = spot?.id && !String(spot.id).startsWith('user-');
  useEffect(() => {
    if (!canAddNotes) return;
    let cancelled = false;
    const refreshNotes = () => fetchSpotNotes(spot.id).then((nextNotes) => {
      if (!cancelled) setNotes(nextNotes);
    });
    refreshNotes();
    if (!hasSupabase) return () => { cancelled = true; };
    const channel = supabase
      .channel(`spot-discussion-${spot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_notes', filter: `spot_id=eq.${spot.id}` }, refreshNotes)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [spot?.id, canAddNotes]);

  if (!spot) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400">Spot not found.</p>
        <Link to="/" className="text-accent">
          Back
        </Link>
      </div>
    );
  }

  const { latitude, longitude } = spot;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${latitude},${longitude}`;
  const wazeUrl = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
  const otherCollections = collections.filter((c) => c.id !== 'favorites');
  const isInCollection = (collId) => collections.find((c) => c.id === collId)?.spotIds?.includes(spot.id) ?? false;

  const spotUrl = `${window.location.origin}${window.location.pathname || ''}#/spot/${spot.id}`;
  const coordsText = `${latitude}, ${longitude}`;
  const copyCoords = () => {
    navigator.clipboard.writeText(coordsText).then(() => {
      setCopyFeedback('coords');
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };
  const copyLink = () => {
    navigator.clipboard.writeText(spotUrl).then(() => {
      setCopyFeedback('link');
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };
  const shareSpot = () => {
    if (navigator.share) {
      navigator.share({ title: spot.name, url: spotUrl, text: spot.description || spot.name }).catch(() => copyLink());
    } else {
      copyLink();
    }
  };

  const shareAsImage = async () => {
    if (!shareCardRef.current || shareImageLoading) return;
    setShareImageError(null);
    setShareImageLoading(true);
    try {
      const primaryImage = getSpotPrimaryImage(spot);
      const imgEl = shareCardRef.current.querySelector('img');
      if (imgEl && primaryImage && (primaryImage.startsWith('http:') || primaryImage.startsWith('https:'))) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const proxyUrl =
          supabaseUrl && supabaseKey
            ? `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(primaryImage)}`
            : null;
        const tryFetch = (url, opts) =>
          fetch(url, opts)
            .then((r) => {
              if (!r.ok) throw new Error(r.status);
              return r.blob();
            })
            .then(
              (blob) =>
                new Promise((res, rej) => {
                  const reader = new FileReader();
                  reader.onload = () => res(reader.result);
                  reader.onerror = rej;
                  reader.readAsDataURL(blob);
                })
            );
        const proxyOpts = proxyUrl && supabaseKey
          ? { mode: 'cors', headers: { Authorization: `Bearer ${supabaseKey}` } }
          : null;
        const tryProxy = () => proxyUrl && proxyOpts ? tryFetch(proxyUrl, proxyOpts) : null;
        const tryDirect = () => tryFetch(primaryImage, { mode: 'cors' });
        let imageDataUrl = null;
        if (primaryImage.includes('supabase.co') && proxyUrl) {
          try {
            imageDataUrl = await tryProxy();
          } catch {
            // ignore
          }
          if (!imageDataUrl) {
            try {
              imageDataUrl = await tryDirect();
            } catch {
              // leave null
            }
          }
        } else {
          try {
            imageDataUrl = await tryDirect();
          } catch {
            if (proxyUrl) {
              try {
                imageDataUrl = await tryProxy();
              } catch {
                // leave null
              }
            }
          }
        }
        if (imageDataUrl) {
          imgEl.src = imageDataUrl;
          await new Promise((resolve, reject) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = reject;
            if (imgEl.complete && imgEl.naturalWidth) resolve();
          });
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      const card = shareCardRef.current;
      const prevOpacity = card.style.opacity;
      const prevZIndex = card.style.zIndex;
      card.style.opacity = '1';
      card.style.zIndex = '99999';
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      const dataUrl = await toPng(card, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0f0e12',
      });
      card.style.opacity = prevOpacity;
      card.style.zIndex = prevZIndex;
      const base64 = dataUrl.split(',')[1];
      if (!base64) throw new Error('Failed to create image');

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const fileName = `snapmap-${(spot.name || 'spot').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 30)}.png`;
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        const shareText = [spot.name, spot.address || locationText, mapsUrl ? `Open in Maps: ${mapsUrl}` : null]
          .filter(Boolean)
          .join('\n');
        await Share.share({
          url: uri,
          title: spot.name,
          text: shareText,
          dialogTitle: 'Share spot',
        });
      } else {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `snapmap-${(spot.name || 'spot').replace(/\s+/g, '-').slice(0, 30)}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          const shareText = [spot.name, spot.address || locationText, mapsUrl ? `Open in Maps: ${mapsUrl}` : null]
            .filter(Boolean)
            .join('\n');
          await navigator.share({ files: [file], title: spot.name, text: shareText });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }
    } catch (e) {
      console.warn('Share as image failed', e);
      setShareImageError(e?.message || 'Could not share image');
    } finally {
      setShareImageLoading(false);
    }
  };

  const canReport = spot.id && !String(spot.id).startsWith('user-');

  const addNote = async () => {
    if (!canAddNotes || !noteText.trim() || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      const { note } = await insertSpotNote(spot.id, noteText.trim(), replyTo?.id || null);
      if (note) {
        setNotes((prev) => [...prev, note]);
        setNoteText('');
        setReplyTo(null);
      }
    } finally {
      setNoteSubmitting(false);
    }
  };

  const removeComment = async (noteId) => {
    if (!window.confirm('Delete this comment?')) return;
    const ok = await deleteSpotNote(noteId);
    if (ok) setNotes((prev) => prev.filter((note) => note.id !== noteId && note.parentId !== noteId));
  };

  const flagComment = async (comment) => {
    if (!currentUser || reportedCommentIds.includes(comment.id)) return;
    if (!window.confirm('Report this comment for review?')) return;
    const ok = await reportComment(comment.id);
    if (ok) setReportedCommentIds((ids) => [...ids, comment.id]);
  };

  const sendReport = async () => {
    if (!canReport) return;
    const { ok } = await insertSpotReport(spot.id, reportType, reportNote);
    if (ok) {
      setReportSent(true);
      setReportOpen(false);
      setReportNote('');
      setReportType('wrong_location');
    }
  };

  const CROWD_LABELS = { quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy' };
  const crowdLevel = spot.crowdLevel && CROWD_LABELS[spot.crowdLevel] ? spot.crowdLevel : null;
  const spotImages = getSpotImages(spot);

  const canAddPhoto = isUserSpot(spot.id);
  const handleAddPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !canAddPhoto) return;
    setAddPhotoLoading(true);
    const attributedTo = photoByLabel(currentUserProfile);
    resizeImageToDataUrl(file, 1200)
      .then((dataUrl) => {
        const current = getSpotImages(spot);
        updateSpot(spot.id, { images: [...current, { uri: dataUrl, photoBy: attributedTo }] });
      })
      .finally(() => setAddPhotoLoading(false));
  };

  const primaryImage = getSpotPrimaryImage(spot);
    const locationText = (spot.address && spot.address !== 'Not specified')
      ? spot.address
      : (latitude != null && longitude != null ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}` : '');
    const mapsUrl =
      latitude != null && longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latitude + ',' + longitude)}`
        : null;

    return (
    <div className="page-shell pb-48 animate-fade-in">
      {(spot.syncError || spot.uploadError) && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-950/95 px-3 py-2 text-sm text-amber-200 backdrop-blur-sm">
          <span>{spot.syncError ? "Edit didn't sync to cloud." : `Couldn't sync: ${spot.uploadError}`}</span>
          {onDismissSpotError && (
            <button
              type="button"
              onClick={() => onDismissSpotError(spot.id)}
              className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      {/* Card for share-as-image: in-view but invisible so mobile WebView renders it */}
      <div
        ref={shareCardRef}
        className="fixed left-0 top-0 z-[-1] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] text-left opacity-0 pointer-events-none"
        style={{ fontFamily: 'system-ui, sans-serif' }}
        aria-hidden
      >
        <div className="aspect-[4/3] w-full bg-slate-800">
          <img src={primaryImage} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
        </div>
        <div className="px-4 py-3">
          <h2 className="text-lg font-semibold text-white">{spot.name}</h2>
          {locationText && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {locationText}
            </p>
          )}
          {spot.bestTime && spot.bestTime !== 'Not specified' && (
            <p className="mt-1 text-xs text-slate-500">Best time: {spot.bestTime}</p>
          )}
          {mapsUrl && (
            <p className="mt-2 break-all text-[10px] text-accent-500/90">
              Open in Maps: {mapsUrl}
            </p>
          )}
          <p className="mt-2 text-[10px] text-slate-600">SnapMap</p>
        </div>
      </div>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-nav)] px-4 py-3 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="icon-button gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(spot.id)}
          className="icon-button h-10 w-10 rounded-2xl"
          aria-label={isFavorite(spot.id) ? 'Unsave' : 'Save'}
        >
          <Heart
            className="h-5 w-5"
            fill={isFavorite(spot.id) ? '#f43f5e' : 'transparent'}
            stroke={isFavorite(spot.id) ? '#f43f5e' : 'currentColor'}
            strokeWidth={2}
          />
        </button>
      </header>
      <SpotImageGallery images={spotImages} spotName={spot.name} />
      {canAddPhoto && (
        <div className="px-4 pt-2">
          <input
            ref={addPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleAddPhoto}
            className="hidden"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => addPhotoInputRef.current?.click()}
            disabled={addPhotoLoading}
            className="w-full rounded-2xl border border-dashed border-accent-500/40 bg-accent-500/5 py-2.5 text-sm font-medium text-accent-400 transition hover:bg-accent-500/10 disabled:opacity-50"
          >
            {addPhotoLoading ? 'Adding…' : 'Add your photo to this spot'}
          </button>
        </div>
      )}
      <div className="px-4 pt-4">
        <h1 className="text-xl font-semibold text-primary">{spot.name}</h1>
        {userPosition && spot.latitude != null && spot.longitude != null && (
          <p className="mt-1 text-sm text-accent-400">
            {units === 'km'
              ? (haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude)).toFixed(1) + ' km away'
              : (kmToMi(haversineKm(userPosition.lat, userPosition.lng, spot.latitude, spot.longitude))).toFixed(1) + ' mi away'}
          </p>
        )}
        {(spot.createdBy != null && String(spot.createdBy).trim()) || (spot.createdByDisplayName != null && String(spot.createdByDisplayName).trim()) ? (
          <p className="mt-1 text-xs text-slate-500">
            Added by{' '}
            {(spot.createdBy != null && String(spot.createdBy).trim()) ? (
              <Link
                to={`/user/${encodeURIComponent(String(spot.createdBy).trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_'))}`}
                className="text-accent-400 hover:underline"
              >
                @{String(spot.createdBy).trim()}
              </Link>
            ) : (
              <span className="text-slate-400">{String(spot.createdByDisplayName).trim()}</span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Added by Anonymous</p>
        )}
        {(spot.lastEditedBy != null && String(spot.lastEditedBy).trim()) ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Last edited by{' '}
            <Link
              to={`/user/${encodeURIComponent(String(spot.lastEditedBy).trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_'))}`}
              className="text-accent-400 hover:underline"
            >
              @{String(spot.lastEditedBy).trim()}
            </Link>
          </p>
        ) : null}
        {hasSupabase && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0 text-accent-500/80" />
              {checkInCount === 0
                ? 'No check-ins yet'
                : checkInCount === 1
                  ? '1 person has been here'
                  : `${checkInCount} people have been here`}
            </span>
            {!userHasCheckedIn ? (
              <button
                type="button"
                onClick={async () => {
                  setCheckInLoading(true);
                  const result = await addCheckIn(spot.id, getDeviceId());
                  setCheckInLoading(false);
                  if (result.ok) {
                    setUserHasCheckedIn(true);
                    setCheckInCount((c) => c + 1);
                  }
                }}
                disabled={checkInLoading}
                className="shrink-0 rounded-lg bg-accent-500/20 px-3 py-1.5 text-xs font-medium text-accent-400 transition hover:bg-accent-500/30 disabled:opacity-50"
              >
                {checkInLoading ? '…' : 'I was here'}
              </button>
            ) : (
              <span className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-400">You&apos;ve been here</span>
            )}
          </div>
        )}
        {hasSupabase && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">Rating:</span>
            <div className="flex items-center gap-0.5" role="group" aria-label="Rate this spot">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={async () => {
                    setRatingLoading(true);
                    const ok = await setSpotRating(spot.id, getDeviceId(), star);
                    setRatingLoading(false);
                    if (ok) {
                      setUserRating(star);
                      const r = await getSpotRating(spot.id);
                      setRating(r);
                    }
                  }}
                  disabled={ratingLoading}
                  className="rounded p-0.5 text-amber-400 transition hover:scale-110 disabled:opacity-50"
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className="h-5 w-5"
                    fill={userRating != null && star <= userRating ? 'currentColor' : 'transparent'}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500">
              {rating.count === 0 ? 'No ratings yet' : `${rating.average.toFixed(1)} (${rating.count})`}
            </span>
          </div>
        )}
        {(() => {
          const hasCoords = spot.latitude != null && spot.longitude != null;
          const locText = (spot.address && spot.address !== 'Not specified')
            ? spot.address
            : (hasCoords ? `${Number(spot.latitude).toFixed(5)}, ${Number(spot.longitude).toFixed(5)}` : null);
          return locText ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {locText}
            </p>
          ) : null;
        })()}
        {spot.parking && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <Car className="h-4 w-4 shrink-0" />
            {spot.parking}
          </p>
        )}
        {spot.howToAccess && spot.howToAccess.trim() && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <Navigation className="h-4 w-4 shrink-0" />
            {spot.howToAccess.trim()}
          </p>
        )}
        {spot.description && (
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">{spot.description}</p>
        )}
        {(spot.score != null && spot.score > 0) && (
          <p className="mt-2 text-sm text-slate-500">Score {spot.score}</p>
        )}
        {crowdLevel && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="h-4 w-4 shrink-0" />
            {CROWD_LABELS[crowdLevel]}
          </p>
        )}
        {spot.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {spot.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--bg-card-hover)] px-2.5 py-1 text-xs text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Optional link (webcam, permit, more info) */}
        {spot.linkUrl && spot.linkUrl.trim() && (
          <div className="mt-3">
            <a
              href={spot.linkUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] px-3 py-2 text-sm font-medium text-accent-400 transition hover:bg-[var(--bg-card-hover)]"
            >
              <ExternalLink className="h-4 w-4" />
              {spot.linkLabel && spot.linkLabel.trim() ? spot.linkLabel.trim() : 'More info'}
            </a>
          </div>
        )}

        {/* Shoot planning: light and current weather */}
        <section ref={conditionsRef} className="mt-5 scroll-mt-20">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="eyebrow">Shoot planning</p>
              <h2 className="mt-1 text-base font-extrabold text-primary">Light & conditions</h2>
            </div>
            <Sun className="h-5 w-5 text-amber-400" />
          </div>
        {sunTimes && (
          <div className="rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sun className="h-4 w-4 text-amber-400" />
              Best light at this spot
            </div>
            <input
              type="date"
              value={sunDate}
              onChange={(e) => setSunDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-2 py-1.5 text-xs text-slate-300"
            />
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>Sunrise {sunTimes.sunrise}</li>
              <li>Sunset {sunTimes.sunset}</li>
              <li className="text-amber-400/90">
                Golden hour (AM) {sunTimes.goldenAmStart} – {sunTimes.goldenAmEnd}
              </li>
              <li className="text-amber-400/90">
                Golden hour (PM) {sunTimes.goldenPmStart} – {sunTimes.goldenPmEnd}
              </li>
              <li className="text-sky-400/90">
                Blue hour (AM) {sunTimes.blueAmStart} – {sunTimes.blueAmEnd}
              </li>
              <li className="text-sky-400/90">
                Blue hour (PM) {sunTimes.bluePmStart} – {sunTimes.bluePmEnd}
              </li>
            </ul>
          </div>
        )}
        <WeatherAtSpot latitude={latitude} longitude={longitude} units={units} />
        </section>

        {/* Directions */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Directions
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-accent-400 transition hover:bg-[var(--bg-card-hover)]"
            >
              <ExternalLink className="h-4 w-4" />
              Google Maps
            </a>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[var(--bg-card-hover)]"
            >
              <ExternalLink className="h-4 w-4" />
              Apple Maps
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[var(--bg-card-hover)]"
            >
              <ExternalLink className="h-4 w-4" />
              Waze
            </a>
          </div>
        </div>

        {/* Creator discussion (cloud spots only) */}
        {canAddNotes && (
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-accent-400" />
              <div><p className="eyebrow">At this location</p><h2 className="mt-0.5 text-base font-extrabold text-primary">Creator discussion</h2></div>
              <span className="ml-auto rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-slate-500">{notes.length}</span>
            </div>
            <div className="surface-card mb-3 space-y-3 rounded-[1.5rem] p-3">
              {rootNotes.length === 0 ? (
                <p className="px-2 py-5 text-center text-xs text-slate-500">No comments yet. Start the conversation about access, lighting, or current conditions.</p>
              ) : rootNotes.map((note) => {
                const creator = note.profile;
                const replies = repliesByParent[note.id] || [];
                const renderComment = (comment, nested = false) => {
                  const author = comment.profile;
                  return (
                    <div key={comment.id} className={`flex gap-3 ${nested ? 'ml-8 border-l border-white/10 pl-3 pt-2' : 'border-b border-white/[0.06] pb-3 last:border-0'}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                        {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {author?.username ? <Link to={`/user/${author.username}`} className="text-xs font-extrabold text-primary hover:text-accent-400">{author.display_name || author.username}</Link> : <span className="text-xs font-extrabold text-primary">Community member</span>}
                          <span className="text-[10px] text-slate-500">{comment.createdAt ? new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">{comment.body}</p>
                        <div className="mt-1.5 flex items-center gap-3">
                          {!nested && currentUser && <button type="button" onClick={() => { setReplyTo(note); setNoteText(''); }} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-accent-400"><Reply className="h-3 w-3" />Reply</button>}
                          {comment.userId === currentUser?.id && <button type="button" onClick={() => removeComment(comment.id)} className="text-[11px] font-bold text-slate-500 hover:text-rose-400">Delete</button>}
                          {currentUser && comment.userId && comment.userId !== currentUser.id && <button type="button" onClick={() => flagComment(comment)} disabled={reportedCommentIds.includes(comment.id)} className="text-[11px] font-bold text-slate-500 hover:text-amber-400 disabled:opacity-60">{reportedCommentIds.includes(comment.id) ? 'Reported' : 'Report'}</button>}
                        </div>
                      </div>
                    </div>
                  );
                };
                return <div key={note.id}>{renderComment(note)}{replies.map((reply) => renderComment(reply, true))}</div>;
              })}
            </div>
            {currentUser ? (
              <div className="surface-card rounded-[1.35rem] p-3">
                {replyTo && <div className="mb-2 flex items-center justify-between rounded-xl bg-accent-500/10 px-3 py-2 text-xs text-accent-400"><span>Replying to {replyTo.profile?.display_name || replyTo.profile?.username || 'comment'}</span><button type="button" onClick={() => setReplyTo(null)} className="font-extrabold">Cancel</button></div>}
                <div className="flex gap-2">
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={replyTo ? 'Write a reply…' : 'Share access tips, conditions, or a question…'} rows={2} maxLength={1000} className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-primary placeholder-slate-500 focus:border-accent-500 focus:outline-none" />
                  <button type="button" onClick={addNote} disabled={!noteText.trim() || noteSubmitting} className="primary-button self-end px-4 py-2.5 text-xs disabled:opacity-50">{noteSubmitting ? '…' : replyTo ? 'Reply' : 'Post'}</button>
                </div>
              </div>
            ) : (
              <Link to="/signin" className="surface-card block rounded-[1.35rem] px-4 py-3 text-center text-sm font-bold text-accent-400">Sign in to join the discussion</Link>
            )}
          </div>
        )}

        {/* Share / Copy */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Share
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyCoords}
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[var(--bg-card-hover)]"
            >
              <Copy className="h-4 w-4" />
              {copyFeedback === 'coords' ? 'Copied!' : 'Copy coordinates'}
            </button>
            <button
              type="button"
              onClick={shareSpot}
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[var(--bg-card-hover)]"
            >
              <Share2 className="h-4 w-4" />
              {copyFeedback === 'link' ? 'Copied!' : 'Share spot'}
            </button>
            <button
              type="button"
              onClick={shareAsImage}
              disabled={shareImageLoading}
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
            >
              <Image className="h-4 w-4" />
              {shareImageLoading ? 'Creating…' : 'Share as image'}
            </button>
            {shareImageError && (
              <p className="w-full text-center text-xs text-amber-400 mt-1">{shareImageError}</p>
            )}
          </div>
        </div>

        {/* Report / Wrong location (community spots only) */}
        {canReport && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Something wrong?
            </p>
            {reportSent ? (
              <p className="rounded-2xl border border-accent-500/30 bg-accent-500/10 py-2.5 text-center text-sm text-accent-400">
                Thanks, we&apos;ll look into it.
              </p>
            ) : !reportOpen ? (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-300"
              >
                <Flag className="h-4 w-4" />
                Report or wrong location
              </button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[var(--bg-card-solid)] p-3 space-y-3">
                <p className="text-xs text-slate-500">What&apos;s wrong?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReportType('wrong_location')}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      reportType === 'wrong_location' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Wrong location
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('other')}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      reportType === 'other' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Other
                  </button>
                </div>
                <input
                  type="text"
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Optional note"
                  className="w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setReportOpen(false); setReportNote(''); }}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-slate-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendReport}
                    className="flex-1 rounded-lg bg-amber-500/20 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
                  >
                    Send report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit / Delete (user spots only) */}
        {isUserSpot(spot.id) && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your listing
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/add', { state: { editSpot: spot } })}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-accent-500/30 bg-accent-500/10 py-2.5 text-sm font-medium text-accent-400 transition hover:bg-accent-500/20"
              >
                <Pencil className="h-4 w-4" />
                Edit spot
              </button>
              {onDeleteSpot && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this spot? This cannot be undone.')) {
                      onDeleteSpot(spot.id);
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add to collection */}
        {otherCollections.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Add to list
            </p>
            <div className="flex flex-wrap gap-2">
              {otherCollections.map((coll) => {
                const inColl = isInCollection(coll.id);
                return (
                  <button
                    key={coll.id}
                    type="button"
                    onClick={() => (inColl ? removeFromCollection(coll.id, spot.id) : addToCollection(coll.id, spot.id))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      inColl
                        ? 'bg-accent-500/20 text-accent-400'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                    }`}
                  >
                    {inColl ? '✓ ' : ''}{coll.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {spot.photoBy && (
          <p className="mt-3 text-xs text-slate-500">Photo: {spot.photoBy}</p>
        )}
      </div>
      <div className="fixed bottom-[6.7rem] left-3 right-3 z-[1040] mx-auto max-w-lg rounded-[1.45rem] border border-white/10 bg-[var(--bg-nav)] p-1.5 shadow-2xl backdrop-blur-2xl">
        <div className="grid grid-cols-4 gap-1">
          <button type="button" onClick={() => toggleFavorite(spot.id)} className={`flex flex-col items-center gap-1 rounded-[1.05rem] py-2 text-[10px] font-extrabold ${isFavorite(spot.id) ? 'bg-accent-500 text-[#211603]' : 'text-secondary hover:bg-white/5'}`}>
            <Heart className="h-4 w-4" fill={isFavorite(spot.id) ? 'currentColor' : 'none'} />
            {isFavorite(spot.id) ? 'Saved' : 'Save'}
          </button>
          <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-[1.05rem] py-2 text-[10px] font-extrabold text-secondary hover:bg-white/5">
            <Navigation className="h-4 w-4" />
            Directions
          </a>
          <button type="button" onClick={() => conditionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex flex-col items-center gap-1 rounded-[1.05rem] py-2 text-[10px] font-extrabold text-secondary hover:bg-white/5">
            <Sun className="h-4 w-4" />
            Plan
          </button>
          <button type="button" onClick={shareSpot} className="flex flex-col items-center gap-1 rounded-[1.05rem] py-2 text-[10px] font-extrabold text-secondary hover:bg-white/5">
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
