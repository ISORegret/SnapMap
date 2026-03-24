import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-8">
      <header className="border-b border-white/[0.08] px-4 py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 mb-4 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-accent-500/20 p-2">
            <Shield className="h-6 w-6 text-accent-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Privacy Policy</h1>
            <p className="text-sm text-slate-500 mt-0.5">SnapMap — last updated</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 text-slate-400 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">Overview</h2>
          <p>
            SnapMap (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) respects your privacy. This policy describes
            what data we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Data we collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-slate-300">Account data</strong> — If you sign in, we store your email and
              profile (username, display name) via Supabase Auth.</li>
            <li><strong className="text-slate-300">Spots & favorites</strong> — Spots you add, favorite, or save to
              collections are stored locally on your device and, when signed in, synced to Supabase so you can access
              them on other devices.</li>
            <li><strong className="text-slate-300">Location</strong> — Your device location is used only with your
              permission to show spots near you and to filter by distance. We do not track or store your location
              beyond what your device provides for the &quot;near me&quot; features.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">How we use data</h2>
          <p>
            We use your data to run the app: display spots, sync favorites, and let you add and edit spots. We use
            Supabase for auth and cloud storage. We do not sell or share your data with third parties for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Third‑party services</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-slate-300">Supabase</strong> — Auth and database (see <a
              href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer"
              className="text-accent-400 hover:underline">Supabase Privacy</a>).</li>
            <li><strong className="text-slate-300">OpenStreetMap</strong> — Map tiles (see <a
              href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
              className="text-accent-400 hover:underline">OSM Copyright</a>).</li>
            <li><strong className="text-slate-300">Open‑Meteo</strong> — Weather data for spots (no account required).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Your choices</h2>
          <p>
            You can use SnapMap without signing in; data stays on your device. You can delete your account and data
            via your profile settings. To request deletion or ask questions, contact us using the link in the app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Changes</h2>
          <p>
            We may update this policy. We&apos;ll note the last update date at the top. Continued use after changes
            means you accept the updated policy.
          </p>
        </section>
      </div>
    </div>
  );
}
