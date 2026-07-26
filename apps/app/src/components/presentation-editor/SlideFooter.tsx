import type { PresentationFooter } from "./types/presentation";

interface SlideFooterProps {
  footer?: PresentationFooter;
  slideNumber: number;
  isTitleSlide?: boolean;
}

export function SlideFooter({ footer, slideNumber, isTitleSlide = false }: SlideFooterProps) {
  if (!footer || (footer.skipTitleSlide && isTitleSlide) || (!footer.text.trim() && !footer.showSlideNumber)) return null;
  return (
    <div
      data-slide-footer
      style={{
        position: "absolute",
        left: 34,
        right: 34,
        bottom: 20,
        minHeight: 24,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        color: "rgba(28, 30, 38, .7)",
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        lineHeight: 1.25,
        pointerEvents: "none",
        zIndex: 999_999,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footer.text}</span>
      {footer.showSlideNumber && <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{slideNumber}</span>}
    </div>
  );
}
