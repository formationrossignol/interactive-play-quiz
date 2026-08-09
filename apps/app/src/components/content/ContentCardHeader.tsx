import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";

/** Decorative wave lines behind the cover icon — stroke inherits the card's
 *  accent color via currentColor, same motif shape used across every
 *  content-type cover in the design reference (quiz/exam/course/flashcard). */
function CoverMotif() {
  return (
    <svg
      className="motif"
      viewBox="0 0 300 112"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, opacity: .55 }}
    >
      <path d="M-10 90 Q60 40 150 70 T310 50" fill="none" stroke="currentColor" strokeWidth="1" opacity=".2" />
      <path d="M-10 105 Q80 60 170 85 T310 70" fill="none" stroke="currentColor" strokeWidth="1" opacity=".1" />
    </svg>
  );
}

export function ContentCardHeader({
  image,
  alt,
  icon,
  accent,
  background,
  /** Type badge shown top-left when there's no custom cover image — same
   *  convention as the dashboard's RecentWorks cards (product-recent-item__badge). */
  label,
  children,
}: {
  image?: string;
  alt: string;
  icon: string;
  accent: string;
  background?: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="product-content-cover relative h-52 w-full flex-shrink-0 overflow-hidden"
      style={{ background: background ?? `color-mix(in srgb, ${accent} 14%, var(--ap-paper-2))`, color: accent }}
    >
      {image ? (
        <img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          style={{ display: "block", objectPosition: "center" }}
        />
      ) : (
        <>
          <CoverMotif />
          {label && <span className="product-recent-item__badge" style={{ color: accent, background: "var(--ap-card)" }}>{label}</span>}
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: accent }}>
            <MaterialSymbol name={icon} size={48} style={{ opacity: .82, position: "relative" }} />
          </span>
        </>
      )}
      {children}
    </div>
  );
}

export function ContentRowThumbnail({
  image,
  alt,
  icon,
  accent,
  background,
}: {
  image?: string;
  alt: string;
  icon: string;
  accent: string;
  background?: string;
}) {
  return (
    <span
      style={{
        width: 48,
        height: 48,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: "var(--ap-r-sm)",
        background: background ?? `color-mix(in srgb, ${accent} 14%, var(--ap-paper-2))`,
        color: accent,
      }}
    >
      {image
        ? <img src={image} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
        : <MaterialSymbol name={icon} size={24} style={{ opacity: .82 }} />}
    </span>
  );
}
