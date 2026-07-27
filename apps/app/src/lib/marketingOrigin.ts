export const MARKETING_ORIGIN = (
  import.meta.env.VITE_MARKETING_ORIGIN
  || "https://interactive-play-quiz-marketing.vercel.app"
).replace(/\/$/, "");

export const marketingUrl = (path: string) => `${MARKETING_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
