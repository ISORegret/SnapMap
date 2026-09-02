import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Database,
  KeyRound,
  LogOut,
  Map,
  Moon,
  Palette,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { supabase, hasSupabase } from '../api/supabase';
import { isCurrentUserAdmin } from '../api/moderation';

const MAP_STYLES = [
  { id: 'streets', label: 'Streets' },
  { id: 'imagery', label: 'Satellite' },
  { id: 'topographic', label: 'Terrain' },
];

function SettingRow({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex min-h-[4.5rem] items-center gap-3 border-b border-white/[0.06] py-3 last:border-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-accent-400">
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Settings({
  currentUser,
  currentUserProfile,
  theme,
  setTheme,
  units,
  setUnits,
  appVersion,
  isOnline,
  showToast,
}) {
  const navigate = useNavigate();
  const [mapStyle, setMapStyle] = useState(() => {
    const saved = localStorage.getItem('snapmap_map_style');
    return MAP_STYLES.some((style) => style.id === saved) ? saved : (theme === 'light' ? 'street' : 'midnight');
  });
  const [busy, setBusy] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!currentUser) { setIsAdmin(false); return; }
    isCurrentUserAdmin().then(setIsAdmin);
  }, [currentUser?.id]);

  const chooseMapStyle = (value) => {
    setMapStyle(value);
    localStorage.setItem('snapmap_map_style', value);
    showToast?.(`Default map changed to ${MAP_STYLES.find((style) => style.id === value)?.label}.`);
  };

  const clearTemporaryData = () => {
    localStorage.removeItem('snapmap_recent_searches');
    localStorage.removeItem('snapmap_add_draft');
    showToast?.('Search history and draft cleared.');
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy('signout');
    const { error } = await supabase.auth.signOut();
    setBusy('');
    if (error) return showToast?.('Could not sign out. Try again.');
    navigate('/signin', { replace: true });
  };

  const deleteAccount = async () => {
    if (!supabase || !currentUser) return;
    const confirmed = window.confirm('Permanently delete your account, profile, spots, favorites, and activity? This cannot be undone.');
    if (!confirmed) return;
    const finalCheck = window.prompt('Type DELETE to permanently remove your account.');
    if (finalCheck !== 'DELETE') return;
    setBusy('delete');
    const { error } = await supabase.rpc('delete_own_account');
    setBusy('');
    if (error) {
      showToast?.('Account deletion is not available yet. Apply the latest database migration and try again.');
      return;
    }
    ['snapmap-user-spots', 'snapmap-favorites', 'snapmap-collections', 'snapmap_recent_searches', 'snapmap_add_draft']
      .forEach((key) => localStorage.removeItem(key));
    await supabase.auth.signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="page-shell pb-32 animate-fade-in">
      <header className="page-header">
        <button type="button" onClick={() => navigate(-1)} className="icon-button mb-5" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="eyebrow">Your SnapMap</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-primary">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Account, display, map, and storage preferences.</p>
      </header>

      <div className="space-y-5 px-4 pt-5">
        <section>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Account</p>
          <div className="surface-card rounded-[1.5rem] px-4">
            {currentUserProfile ? (
              <Link to={`/user/${currentUserProfile.username}`} className="block">
                <SettingRow icon={User} title={currentUserProfile.display_name || currentUserProfile.username} subtitle={currentUser?.email || `@${currentUserProfile.username}`}>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </SettingRow>
              </Link>
            ) : (
              <Link to="/signin" className="block">
                <SettingRow icon={User} title="Sign in" subtitle="Sync saved spots and publish under your profile.">
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </SettingRow>
              </Link>
            )}
            {currentUser && (
              <Link to="/change-password" className="block">
                <SettingRow icon={KeyRound} title="Change password">
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </SettingRow>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="block">
                <SettingRow icon={ShieldCheck} title="Moderation" subtitle="Review reports and manage community safety.">
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </SettingRow>
              </Link>
            )}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Appearance</p>
          <div className="surface-card rounded-[1.5rem] px-4">
            <SettingRow icon={theme === 'dark' ? Moon : Sun} title="Theme" subtitle="Choose the look that fits your screen.">
              <div className="flex rounded-xl bg-black/20 p-1">
                {['dark', 'light'].map((value) => (
                  <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${theme === value ? 'bg-accent-500 text-[#120d04]' : 'text-slate-500'}`}>
                    {value}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow icon={Palette} title="Distance units">
              <div className="flex rounded-xl bg-black/20 p-1">
                {['mi', 'km'].map((value) => (
                  <button key={value} type="button" onClick={() => setUnits(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase ${units === value ? 'bg-accent-500 text-[#120d04]' : 'text-slate-500'}`}>
                    {value}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow icon={Map} title="Default map" subtitle="Used when the map opens.">
              <select value={mapStyle} onChange={(event) => chooseMapStyle(event.target.value)} className="rounded-xl border border-white/10 bg-[var(--bg-page)] px-3 py-2 text-xs font-semibold text-primary outline-none">
                {MAP_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
              </select>
            </SettingRow>
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Data & status</p>
          <div className="surface-card rounded-[1.5rem] px-4">
            <SettingRow icon={isOnline ? Wifi : WifiOff} title={isOnline ? 'Online' : 'Offline'} subtitle={isOnline ? 'Cloud changes can sync normally.' : 'Changes will remain on this device until you reconnect.'}>
              <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </SettingRow>
            <button type="button" onClick={clearTemporaryData} className="block w-full text-left">
              <SettingRow icon={Database} title="Clear temporary data" subtitle="Removes search history and any unfinished Add draft.">
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </SettingRow>
            </button>
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">About</p>
          <div className="surface-card rounded-[1.5rem] px-4">
            <Link to="/privacy" className="block">
              <SettingRow icon={Shield} title="Privacy policy"><ChevronRight className="h-4 w-4 text-slate-600" /></SettingRow>
            </Link>
            <Link to="/about" className="block">
              <SettingRow icon={Check} title="About SnapMap" subtitle={`Version ${appVersion}`}><ChevronRight className="h-4 w-4 text-slate-600" /></SettingRow>
            </Link>
          </div>
        </section>

        {currentUser && hasSupabase && (
          <section>
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Session</p>
            <div className="surface-card rounded-[1.5rem] px-4">
              <button type="button" onClick={signOut} disabled={Boolean(busy)} className="block w-full text-left disabled:opacity-50">
                <SettingRow icon={LogOut} title={busy === 'signout' ? 'Signing out…' : 'Sign out'} />
              </button>
              <button type="button" onClick={deleteAccount} disabled={Boolean(busy)} className="block w-full text-left disabled:opacity-50">
                <SettingRow icon={Trash2} title={busy === 'delete' ? 'Deleting…' : 'Delete account'} subtitle="Permanently removes your SnapMap account and cloud data.">
                  <span className="text-xs font-semibold text-rose-400">Delete</span>
                </SettingRow>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
