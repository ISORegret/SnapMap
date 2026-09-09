import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Camera, MapPin, MessageCircle, Pencil, Share2, User, Users } from 'lucide-react';
import { getSpotPrimaryImage } from '../../utils/spotImages';
import ProfileSocialLinks from './ProfileSocialLinks';

export default function CreatorPortfolio({ profile, profileDisplayName, profilePosts, featuredPosts, userSpots, profileEvents, specialties, isOwnProfile, currentUser, blocked, friendState, followLoading, friendButton, FriendButtonIcon, onBack, onShare, onFriend }) {
  const heroImage = featuredPosts[0]?.images?.[0]?.public_url || (userSpots[0] ? getSpotPrimaryImage(userSpots[0]) : '');
  return (
    <div className="page-shell pb-28 animate-fade-in">
      <header className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-page-elevated)]">
        <div className="relative h-[19rem] sm:h-[24rem]">
          {heroImage ? <img src={heroImage} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-accent-500/25 via-[var(--bg-page-elevated)] to-cyan-400/10" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-page)] via-black/25 to-black/55" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button type="button" onClick={onBack} className="flex h-11 items-center gap-1.5 rounded-2xl border border-white/15 bg-black/35 px-3 text-sm font-bold text-white backdrop-blur-xl"><ArrowLeft className="h-5 w-5" />Back</button>
            <Link to={`/user/${profile.username}`} replace className="rounded-2xl border border-white/15 bg-black/35 px-3.5 py-3 text-xs font-extrabold text-white backdrop-blur-xl">Community profile</Link>
          </div>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-5 pb-6 md:px-8">
            <div className="flex items-end gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.8rem] border-2 border-accent-400/50 bg-[var(--bg-card-solid)] text-accent-400 shadow-2xl">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-9 w-9" />}</div>
              <div className="min-w-0 pb-1"><p className="eyebrow text-accent-300">Creator portfolio</p><h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-4xl">{profileDisplayName}</h1><p className="mt-1 text-sm font-semibold text-white/60">Creator on SnapMap</p></div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6 md:px-8">
        <section>
          {profile.bio && <p className="max-w-2xl text-base leading-7 text-secondary">{profile.bio}</p>}
          <ProfileSocialLinks links={profile.social_links} className="mt-4" />
          {specialties.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{specialties.map((item) => <span key={item} className="rounded-full border border-accent-500/20 bg-accent-500/[0.07] px-3 py-2 text-xs font-extrabold text-accent-400">{item}</span>)}</div>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onShare} className="primary-button px-4 py-3 text-sm"><Share2 className="h-4 w-4" />Share portfolio</button>
            {isOwnProfile ? <Link to={`/user/${profile.username}`} className="flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] px-4 py-3 text-sm font-extrabold text-secondary"><Pencil className="h-4 w-4" />Edit profile</Link> : currentUser && !blocked && <button type="button" onClick={onFriend} disabled={followLoading} className="flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] px-4 py-3 text-sm font-extrabold text-secondary disabled:opacity-50"><FriendButtonIcon className="h-4 w-4" />{followLoading ? 'Working…' : friendButton.label}</button>}
            {!isOwnProfile && currentUser && friendState === 'friends' && <Link to={`/messages/${profile.username}`} className="flex items-center gap-2 rounded-2xl border border-accent-500/20 px-4 py-3 text-sm font-extrabold text-accent-400"><MessageCircle className="h-4 w-4" />Message</Link>}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <div className="surface-card rounded-[1.35rem] p-4 text-center"><p className="text-2xl font-black text-primary">{profilePosts.length}</p><p className="mt-1 text-xs font-bold text-muted">Posts</p></div>
          <div className="surface-card rounded-[1.35rem] p-4 text-center"><p className="text-2xl font-black text-primary">{userSpots.length}</p><p className="mt-1 text-xs font-bold text-muted">Spots</p></div>
          <div className="surface-card rounded-[1.35rem] p-4 text-center"><p className="text-2xl font-black text-primary">{profileEvents.length}</p><p className="mt-1 text-xs font-bold text-muted">Events</p></div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="eyebrow">Selected work</p><h2 className="mt-1 text-xl font-extrabold text-primary">Featured frames</h2></div><Camera className="h-5 w-5 text-accent-400" /></div>
          {featuredPosts.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{featuredPosts.map((post, index) => <Link key={post.id} to={`/explore?post=${post.id}`} state={{ from: `/user/${profile.username}?portfolio=1` }} className={`group relative overflow-hidden rounded-[1.25rem] bg-black ${index === 0 ? 'col-span-2 aspect-[16/10] sm:col-span-2 sm:row-span-2 sm:aspect-auto' : 'aspect-square'}`}>
            <img src={post.images?.[0]?.public_url} alt={post.locationName || 'Creator portfolio photo'} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-3"><p className="truncate text-xs font-extrabold text-white">{post.locationName || 'Location story'}</p>{index === 0 && post.caption && <p className="mt-1 line-clamp-1 text-xs text-white/60">{post.caption}</p>}</div>
          </Link>)}</div> : <div className="surface-card rounded-[1.5rem] px-6 py-12 text-center"><Camera className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 text-sm font-extrabold text-primary">No featured frames yet</p><p className="mt-1 text-xs text-muted">Photo posts will automatically build this portfolio.</p></div>}
        </section>

        {userSpots.length > 0 && <section>
          <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Places worth finding</p><h2 className="mt-1 text-xl font-extrabold text-primary">Locations by this creator</h2></div><MapPin className="h-5 w-5 text-accent-400" /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{userSpots.slice(0, 6).map((spot) => <Link key={spot.id} to={`/spot/${spot.id}`} className="surface-card group overflow-hidden rounded-[1.35rem]"><img src={getSpotPrimaryImage(spot)} alt="" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" /><div className="p-3"><p className="truncate text-sm font-extrabold text-primary">{spot.name}</p><p className="mt-1 truncate text-xs text-muted">{spot.address || 'Pinned location'}</p></div></Link>)}</div>
        </section>}

        {profileEvents.length > 0 && <section>
          <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-extrabold text-primary">Upcoming events</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{profileEvents.map((event) => <Link key={event.id} to={`/event/${event.id}`} state={{ from: `/user/${profile.username}?portfolio=1` }} className="surface-card flex items-center gap-3 rounded-[1.35rem] p-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-center"><span className="text-[10px] font-black uppercase text-cyan-300">{new Date(event.startsAt).toLocaleDateString([], { month: 'short' })}</span><span className="-mt-2 text-lg font-black text-primary">{new Date(event.startsAt).getDate()}</span></div><div className="min-w-0"><p className="truncate text-sm font-extrabold text-primary">{event.title}</p><p className="mt-1 truncate text-xs text-muted">{event.venueName || event.address || 'Location coming soon'}</p></div></Link>)}</div>
        </section>}

        <Link to={`/user/${profile.username}`} replace className="surface-card flex items-center justify-between rounded-[1.5rem] p-4 text-sm font-extrabold text-secondary"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-accent-400" />Friends and community activity</span><ArrowLeft className="h-4 w-4 rotate-180 text-muted" /></Link>
      </main>
    </div>
  );
}
