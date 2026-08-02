export type MarketingEventProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackMarketingEvent(event: string, properties: MarketingEventProperties = {}) {
  if (typeof window === "undefined") return;

  const detail = {
    event,
    timestamp: new Date().toISOString(),
    path: `${window.location.pathname}${window.location.search}`,
    ...properties,
  };

  window.dataLayer?.push(detail);
  window.dispatchEvent(new CustomEvent("brivia:marketing", { detail }));
}
