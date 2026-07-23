import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  loadStoredConsent,
  saveConsent,
  DEFAULT_CONSENT,
  ALL_ACCEPTED_CONSENT,
  type CookieConsentState,
} from "@/lib/cookieConsent";

interface CookieConsentContextValue {
  consent: CookieConsentState;
  hasDecided: boolean;
  bannerVisible: boolean;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (next: CookieConsentState) => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export const CookieConsentProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsent] = useState<CookieConsentState>(DEFAULT_CONSENT);
  const [hasDecided, setHasDecided] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = loadStoredConsent();
    if (stored) {
      setConsent(stored.consent);
      setHasDecided(true);
    }
  }, []);

  const commit = (next: CookieConsentState) => {
    saveConsent(next);
    setConsent(next);
    setHasDecided(true);
    setPreferencesOpen(false);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasDecided,
        bannerVisible: !hasDecided,
        preferencesOpen,
        openPreferences: () => setPreferencesOpen(true),
        closePreferences: () => setPreferencesOpen(false),
        acceptAll: () => commit(ALL_ACCEPTED_CONSENT),
        rejectAll: () => commit(DEFAULT_CONSENT),
        savePreferences: (next) => commit(next),
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = (): CookieConsentContextValue => {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
};
