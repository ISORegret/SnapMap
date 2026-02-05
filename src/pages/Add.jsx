import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { resizeImageToDataUrl } from '../utils/spotImages';

const MAX_IMAGE_DIM = 1200;
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80';

export default function Add({ onAdd }) {
  const location = useLocation();
  const fromMap = location.state?.lat != null && location.state?.lng != null;
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [parking, setParking] = useState('');
  const [howToAccess, setHowToAccess] = useState('');
  const [lat, setLat] = useState(() =>
    fromMap ? String(location.state.lat) : '37.8021'
  );
  const [lng, setLng] = useState(() =>
    fromMap ? String(location.state.lng) : '-122.4488'
  );
  const [bestTime, setBestTime] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('');
  const [images, setImages] = useState([]); // [{ uri, photoBy }]
  const [tags, setTags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [photoError, setPhotoError] = useState('');

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setPhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    resizeImageToDataUrl(file, MAX_IMAGE_DIM, 0.85)
      .then((dataUrl) => {
        setImages((prev) => [...prev, { uri: dataUrl, photoBy: 'You' }]);
      })
      .catch(() => setPhotoError('Could not load photo. Try another.'));
  };

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parseCoord = (value, fallback) => {
      const n = parseFloat(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const latitude = parseCoord(lat, 37.8);
    const longitude = parseCoord(lng, -122.4);
    const addressOrLocation = address.trim()
      || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const validImages = images
      .filter((img) => img?.uri && String(img.uri).trim())
      .map((img) => ({ uri: img.uri.trim(), photoBy: (img.photoBy || 'You').trim() }));
    const finalImages = validImages.length ? validImages : [{ uri: DEFAULT_IMAGE, photoBy: 'You' }];
    onAdd({
      name: name.trim(),
      description: description.trim() || '',
      address: addressOrLocation,
      parking: parking.trim() || '',
      howToAccess: howToAccess.trim() || '',
      latitude,
      longitude,
      bestTime: bestTime.trim() || 'Not specified',
      crowdLevel: crowdLevel === 'quiet' || crowdLevel === 'moderate' || crowdLevel === 'busy' ? crowdLevel : '',
      score: 0,
      tags: tags.trim() ? tags.split(',').map((t) => t.trim()) : [],
      images: finalImages,
      linkUrl: linkUrl.trim() || '',
      linkLabel: linkLabel.trim() || 'More info',
    });
  };

  return (
    <div className="mx-auto max-w-md bg-[#0c0c0f] px-4 pb-20 pt-5">
      <header className="border-b border-white/[0.06] pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Add a spot
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Data stays on your device.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spot name"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Short description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Iconic overlook with city views"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Parking (optional)</label>
          <input
            type="text"
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            placeholder="e.g. Street, free · Lot nearby"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        {fromMap && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            Location set from map pin — add a name and save.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Latitude</label>
            <input
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="37.8021"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Longitude</label>
            <input
              type="text"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-122.4488"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Best time (optional)</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Exact sunrise/golden/blue hour shown on spot page.</p>
          <input
            type="text"
            value={bestTime}
            onChange={(e) => setBestTime(e.target.value)}
            placeholder="e.g. Morning & evening, Sunset"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                className={`flex-1 rounded-xl border py-2 text-xs font-medium capitalize transition ${
                  crowdLevel === level
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/10 bg-[#18181b] text-slate-400 hover:bg-white/5'
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
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Link label (e.g. Webcam, More info)"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Photos</label>
          <p className="mt-0.5 text-[11px] text-slate-500">Add one or more shots; others can add theirs to the same spot later.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            aria-hidden
          />
          <div className="mt-1 flex flex-col gap-3">
            {images.map((img, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-[#18181b] p-2">
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
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0c0c0f] px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18181b] py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
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
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#0c0c0f]"
        >
          Add spot
        </button>
      </form>
    </div>
  );
}
