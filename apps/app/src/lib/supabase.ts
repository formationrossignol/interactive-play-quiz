import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// "Rester connecté" (remember me) on AuthPage: when false, the session is
// written to sessionStorage (cleared when the tab closes) instead of
// localStorage (survives browser restarts). Call setAuthPersistence() right
// before signInWithPassword — see auth.ts's login().
let rememberSession = true;
export function setAuthPersistence(remember: boolean): void {
  rememberSession = remember;
}

const dualStorage: SupportedStorage = {
  getItem: (k) => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  setItem: (k, v) => {
    (rememberSession ? localStorage : sessionStorage).setItem(k, v);
    // Don't leave a stale copy of this session in the other store from a
    // previous login that made the opposite choice.
    (rememberSession ? sessionStorage : localStorage).removeItem(k);
  },
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

export const supabase = createClient(url, key, { auth: { storage: dualStorage } });
export const supabaseUrl = url;
export const supabaseKey = key;
