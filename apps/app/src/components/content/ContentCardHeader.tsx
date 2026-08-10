import { useId, type ReactNode } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import type { ContentType } from "@/lib/content/types";

/** A compact product preview instead of a generic icon on decorative waves.
 *  Every type keeps its own information hierarchy while sharing the same
 *  quiet, editorial cover vocabulary. */
export function ContentCoverArtwork({ type }: { type: ContentType }) {
  const gradientId = useId().replace(/:/g, "");
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg
      className="product-content-artwork"
      viewBox="0 0 320 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".12" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".02" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="180" fill={`url(#${gradientId})`} />
      {type === "quiz" && <>
        <rect x="74" y="36" width="172" height="110" rx="13" fill="var(--ap-card)" fillOpacity=".92" stroke="currentColor" strokeOpacity=".18" />
        <path d="M96 62H206M96 76H182" {...common} strokeOpacity=".55" />
        {[0, 1, 2, 3].map((index) => <rect key={index} x={96 + (index % 2) * 61} y={94 + Math.floor(index / 2) * 24} width="52" height="16" rx="5" fill="currentColor" opacity={index === 1 ? .68 : .18} />)}
      </>}
      {type === "poll" && <>
        <rect x="65" y="37" width="190" height="108" rx="13" fill="var(--ap-card)" fillOpacity=".92" stroke="currentColor" strokeOpacity=".18" />
        <path d="M88 62H201M88 75H174" {...common} strokeOpacity=".48" />
        {[58, 104, 78].map((width, index) => <g key={width}><rect x="88" y={92 + index * 15} width="120" height="7" rx="3.5" fill="currentColor" opacity=".1" /><rect x="88" y={92 + index * 15} width={width} height="7" rx="3.5" fill="currentColor" opacity={.65 - index * .12} /></g>)}
      </>}
      {type === "flashcard" && <>
        <rect x="96" y="55" width="144" height="88" rx="12" fill="currentColor" opacity=".12" transform="rotate(5 168 99)" />
        <rect x="88" y="50" width="144" height="88" rx="12" fill="var(--ap-card)" fillOpacity=".96" stroke="currentColor" strokeOpacity=".28" />
        <path d="M112 80H196M112 96H180" {...common} strokeOpacity=".55" />
        <rect x="112" y="113" width="52" height="8" rx="4" fill="currentColor" opacity=".2" />
      </>}
      {type === "slide" && <>
        <rect x="61" y="35" width="198" height="112" rx="10" fill="var(--ap-card)" fillOpacity=".94" stroke="currentColor" strokeOpacity=".22" />
        <rect x="76" y="50" width="47" height="82" rx="6" fill="currentColor" opacity=".12" />
        <rect x="136" y="52" width="98" height="36" rx="6" fill="currentColor" opacity=".2" />
        <path d="M136 105H222M136 117H198" {...common} strokeOpacity=".46" />
      </>}
      {type === "course" && <>
        <rect x="67" y="35" width="186" height="112" rx="12" fill="var(--ap-card)" fillOpacity=".94" stroke="currentColor" strokeOpacity=".2" />
        {[0, 1, 2].map((index) => <g key={index}><rect x="88" y={55 + index * 27} width="20" height="20" rx="6" fill="currentColor" opacity={.18 + index * .08} /><path d={`M120 ${62 + index * 27}H220M120 ${70 + index * 27}H188`} {...common} strokeOpacity=".38" /></g>)}
      </>}
      {type === "exam" && <>
        <path d="M102 35H202L230 63V146H102Z" fill="var(--ap-card)" fillOpacity=".94" stroke="currentColor" strokeOpacity=".24" />
        <path d="M202 35V64H230M124 79H204M124 95H190M124 111H178" {...common} strokeOpacity=".4" />
        <path d="M185 124L194 133L211 113" {...common} strokeWidth="4" strokeOpacity=".72" />
      </>}
    </svg>
  );
}

export function ContentCardHeader({
  image,
  alt,
  accent,
  background,
  type,
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
  type?: ContentType;
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
          <ContentCoverArtwork type={type ?? "quiz"} />
          {label && <span className="product-recent-item__badge" style={{ color: accent, background: "var(--ap-card)" }}>{label}</span>}
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
