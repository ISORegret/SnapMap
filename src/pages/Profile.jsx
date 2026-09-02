import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, User, Pencil, X, Settings, UserPlus, UserCheck, Clock3, Users } from 'lucide-react';
import { getProfileByUsername, updateProfile, uploadAvatar } from '../api/profiles';
import { getFriendState, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, getFriendConnections } from '../api/follows';
import { getSpotPrimaryImage } from '../utils/spotImages';

function normalizeHandle(s) {
  return String(s || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_');
}

export default function Profile({ allSpots = [], currentUser, onProfileUpdated }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friendState, setFriendState] = useState('none');
  const [connections, setConnections] = useState({ friends: [], incoming: [], outgoing: [] });
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
    getFriendConnections(profile.id).then((result) => { if (!cancelled) setConnections(result); });
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !currentUser?.id || currentUser.id === profile.id) return;
    let cancelled = false;
    getFriendState(currentUser.id, profile.id).then((state) => {
      if (!cancelled) setFriendState(state);
    });
    return () => { cancelled = true; };
  }, [profile?.id, currentUser?.id]);

  const refreshConnections = async () => {
    if (!profile?.id) return;
    const result = await getFriendConnections(profile.id);
    setConnections(result);
    if (currentUser?.id && currentUser.id !== profile.id) {
      setFriendState(await getFriendState(currentUser.id, profile.id));
    }
  };

  const handleFriend = async () => {
    if (!profile?.id || followLoading) return;
    setFollowLoading(true);
    let ok = false;
    if (friendState === 'none') ok = await sendFriendRequest(profile.id);
    else if (friendState === 'incoming') ok = await acceptFriendRequest(profile.id);
    else if (friendState === 'outgoing') ok = await removeFriend(profile.id);
    else if (friendState === 'friends' && window.confirm(`Remove ${profile.display_name || profile.username} from your friends?`)) ok = await removeFriend(profile.id);
    setFollowLoading(false);
    if (ok) await refreshConnections();
  };

  const friendButton = {
    none: { label: 'Add friend', icon: UserPlus },
    outgoing: { label: 'Request sent', icon: Clock3 },
    incoming: { label: 'Accept request', icon: UserPlus },
    friends: { label: 'Friends', icon: UserCheck },
  }[friendState] || { label: 'Add friend', icon: UserPlus };
  const FriendButtonIcon = friendButton.icon;

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
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/" className="text-accent-400 hover:underline">Back to Map</Link>
          <Link to="/about" className="text-accent-400 hover:underline">About</Link>
          <Link to="/privacy" className="text-accent-400 hover:underline">Privacy</Link>
        </div>
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
      onProfileUpdated?.({ ...profile, avatar_url: url });
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
      const nextProfile = {
        ...profile,
        display_name: editDisplayName.trim() || profile.username,
        bio: editBio.trim().slice(0, 500),
        avatar_url: editAvatarUrl.trim() || profile.avatar_url,
      };
      setProfile((p) => ({
        ...p,
        ...nextProfile,
      }));
      onProfileUpdated?.(nextProfile);
      setEditing(false);
    } else {
      setEditError('Could not save. Try again.');
    }
  };

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.55rem] border border-accent-500/20 bg-accent-500/10 text-accent-400 shadow-glow-sm">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isOwnProfile && (
              <Link to="/settings" className="icon-button float-right" aria-label="Open settings">
                <Settings className="h-5 w-5" />
              </Link>
            )}
            <p className="eyebrow">Creator profile</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-slate-500">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 text-sm text-slate-400">{profile.bio}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
              <span>{connections.friends.length} friend{connections.friends.length === 1 ? '' : 's'}</span>
              {isOwnProfile && connections.incoming.length > 0 && <span className="font-semibold text-accent-400">{connections.incoming.length} request{connections.incoming.length === 1 ? '' : 's'}</span>}
            </div>
            {isOwnProfile && (
              <button
                type="button"
                onClick={startEditing}
                className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-accent-400"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </button>
            )}
            {!isOwnProfile && currentUser && (
              <button
                type="button"
                onClick={handleFriend}
                disabled={followLoading}
                className="primary-button mt-3 px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {!followLoading && <FriendButtonIcon className="h-4 w-4" />}
                {followLoading ? '…' : friendButton.label}
              </button>
            )}
          </div>
        </div>
        {isOwnProfile && editing && (
          <form onSubmit={saveProfile} className="surface-card mt-6 rounded-[1.5rem] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-primary">Edit profile</h2>
              <button type="button" onClick={cancelEditing} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cancel">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Profile picture</label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-accent-500/20">
                    {(editAvatarUrl || profile.avatar_url) ? (
                      <img src={editAvatarUrl || profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-accent-400"><User className="h-7 w-7" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="Image URL (optional)"
                      className="w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
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
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
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
                  className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-white placeholder-slate-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            </div>
            {editError && <p className="mt-2 text-sm text-amber-400">{editError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-2xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-400 disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancelEditing} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">
                Cancel
              </button>
            </div>
          </form>
        )}
      </header>

      {(connections.friends.length > 0 || (isOwnProfile && (connections.incoming.length > 0 || connections.outgoing.length > 0))) && (
        <section className="px-4 pt-5">
          {isOwnProfile && connections.incoming.length > 0 && (
            <div className="surface-card mb-5 rounded-[1.5rem] p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-accent-400" />
                <h2 className="text-sm font-extrabold text-primary">Friend requests</h2>
                <span className="ml-auto rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-extrabold text-[#211603]">{connections.incoming.length}</span>
              </div>
              <div className="space-y-2">
                {connections.incoming.map((creator) => (
                  <div key={creator.id} className="flex items-center gap-3 rounded-2xl bg-black/10 p-2.5">
                    <Link to={`/user/${creator.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                        {creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{creator.display_name || creator.username}</p><p className="truncate text-xs text-slate-500">@{creator.username}</p></div>
                    </Link>
                    <button type="button" onClick={async () => { await acceptFriendRequest(creator.id); refreshConnections(); }} className="rounded-xl bg-accent-500 px-3 py-2 text-xs font-extrabold text-[#211603]">Accept</button>
                    <button type="button" onClick={async () => { await declineFriendRequest(creator.id); refreshConnections(); }} className="rounded-xl border border-white/10 px-2.5 py-2 text-xs font-bold text-slate-500">Decline</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {connections.friends.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-accent-400" /><h2 className="text-sm font-extrabold text-primary">Friends</h2></div>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                {connections.friends.map((creator) => (
                  <Link key={creator.id} to={`/user/${creator.username}`} className="surface-card w-28 shrink-0 rounded-[1.35rem] p-3 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                      {creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}
                    </div>
                    <p className="mt-2 truncate text-xs font-extrabold text-primary">{creator.display_name || creator.username}</p>
                    <p className="truncate text-[10px] text-slate-500">@{creator.username}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isOwnProfile && connections.outgoing.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">Pending requests: {connections.outgoing.map((creator) => `@${creator.username}`).join(', ')}</p>
          )}
        </section>
      )}

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
                  className="flex gap-3 rounded-2xl border border-white/[0.06] bg-[var(--bg-card-solid)] p-3 transition hover:border-accent-500/20 hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                    <img
                      src={getSpotPrimaryImage(spot)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-primary">{spot.name}</p>
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
