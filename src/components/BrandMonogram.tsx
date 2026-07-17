// Brivia monogram "b◆" — the small mark used at app-icon/favicon/avatar sizes
// and inside the logo tile everywhere else. The diamond sits raised at
// cap-height, never on the baseline, and only ever appears attached to the
// "b" (or the full wordmark, see BrandWordmark) — never as standalone décor.
interface BrandMonogramProps {
  size?: number;
  color?: string;
  diamondColor?: string;
}

export const BrandMonogram = ({ size = 24, color = "#fff", diamondColor }: BrandMonogramProps) => (
  <span
    aria-hidden="true"
    style={{
      position: "relative",
      display: "inline-flex",
      fontFamily: "'Sora Variable', 'Sora', system-ui, sans-serif",
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1,
      color,
    }}
  >
    b
    <svg
      width={size * 0.24}
      height={size * 0.24}
      viewBox="0 0 10 10"
      style={{ position: "absolute", top: -size * 0.1, right: -size * 0.2 }}
    >
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" transform="rotate(45 5 5)" fill={diamondColor ?? "var(--ap-logo-diamond)"} />
    </svg>
  </span>
);
