import { useEffect, useRef } from "react";

const PREFIX = "brivia-scroll:";

/**
 * Restores a page's last vertical position, including pages whose content
 * arrives asynchronously. ResizeObserver retries until the document is tall
 * enough instead of restoring too early and silently clamping to the top.
 */
export function useScrollRestoration(key: string) {
  const restoredRef = useRef(false);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    restoredRef.current = false;
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    const target = raw ? Number(raw) : 0;
    if (!Number.isFinite(target) || target <= 0) {
      restoredRef.current = true;
      return;
    }

    const restore = () => {
      if (restoredRef.current) return;
      window.scrollTo({ top: target, behavior: "instant" });
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= target - 2) restoredRef.current = true;
    };

    restore();
    const observer = new ResizeObserver(restore);
    observer.observe(document.documentElement);
    const timeout = window.setTimeout(() => {
      restore();
      restoredRef.current = true;
      observer.disconnect();
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      sessionStorage.setItem(`${PREFIX}${key}`, String(window.scrollY));
    };
  }, [key]);
}
