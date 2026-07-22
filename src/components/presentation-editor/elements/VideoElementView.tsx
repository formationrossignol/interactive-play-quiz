import type { VideoElement } from "../types/presentation";

function embedUrl(element: VideoElement): string | null {
  if (element.provider === "youtube") return element.src.replace("watch?v=", "embed/");
  if (element.provider === "vimeo") return element.src.replace("vimeo.com/", "player.vimeo.com/video/");
  return null;
}

export function VideoElementView({ element }: { element: VideoElement }) {
  if (element.provider === "upload") {
    return <video src={element.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls />;
  }
  const url = embedUrl(element);
  return <iframe src={url ?? undefined} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="embed" />;
}
