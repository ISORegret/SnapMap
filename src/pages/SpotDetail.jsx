import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, ExternalLink, Car, Sun, Cloud, Copy, Share2, Users, Navigation, Trash2 } from 'lucide-react';
import SunCalc from 'suncalc';
import { getSpotImages, getSpotPrimaryImage, resizeImageToDataUrl } from '../utils/spotImages';

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function SpotImageGallery({ images, spotName }) {
  const [index, setIndex] = React.useState(0);
  if (!images?.length) return null;
  const current = images[index] || images[0];
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-800">
      <img
        src={current.uri}
        alt={spotName}
        className="h-full w-full object-cover"
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
            Photo by {current.photoBy}
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
          <p className="text-[10px] text-slate-500">Wind {weather.wind_speed} km/h</p>
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
  const addPhotoInputRef = useRef(null);

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

  const CROWD_LABELS = { quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy' };
  const crowdLevel = spot.crowdLevel && CROWD_LABELS[spot.crowdLevel] ? spot.crowdLevel : null;
  const spotImages = getSpotImages(spot);

  const handleAddPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !isUserSpot(spot.id)) return;
    setAddPhotoLoading(true);
    resizeImageToDataUrl(file, 1200)
      .then((dataUrl) => {
        const current = getSpotImages(spot);
        updateSpot(spot.id, { images: [...current, { uri: dataUrl, photoBy: 'You' }] });
      })
      .finally(() => setAddPhotoLoading(false));
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6">
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
      {isUserSpot(spot.id) && (
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
        {(() => {
          const hasCoords = spot.latitude != null && spot.longitude != null;
          const locationText = (spot.address && spot.address !== 'Not specified')
            ? spot.address
            : (hasCoords ? `${Number(spot.latitude).toFixed(5)}, ${Number(spot.longitude).toFixed(5)}` : null);
          return locationText ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {locationText}
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

        {/* Share / Copy */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Share
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyCoords}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <Copy className="h-4 w-4" />
              {copyFeedback === 'coords' ? 'Copied!' : 'Copy coordinates'}
            </button>
            <button
              type="button"
              onClick={shareSpot}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181b] py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#27272a]"
            >
              <Share2 className="h-4 w-4" />
              {copyFeedback === 'link' ? 'Copied!' : 'Share spot'}
            </button>
          </div>
        </div>

        {/* Weather — in-app from Open-Meteo API (no key) */}
        <WeatherAtSpot latitude={latitude} longitude={longitude} />

        {/* Delete listing (user spots only) */}
        {isUserSpot(spot.id) && onDeleteSpot && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your listing
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this spot? This cannot be undone.')) {
                  onDeleteSpot(spot.id);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete listing
            </button>
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
