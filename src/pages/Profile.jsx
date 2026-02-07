import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, User } from 'lucide-react';
import { getProfileByUsername } from '../api/profiles';
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
