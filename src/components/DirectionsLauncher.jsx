import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Map, Navigation, X } from 'lucide-react';
import { getMapAppPreference } from '../utils/mapNavigation';

function openMap(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

export default function DirectionsLauncher({
  googleUrl,
  appleUrl,
  className = '',
  children,
  title = 'Open directions',
  googleDescription = 'Open in Google Maps',
  appleDescription = 'Open in Apple Maps',
}) {
  const [chooserOpen, setChooserOpen] = useState(false);

  const launch = () => {
    const preference = getMapAppPreference();
    if (preference === 'google') return openMap(googleUrl);
    if (preference === 'apple') return openMap(appleUrl);
    setChooserOpen(true);
  };

  const choose = (url) => {
    setChooserOpen(false);
    openMap(url);
  };

  return (
    <>
      <button type="button" onClick={launch} className={className}>{children}</button>
      {chooserOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[2400] flex items-end justify-center bg-black/65 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={() => setChooserOpen(false)}>
          <section className="surface-card w-full max-w-md rounded-[1.75rem] p-4 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="map-app-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-1 pb-3">
              <div><p className="eyebrow">Directions</p><h2 id="map-app-title" className="mt-1 text-xl font-extrabold text-primary">{title}</h2></div>
              <button type="button" onClick={() => setChooserOpen(false)} className="icon-button h-10 w-10 rounded-xl" aria-label="Close maps app chooser"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => choose(appleUrl)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-left transition hover:border-accent-500/30 hover:bg-white/[0.08]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-primary"><Map className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-extrabold text-primary">Apple Maps</span><span className="mt-0.5 block text-xs text-muted">{appleDescription}</span></span>
              </button>
              <button type="button" onClick={() => choose(googleUrl)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-left transition hover:border-accent-500/30 hover:bg-white/[0.08]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-500/15 text-accent-400"><Navigation className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-extrabold text-primary">Google Maps</span><span className="mt-0.5 block text-xs text-muted">{googleDescription}</span></span>
              </button>
            </div>
            <p className="px-2 pt-3 text-center text-[11px] text-muted">Set a default anytime in Settings.</p>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
