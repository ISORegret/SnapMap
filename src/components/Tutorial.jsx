import React, { useState, useEffect } from 'react';
import { LayoutGrid, Heart, Plus, Map } from 'lucide-react';

const TUTORIAL_KEY = 'snapmap_tutorial_done';

const STEPS = [
  {
    title: 'Discover spots',
    body: 'Browse the For You feed. Filter by category, distance, or search. Tap a spot to see details, sun times, and directions.',
    icon: LayoutGrid,
  },
  {
    title: 'Save favorites',
    body: 'Heart a spot to save it. Use the Saved tab to see your favorites and lists. Turn on sync to see the same favorites on all your devices.',
    icon: Heart,
  },
  {
    title: 'Add spots',
    body: 'Tap + to add a new spot. Add at least one photo, name, and location. Your spot is shared with everyone when Supabase is connected.',
    icon: Plus,
  },
  {
    title: 'Use the map',
    body: 'Open the Map tab to see all spots. Switch layers (Map, Satellite, Terrain, Dark) with the control. Tap the map to add a spot at that location.',
    icon: Map,
  },
];

export default function Tutorial({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(TUTORIAL_KEY);
      if (!done) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      try {
        localStorage.setItem(TUTORIAL_KEY, '1');
      } catch {}
      setVisible(false);
      onDone?.();
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {}
    setVisible(false);
    onDone?.();
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current?.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 px-6 py-8 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="First-run tutorial"
    >
      <div className="flex max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-[#0c0c0f] p-6 shadow-xl">
        {Icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <h2 className="text-lg font-semibold text-white">{current?.title}</h2>
        <p className="mt-2 text-center text-sm text-slate-400">{current?.body}</p>
        <div className="mt-6 flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            {step < STEPS.length - 1 ? 'Next' : 'Get started'}
          </button>
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition ${
                i === step ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
