import type { SVGProps } from "react";

export type ProductGlyphName =
  | "arrow"
  | "quiz"
  | "poll"
  | "flashcards"
  | "presentation"
  | "exam"
  | "course"
  | "creation"
  | "live"
  | "learning"
  | "assessment"
  | "collaboration"
  | "results"
  | "qr"
  | "controls"
  | "analytics"
  | "check"
  | "security"
  | "trophy"
  | "reset"
  | "partial"
  | "minus"
  | "external";

export function ProductGlyph({ name, ...props }: { name: ProductGlyphName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg {...props} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        {name === "arrow" && <><path d="M7 16h17" /><path d="m18.5 10.5 5.5 5.5-5.5 5.5" /></>}
        {name === "quiz" && <><path d="M5.5 18a10.5 10.5 0 0 1 21 0" /><path d="m16 18 5-5" /><circle cx="16" cy="18" r="1.4" /></>}
        {name === "poll" && <><path d="M6 26V16M13 26V9M20 26V13M27 26V5" /><path d="M4 26h25" /></>}
        {name === "flashcards" && <><path d="m6 11 10-5 10 5-10 5-10-5Z" /><path d="m6 16 10 5 10-5M6 21l10 5 10-5" /></>}
        {name === "presentation" && <><rect x="5" y="6" width="22" height="15" rx="1.5" /><path d="M16 21v6M11 27l5-6 5 6" /></>}
        {name === "exam" && <><rect x="8" y="6" width="16" height="21" rx="2" /><path d="M12 6V4h8v2M12 13h8M12 18h5M12 23h7" /></>}
        {name === "course" && <><path d="m4 11 12-6 12 6-12 6-12-6Z" /><path d="M8 14.5V21c4.5 3.2 11.5 3.2 16 0v-6.5M28 11v9" /></>}
        {name === "creation" && <><path d="M7 25 9.5 17 21 5.5a2.1 2.1 0 0 1 3 3L12.5 20 7 25Z" /><path d="m18.5 8 5.5 5.5M9.5 17l3 3" /></>}
        {name === "live" && <><circle cx="16" cy="16" r="2.5" /><path d="M10.5 21.5a7.8 7.8 0 0 1 0-11M21.5 10.5a7.8 7.8 0 0 1 0 11M6.5 25.5a13.4 13.4 0 0 1 0-19M25.5 6.5a13.4 13.4 0 0 1 0 19" /></>}
        {name === "learning" && <><path d="M6 7.5h8.5A3.5 3.5 0 0 1 18 11v15a4 4 0 0 0-4-4H6V7.5ZM26 7.5h-4A4 4 0 0 0 18 11v15a4 4 0 0 1 4-4h4V7.5Z" /></>}
        {name === "assessment" && <><circle cx="16" cy="16" r="11" /><circle cx="16" cy="16" r="6" /><path d="m16 16 8-8M21 8h3v3" /></>}
        {name === "collaboration" && <><circle cx="11" cy="12" r="4" /><circle cx="23" cy="14" r="3" /><path d="M4.5 26c.6-5 3.1-7.5 6.5-7.5s6 2.5 6.5 7.5M18 22c1.1-2.7 2.8-4 5-4 2.7 0 4.4 2 5 6" /></>}
        {name === "results" && <><path d="M6 26V15h5v11M13.5 26V9h5v17M21 26V4h5v22" /><path d="M4 26h24" /></>}
        {name === "qr" && <><path d="M5 5h8v8H5zM19 5h8v8h-8zM5 19h8v8H5zM19 19h3v3h-3zM24 19h3v8h-8v-3" /></>}
        {name === "controls" && <><path d="M5 9h22M5 16h22M5 23h22" /><circle cx="11" cy="9" r="2.5" fill="var(--mp-surface, currentColor)" /><circle cx="21" cy="16" r="2.5" fill="var(--mp-surface, currentColor)" /><circle cx="14" cy="23" r="2.5" fill="var(--mp-surface, currentColor)" /></>}
        {name === "analytics" && <><path d="M5 25 12 17l5 4 10-13" /><path d="M21 8h6v6" /><circle cx="12" cy="17" r="1.3" /><circle cx="17" cy="21" r="1.3" /></>}
        {name === "check" && <><circle cx="16" cy="16" r="11" /><path d="m10 16 4 4 8-9" /></>}
        {name === "security" && <><path d="M16 4 26 8v7c0 6.2-3.6 10.5-10 13-6.4-2.5-10-6.8-10-13V8l10-4Z" /><path d="m11 16 3.3 3.3L21.5 12" /></>}
        {name === "trophy" && <><path d="M10 5h12v7c0 4.2-2.4 7-6 7s-6-2.8-6-7V5Z" /><path d="M10 8H5v2c0 3.2 1.8 5 5 5M22 8h5v2c0 3.2-1.8 5-5 5M16 19v5M11 27h10M12 24h8" /></>}
        {name === "reset" && <><path d="M8.5 10.5A10.5 10.5 0 1 1 6 20" /><path d="M5 8v6h6" /></>}
        {name === "partial" && <><circle cx="16" cy="16" r="10" strokeDasharray="2.5 3.5" /><circle cx="16" cy="16" r="2.4" /></>}
        {name === "minus" && <path d="M7 16h18" />}
        {name === "external" && <><path d="M8 24 24 8" /><path d="M14 8h10v10" /></>}
      </g>
    </svg>
  );
}
