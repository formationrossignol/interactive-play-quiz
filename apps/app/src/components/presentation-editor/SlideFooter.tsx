import type { PresentationFooter } from "./types/presentation";

interface SlideFooterProps {
  footer?: PresentationFooter;
  slideNumber: number;
  isTitleSlide?: boolean;
}

export function SlideFooter({ footer, slideNumber, isTitleSlide = false }: SlideFooterProps) {
  if (!footer || (footer.skipTitleSlide && isTitleSlide) || (!footer.text.trim() && !footer.showSlideNumber)) return null;
  const alignment = footer.alignment ?? "left";
  const numberPosition = footer.slideNumberPosition ?? "right";
  const numberStyle: React.CSSProperties = numberPosition === "left"
    ? { left: 0 }
    : numberPosition === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : { right: 0 };
  return (
    <div
      data-slide-footer
      style={{
        position: "absolute",
        left: 34,
        right: 34,
        bottom: 20,
        minHeight: 24,
        color: "currentColor",
        opacity: .72,
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: 1.25,
        pointerEvents: "none",
        zIndex: 999_999,
      }}
    >
      <span
        style={{
          display: "block",
          width: "100%",
          padding: numberPosition === alignment && footer.showSlideNumber ? "0 38px" : 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: alignment,
          boxSizing: "border-box",
        }}
      >
        {footer.text}
      </span>
      {footer.showSlideNumber && (
        <span style={{ position: "absolute", bottom: 0, flexShrink: 0, fontVariantNumeric: "tabular-nums", ...numberStyle }}>
          {slideNumber}
        </span>
      )}
    </div>
  );
}
