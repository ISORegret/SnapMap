import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Camera, Heart, Sun, Share2, Map, ArrowLeft } from 'lucide-react';
import { getSpotPrimaryImage } from '../utils/spotImages';

export default function About({ allSpots = [] }) {
  const navigate = useNavigate();
  const featuredSpots = allSpots
    .filter((s) => s.id && !String(s.id).startsWith('user-'))
    .slice(0, 8);

  return (
    <div className="page-shell pb-24 animate-fade-in">
      <header className="page-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="icon-button mb-5 gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="eyebrow">Made for the next shoot</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-primary">About SnapMap</h1>
        <p className="mt-2 max-w-xl font-medium text-muted">
          The best places for photography and cars. Find spots, plan shoots, save favorites.
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-6">
        {/* What is SnapMap */}
        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">What is SnapMap?</h2>
          <p className="text-slate-400 leading-relaxed">
            SnapMap is a community-driven app for discovering photo locations. Get exact coordinates,
            best times to shoot (golden hour, blue hour, sunset), directions, and weather — so you can
            plan less and travel more.
          </p>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">What you can do</h2>
          <ul className="surface-card space-y-1 rounded-[1.5rem] p-3">
            <li className="flex items-start gap-3 rounded-2xl p-3">
              <Map className="h-5 w-5 shrink-0 text-accent-400 mt-0.5" />
              <div>
                <span className="text-primary font-medium">Map</span>
                <p className="text-slate-400 text-sm">See all spots on an interactive map. Switch between Map, Satellite, and Terrain layers.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl p-3">
              <Camera className="h-5 w-5 shrink-0 text-accent-400 mt-0.5" />
              <div>
                <span className="text-primary font-medium">Explore</span>
                <p className="text-slate-400 text-sm">Browse by category, search, or find spots near you. Full gallery for each location.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl p-3">
              <Sun className="h-5 w-5 shrink-0 text-accent-400 mt-0.5" />
              <div>
                <span className="text-primary font-medium">Best times</span>
                <p className="text-slate-400 text-sm">Sunrise, sunset, golden hour, and blue hour times for any spot — so you know when to shoot.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl p-3">
              <Heart className="h-5 w-5 shrink-0 text-accent-400 mt-0.5" />
              <div>
                <span className="text-primary font-medium">Save & sync</span>
                <p className="text-slate-400 text-sm">Heart spots to save them. Sign in to sync favorites across your phone and web.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl p-3">
              <Share2 className="h-5 w-5 shrink-0 text-accent-400 mt-0.5" />
              <div>
                <span className="text-primary font-medium">Add spots</span>
                <p className="text-slate-400 text-sm">Contribute your own spots. Add photos, directions, and tips for other photographers.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Gallery - example spots from the app */}
        <section>
          <h2 className="text-lg font-semibold text-primary mb-3">Spots from the community</h2>
          <p className="text-slate-400 text-sm mb-4">
            Real locations added by photographers. Tap any to explore.
          </p>
          {featuredSpots.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {featuredSpots.map((spot) => (
                <Link
                  key={spot.id}
                  to={`/spot/${spot.id}`}
                  className="surface-card group block overflow-hidden rounded-[1.35rem] transition hover:-translate-y-0.5 hover:border-accent-500/30"
                >
                  <div className="aspect-[4/3] relative">
                    <img
                      src={getSpotPrimaryImage(spot)}
                      alt={spot.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <p className="absolute bottom-2 left-2 right-2 font-medium text-white text-sm truncate">
                      {spot.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No spots yet. Be the first to add one!</p>
          )}
        </section>

        {/* Privacy */}
        <section className="pt-4">
          <Link
            to="/privacy"
            className="block mb-4 text-sm text-accent-400 hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            to="/"
            className="primary-button px-5 py-3 text-sm"
          >
            <MapPin className="h-4 w-4" />
            Explore the map
          </Link>
        </section>
      </div>
    </div>
  );
}
