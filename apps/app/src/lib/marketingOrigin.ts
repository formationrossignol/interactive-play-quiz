export const MARKETING_ORIGIN = (
  import.meta.env.VITE_MARKETING_ORIGIN
  || (import.meta.env.DEV ? "http://127.0.0.1:3010" : "https://brivia.app")
).replace(/\/$/, "");

export const marketingUrl = (path: string) => `${MARKETING_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
