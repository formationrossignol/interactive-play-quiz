export type CookieCategory = "necessary" | "preferences" | "analytics" | "marketing";

export interface CookieConsentState {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

const STORAGE_KEY = "brivia_cookie_consent";
export const COOKIE_CONSENT_EVENT = "ap:cookieconsent";

export const DEFAULT_CONSENT: CookieConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export const ALL_ACCEPTED_CONSENT: CookieConsentState = {
  necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};

interface StoredConsent {
  consent: CookieConsentState;
  decidedAt: string;
}

/** Returns the stored consent choice, or null if the visitor hasn't decided yet. */
export const loadStoredConsent = (): StoredConsent | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (!parsed?.consent) return null;
    return {
      consent: { ...DEFAULT_CONSENT, ...parsed.consent, necessary: true },
      decidedAt: parsed.decidedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

/** Persists the choice and notifies any listener (future analytics/marketing
 *  script loaders can subscribe to COOKIE_CONSENT_EVENT instead of polling). */
export const saveConsent = (consent: CookieConsentState): void => {
  const stored: StoredConsent = { consent: { ...consent, necessary: true }, decidedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: stored.consent }));
};

export const hasConsent = (category: CookieCategory): boolean => {
  if (category === "necessary") return true;
  return loadStoredConsent()?.consent[category] ?? false;
};
