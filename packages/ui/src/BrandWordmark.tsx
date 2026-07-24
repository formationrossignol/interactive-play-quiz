import type { CSSProperties } from "react";

// Brivia wordmark — Sora 600, interlettrage -3.5%, diamant calé à hauteur de
// capitale après le "a" (jamais sur la ligne de base). Couleur du diamant :
// indigo sur fond clair / lavande sur fond encre (voir --ap-logo-diamond).
interface BrandWordmarkProps {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export const BrandWordmark = ({ size, color, className, style }: BrandWordmarkProps) => (
  <span
    className={["ap-brandname", className].filter(Boolean).join(" ")}
    style={{
      display: "inline-flex",
      alignItems: "baseline",
      ...(size ? { fontSize: size } : {}),
      ...(color ? { color } : {}),
      ...style,
    }}
  >
    brivia
    <svg
      width="0.24em"
      height="0.24em"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{ marginLeft: "0.05em", transform: "translateY(-0.62em)", flexShrink: 0 }}
    >
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" transform="rotate(45 5 5)" fill="var(--ap-logo-diamond)" />
    </svg>
  </span>
);
