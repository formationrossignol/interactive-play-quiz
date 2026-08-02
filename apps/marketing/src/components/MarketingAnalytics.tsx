"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
import { isEnglishPath } from "@/lib/marketingLocale";

export function MarketingAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = isEnglishPath(pathname) ? "en" : "fr";
    trackMarketingEvent("marketing_page_view", { pathname });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-marketing-cta]")
        : null;
      if (!target) return;

      trackMarketingEvent("marketing_cta_click", {
        cta: target.dataset.marketingCta ?? "unknown",
        destination: target instanceof HTMLAnchorElement ? target.href : undefined,
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
