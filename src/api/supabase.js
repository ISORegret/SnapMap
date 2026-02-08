import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Storage that persists session in Capacitor Preferences on native (survives app exit);
 * falls back to localStorage on web.
 */
function createStorage() {
  return {
    getItem: (key) =>
      Promise.resolve().then(async () => {
        try {
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.isNativePlatform()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            return value;
          }
        } catch (_) {}
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }),
    setItem: (key, value) =>
      Promise.resolve().then(async () => {
        try {
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.isNativePlatform()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value });
            return;
          }
        } catch (_) {}
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      }),
    removeItem: (key) =>
      Promise.resolve().then(async () => {
        try {
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.isNativePlatform()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
            return;
          }
        } catch (_) {}
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      }),
  };
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: createStorage(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const hasSupabase = Boolean(supabase);
