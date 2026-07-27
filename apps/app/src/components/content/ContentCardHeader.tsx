import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ContentCardHeader({
  image,
  alt,
  icon: Icon,
  accent,
  children,
}: {
  image?: string;
  alt: string;
  icon: LucideIcon;
  accent: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="relative h-52 w-full flex-shrink-0 overflow-hidden"
      style={{ background: `color-mix(in srgb, ${accent} 14%, var(--ap-paper-2))` }}
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
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: accent }}>
          <Icon size={48} strokeWidth={1.8} style={{ opacity: .74 }} />
        </span>
      )}
      {children}
    </div>
  );
}

export function ContentRowThumbnail({
  image,
  alt,
  icon: Icon,
  accent,
}: {
  image?: string;
  alt: string;
  icon: LucideIcon;
  accent: string;
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
        background: `color-mix(in srgb, ${accent} 14%, var(--ap-paper-2))`,
        color: accent,
      }}
    >
      {image
        ? <img src={image} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
        : <Icon size={23} strokeWidth={1.8} style={{ opacity: .78 }} />}
    </span>
  );
}
