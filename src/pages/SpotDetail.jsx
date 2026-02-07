import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, ExternalLink, Car, Sun, Cloud, Copy, Share2, Users, Navigation, Trash2, Image, Flag, Pencil } from 'lucide-react';
import SunCalc from 'suncalc';
import { toPng } from 'html-to-image';
import { getSpotImages, getSpotPrimaryImage, resizeImageToDataUrl } from '../utils/spotImages';
import { insertSpotReport, fetchSpotNotes, insertSpotNote } from '../api/spots';

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

function WeatherAtSpot({ latitude, longitude }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`;
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
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18181b] py-3 text-sm text-slate-500">
        <Cloud className="h-4 w-4 animate-pulse" />
        Loading weather…
      </div>
    );
  }
  if (error || !weather) {
    return (
      <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#18181b] py-3">
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
  const unit = '°F';
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#18181b] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Cloud className="h-5 w-5 text-slate-500" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-lg font-semibold text-white">{temp}{unit}</span>
        {weather.wind_speed != null && (
          <p className="text-[10px] text-slate-500">Wind {Math.round(weather.wind_speed * 0.621371)} mph</p>
        )}
      </div>
    </div>
  );
}

export default function SpotDetail({
  getSpotById,
  isUserSpot,
  isFavorite,
  toggleFavorite,
  updateSpot,
  onDeleteSpot,
  collections = [],
  addToCollection,
  removeFromCollection,
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
  const addPhotoInputRef = useRef(null);
  const shareCardRef = useRef(null);

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
        backgroundColor: '#0c0c0f',
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
  const canAddNotes = spot.id && !String(spot.id).startsWith('user-');

  useEffect(() => {
    if (!canAddNotes) return;
    fetchSpotNotes(spot.id).then(setNotes);
  }, [spot.id, canAddNotes]);

  const addNote = async () => {
    if (!canAddNotes || !noteText.trim() || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      const { note, error } = await insertSpotNote(spot.id, noteText.trim());
      if (note) {
        setNotes((prev) => [...prev, note]);
        setNoteText('');
      }
    } finally {
      setNoteSubmitting(false);
    }
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

  const canAddPhoto = isUserSpot(spot.id) || (spot.id && !String(spot.id).startsWith('user-'));
  const handleAddPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !canAddPhoto) return;
    setAddPhotoLoading(true);
    resizeImageToDataUrl(file, 1200)
      .then((dataUrl) => {
        const current = getSpotImages(spot);
        updateSpot(spot.id, { images: [...current, { uri: dataUrl, photoBy: 'You' }] });
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
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6 animate-fade-in">
      {/* Card for share-as-image: in-view but invisible so mobile WebView renders it */}
      <div
        ref={shareCardRef}
        className="fixed left-0 top-0 z-[-1] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#151a18] text-left opacity-0 pointer-events-none"
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
            <p className="mt-2 break-all text-[10px] text-emerald-500/90">
              Open in Maps: {mapsUrl}
            </p>
          )}
          <p className="mt-2 text-[10px] text-slate-600">SnapMap</p>
        </div>
      </div>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0c0c0f]/95 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(spot.id)}
          className="rounded-full p-2 text-white transition hover:bg-white/5"
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
            className="w-full rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {addPhotoLoading ? 'Adding…' : 'Add your photo to this spot'}
          </button>
        </div>
      )}
      <div className="px-4 pt-4">
        <h1 className="text-xl font-semibold text-white">{spot.name}</h1>
        {(spot.createdBy != null && String(spot.createdBy).trim()) ? (
          <p className="mt-1 text-xs text-slate-500">Added by @{String(spot.createdBy).trim()}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Added by Anonymous</p>
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
                className="rounded-full bg-[#27272a] px-2.5 py-1 text-xs text-slate-400"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] px-3 py-2 text-sm font-medium text-emerald-400 transition hover:bg-[#27272a]"
            >
              <ExternalLink className="h-4 w-4" />
              {spot.linkLabel && spot.linkLabel.trim() ? spot.linkLabel.trim() : 'More info'}
            </a>
          </div>
        )}

        {/* Sunrise / sunset / golden / blue hour at spot */}
        {sunTimes && (
          <div className="mt-4 rounded-xl border border-white/10 bg-[#18181b] p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sun className="h-4 w-4 text-amber-400" />
              Best light at this spot
            </div>
            <input
              type="date"
              value={sunDate}
              onChange={(e) => setSunDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0c0c0f] px-2 py-1.5 text-xs text-slate-300"
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
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-[#27272a]"
            >
              <ExternalLink className="h-4 w-4" />
              Google Maps
            </a>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <ExternalLink className="h-4 w-4" />
              Apple Maps
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <ExternalLink className="h-4 w-4" />
              Waze
            </a>
          </div>
        </div>

        {/* Community notes (cloud spots only) */}
        {canAddNotes && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Community notes
            </p>
            <ul className="mb-3 space-y-2 rounded-xl border border-white/10 bg-[#18181b] p-3">
              {notes.length === 0 ? (
                <li className="text-xs text-slate-500">No notes yet. Add one below.</li>
              ) : (
                notes.map((n) => (
                  <li key={n.id} className="border-b border-white/5 pb-2 last:border-0 last:pb-0 text-sm text-slate-300">
                    {n.body}
                    <span className="ml-1 text-[10px] text-slate-500">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
              />
              <button
                type="button"
                onClick={addNote}
                disabled={!noteText.trim() || noteSubmitting}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {noteSubmitting ? '…' : 'Add'}
              </button>
            </div>
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
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <Copy className="h-4 w-4" />
              {copyFeedback === 'coords' ? 'Copied!' : 'Copy coordinates'}
            </button>
            <button
              type="button"
              onClick={shareSpot}
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <Share2 className="h-4 w-4" />
              {copyFeedback === 'link' ? 'Copied!' : 'Share spot'}
            </button>
            <button
              type="button"
              onClick={shareAsImage}
              disabled={shareImageLoading}
              className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a] disabled:opacity-50"
            >
              <Image className="h-4 w-4" />
              {shareImageLoading ? 'Creating…' : 'Share as image'}
            </button>
            {shareImageError && (
              <p className="w-full text-center text-xs text-amber-400 mt-1">{shareImageError}</p>
            )}
          </div>
        </div>

        {/* Weather — in-app from Open-Meteo API (no key) */}
        <WeatherAtSpot latitude={latitude} longitude={longitude} />

        {/* Report / Wrong location (community spots only) */}
        {canReport && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Something wrong?
            </p>
            {reportSent ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-center text-sm text-emerald-400">
                Thanks, we&apos;ll look into it.
              </p>
            ) : !reportOpen ? (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-300"
              >
                <Flag className="h-4 w-4" />
                Report or wrong location
              </button>
            ) : (
              <div className="rounded-xl border border-white/10 bg-[#18181b] p-3 space-y-3">
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
                  className="w-full rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
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
                        ? 'bg-emerald-500/20 text-emerald-400'
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
    </div>
  );
}
