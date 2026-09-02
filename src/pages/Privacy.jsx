import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

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
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent-500/20 p-2">
            <Shield className="h-6 w-6 text-accent-400" />
          </div>
          <div>
            <p className="eyebrow">Your data</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-primary">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-0.5">Last updated September 2, 2026</p>
          </div>
        </div>
      </header>

      <div className="surface-card mx-4 my-6 max-w-3xl space-y-6 rounded-[1.5rem] p-5 text-sm leading-relaxed text-secondary md:mx-auto md:p-8">
        <section>
          <h2 className="text-base font-semibold text-primary mb-2">Overview</h2>
          <p>
            SnapMap (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) respects your privacy. This policy describes
            what data we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-primary mb-2">Data we collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-slate-300">Account data</strong> — If you sign in, we store your email and
              profile (username, display name) via Supabase Auth.</li>
            <li><strong className="text-slate-300">Spots & favorites</strong> — Unsigned spot drafts and collections stay
              on your device. When signed in, community spots and favorites are stored in Supabase so they can sync
              across devices. Only the account that publishes a community spot can edit or delete it.</li>
            <li><strong className="text-slate-300">Location</strong> — Your device location is used only with your
              permission to show spots near you and to filter by distance. We do not track or store your location
              beyond what your device provides for the &quot;near me&quot; features.</li>
            <li><strong className="text-slate-300">Community activity</strong> — Posts, comments, friendships, public
              check-ins, event details, and RSVPs are stored in Supabase and shown to other SnapMap users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-primary mb-2">How we use data</h2>
          <p>
            We use your data to run the app: display spots, sync favorites, support the creator feed, and organize events. We use
            Supabase for auth and cloud storage. We do not sell or share your data with third parties for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-primary mb-2">Third‑party services</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-slate-300">Supabase</strong> — Auth and database (see <a
              href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer"
              className="text-accent-400 hover:underline">Supabase Privacy</a>).</li>
            <li><strong className="text-slate-300">Esri and OpenStreetMap</strong> — Esri provides map imagery and tiles; OpenStreetMap&apos;s Nominatim service provides place search (see <a
              href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
              className="text-accent-400 hover:underline">OSM Copyright</a>).</li>
            <li><strong className="text-slate-300">Open‑Meteo</strong> — Weather data for spots (no account required).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-primary mb-2">Your choices</h2>
          <p>
            You can use SnapMap without signing in; data stays on your device. You can delete your account and data
            via your profile settings. To request deletion or ask questions, contact us using the link in the app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-primary mb-2">Changes</h2>
          <p>
            We may update this policy. We&apos;ll note the last update date at the top. Continued use after changes
            means you accept the updated policy.
          </p>
        </section>
      </div>
    </div>
  );
}
