import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function Add({ onAdd }) {
  const location = useLocation();
  const fromMap = location.state?.lat != null && location.state?.lng != null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(() =>
    fromMap ? String(location.state.lat) : '37.8021'
  );
  const [lng, setLng] = useState(() =>
    fromMap ? String(location.state.lng) : '-122.4488'
  );
  const [bestTime, setBestTime] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [photoBy, setPhotoBy] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parseCoord = (value, fallback) => {
      const n = parseFloat(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const latitude = parseCoord(lat, 37.8);
    const longitude = parseCoord(lng, -122.4);
    onAdd({
      name: name.trim(),
      description: description.trim() || '',
      address: address.trim() || 'Not specified',
      latitude,
      longitude,
      bestTime: bestTime.trim() || 'Not specified',
      score: 0,
      tags: tags.trim() ? tags.split(',').map((t) => t.trim()) : [],
      imageUri: imageUri.trim() || 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80',
      photoBy: photoBy.trim() || 'You',
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
          <label className="block text-xs font-medium text-slate-500">Best time</label>
          <input
            type="text"
            value={bestTime}
            onChange={(e) => setBestTime(e.target.value)}
            placeholder="e.g. Golden hour, Sunset"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
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
          <label className="block text-xs font-medium text-slate-500">Image URL</label>
          <input
            type="url"
            value={imageUri}
            onChange={(e) => setImageUri(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Photo by</label>
          <input
            type="text"
            value={photoBy}
            onChange={(e) => setPhotoBy(e.target.value)}
            placeholder="You"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
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
