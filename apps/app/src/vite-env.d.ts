/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKETING_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts's define — package.json's version, for the
// footer's build/support display.
declare const __APP_VERSION__: string;
