import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 to `target` once its ref scrolls into view.
 *  Respects prefers-reduced-motion (jumps straight to the target). */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (reduced) { setValue(target); return; }
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / duration);
          const ease = 1 - Math.pow(1 - k, 3);
          setValue(Math.round(target * ease));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return { ref, value };
}
