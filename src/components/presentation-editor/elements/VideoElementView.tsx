import { Loader2 } from "lucide-react";
import type { VideoElement } from "../types/presentation";

function embedUrl(element: VideoElement): string | null {
  if (element.provider === "youtube") {
    if (element.src.includes("/embed/")) return element.src;
    const match = element.src.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }
  if (element.provider === "vimeo") {
    if (element.src.includes("player.vimeo.com")) return element.src;
    const match = element.src.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  return null;
}

export function VideoElementView({ element }: { element: VideoElement }) {
  if (element.provider === "upload" && !element.src) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)", border: "1px dashed var(--ap-line)", color: "var(--ap-muted)" }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (element.provider === "upload") {
    return <video src={element.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls />;
  }
  const url = embedUrl(element);
  return <iframe src={url ?? undefined} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="embed" />;
}
