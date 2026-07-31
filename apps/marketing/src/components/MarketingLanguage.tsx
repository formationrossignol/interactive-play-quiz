"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type MarketingLanguage = "fr" | "en";

type LanguageContextValue = {
  language: MarketingLanguage;
  setLanguage: (language: MarketingLanguage) => void;
};

const STORAGE_KEY = "quiz_language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function subscribeToLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ap:langchange", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ap:langchange", callback);
  };
}

function getLanguageSnapshot(): MarketingLanguage {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fr";
}

function getServerLanguageSnapshot(): MarketingLanguage {
  return "fr";
}

export function MarketingLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: MarketingLanguage) => {
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    document.cookie = `brivia_language=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLanguage;
    window.dispatchEvent(new CustomEvent("ap:langchange"));
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useMarketingLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useMarketingLanguage must be used inside MarketingLanguageProvider");
  }
  return value;
}
