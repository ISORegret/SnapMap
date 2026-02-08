import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, User, Pencil, X } from 'lucide-react';
import { getProfileByUsername, updateProfile, uploadAvatar } from '../api/profiles';
import { getFollowerCount, getFollowingCount, isFollowing, follow, unfollow } from '../api/follows';
import { getSpotPrimaryImage } from '../utils/spotImages';

function normalizeHandle(s) {
  return String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_');
}

export default function Profile({ allSpots = [], currentUser }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const avatarInputRef = React.useRef(null);

  const userSpots = useMemo(() => {
    if (!profile?.username || !allSpots.length) return [];
    const handle = profile.username;
    return allSpots.filter((s) => normalizeHandle(s.createdBy) === handle);
  }, [profile?.username, allSpots]);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getProfileByUsername(username).then((p) => {
      if (!cancelled) {
        setProfile(p);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    Promise.all([getFollowerCount(profile.id), getFollowingCount(profile.id)]).then(([fc, fg]) => {
      if (!cancelled) {
        setFollowerCount(fc);
        setFollowingCount(fg);
      }
    });
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !currentUser?.id || currentUser.id === profile.id) return;
    let cancelled = false;
    isFollowing(currentUser.id, profile.id).then((v) => {
      if (!cancelled) setFollowing(v);
    });
    return () => { cancelled = true; };
  }, [profile?.id, currentUser?.id]);

  const handleFollow = async () => {
    if (!profile?.id || followLoading) return;
    setFollowLoading(true);
    const ok = following ? await unfollow(profile.id) : await follow(profile.id);
    setFollowLoading(false);
    if (ok) {
      setFollowing(!following);
      setFollowerCount((c) => (following ? c - 1 : c + 1));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400">User not found.</p>
        <Link to="/" className="text-emerald-400 hover:underline">
          Back to For You
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  const startEditing = () => {
    setEditDisplayName(profile.display_name || profile.username || '');
    setEditBio(profile.bio || '');
    setEditAvatarUrl(profile.avatar_url || '');
    setEditError('');
    setEditing(true);
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type?.startsWith('image/')) return;
    setAvatarUploading(true);
    setEditError('');
    const url = await uploadAvatar(file);
    setAvatarUploading(false);
    if (url) {
      setEditAvatarUrl(url);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      await updateProfile({ avatarUrl: url });
    } else {
      setEditError('Upload failed. Try another image.');
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditError('');
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    const payload = {
      displayName: editDisplayName.trim() || profile.username,
      bio: editBio.trim().slice(0, 500),
    };
    if (editAvatarUrl.trim() !== (profile.avatar_url || '')) payload.avatarUrl = editAvatarUrl.trim() || null;
    const ok = await updateProfile(payload);
    setEditSaving(false);
    if (ok) {
      setProfile((p) => ({
        ...p,
        display_name: editDisplayName.trim() || profile.username,
        bio: editBio.trim().slice(0, 500),
        avatar_url: editAvatarUrl.trim() || p?.avatar_url,
      }));
      setEditing(false);
    } else {
      setEditError('Could not save. Try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0c0c0f] pb-6 animate-fade-in">
      <header className="border-b border-white/[0.06] px-4 py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-white">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-slate-500">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 text-sm text-slate-400">{profile.bio}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
              <span>{followerCount} followers</span>
              <span>{followingCount} following</span>
            </div>
            {isOwnProfile && (
              <button
                type="button"
                onClick={startEditing}
                className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-emerald-400"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
            )}
            {!isOwnProfile && currentUser && (
              <button
                type="button"
                onClick={handleFollow}
                disabled={followLoading}
                className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {followLoading ? '…' : following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
        {isOwnProfile && editing && (
          <form onSubmit={saveProfile} className="mt-6 rounded-xl border border-white/10 bg-[#18181b] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Edit profile</h2>
              <button type="button" onClick={cancelEditing} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cancel">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Profile picture</label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-emerald-500/20">
                    {(editAvatarUrl || profile.avatar_url) ? (
                      <img src={editAvatarUrl || profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-emerald-400"><User className="h-7 w-7" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="Image URL (optional)"
                      className="w-full rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleAvatarFile}
                        className="hidden"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        {avatarUploading ? 'Uploading…' : 'Upload photo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="profile-display-name" className="block text-xs font-medium text-slate-500">Display name</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={64}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="profile-bio" className="block text-xs font-medium text-slate-500">Bio</label>
                <textarea
                  id="profile-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Short bio (optional)"
                  rows={3}
                  maxLength={500}
                  className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[#0c0c0f] px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            {editError && <p className="mt-2 text-sm text-amber-400">{editError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancelEditing} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">
                Cancel
              </button>
            </div>
          </form>
        )}
      </header>

      <div className="px-4 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Spots ({userSpots.length})
        </h2>
        {userSpots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No spots yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {userSpots.map((spot) => (
              <li key={spot.id}>
                <Link
                  to={`/spot/${spot.id}`}
                  className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#18181b] p-3 transition hover:border-emerald-500/20 hover:bg-[#27272a]"
                >
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                    <img
                      src={getSpotPrimaryImage(spot)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{spot.name}</p>
                    {spot.address && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{spot.address}</span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
