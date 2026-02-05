import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const DISMISS_KEY = 'snapmap-install-dismissed';
const DISMISS_DAYS = 7;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    return Number.isFinite(t) && Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) {
      setInstalled(true);
      return;
    }
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setVisible(false);
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
    setInstallEvent(null);
  };

  if (!visible || installed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-2.5 backdrop-blur">
      <p className="text-sm font-medium text-emerald-200">
        Install SnapMap for quick access and offline spots.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-slate-300"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </button>
      </div>
    </div>
  );
}
